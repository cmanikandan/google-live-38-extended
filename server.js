import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import dotenv from 'dotenv';
import {
  NON_BLOCKING_TOOL_DECLARATIONS,
  executeCrmTool,
  CONCIERGE_SYSTEM_INSTRUCTION
} from './src/crm_tools.js';
import { getDatabaseSnapshot } from './src/database_backend.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '15mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3080;
const DEFAULT_MODEL = process.env.GEMINI_LIVE_MODEL || 'gemini-3.8-live-extended-thinking';

app.get('/api/health', (req, res) => {
  const hasServerKey = Boolean(
    process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here'
  );
  const dbSnapshot = getDatabaseSnapshot();
  res.json({
    status: 'ok',
    model: DEFAULT_MODEL,
    hasServerApiKey: hasServerKey,
    databaseBackend: {
      gcpProjectId: dbSnapshot.gcpProjectId,
      bigQueryDataset: dbSnapshot.bigQueryDataset,
      cloudAdcConnected: dbSnapshot.cloudAdcConnected,
      sqliteFile: dbSnapshot.sqliteFile
    },
    toolsRegistered: NON_BLOCKING_TOOL_DECLARATIONS.map((t) => ({
      name: t.name,
      behavior: t.behavior
    }))
  });
});

app.get('/api/db-state', (req, res) => {
  res.json(getDatabaseSnapshot());
});

app.post('/api/execute-tool', async (req, res) => {
  try {
    const { name, args, latencyMs = 800 } = req.body;
    const result = await executeCrmTool(name, args, latencyMs);
    res.json({ ok: true, tool: name, result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws/live' });

wss.on('connection', (clientWs, req) => {
  const urlParams = new URL(req.url, `http://${req.headers.host}`).searchParams;
  const apiKey = urlParams.get('apiKey') || process.env.GEMINI_API_KEY;
  const thinkingLevel = (urlParams.get('thinkingLevel') || 'HIGH').toUpperCase();
  const voiceName = urlParams.get('voiceName') || 'Aoede';
  const modelName = urlParams.get('model') || DEFAULT_MODEL;
  const enableGoogleSearch = urlParams.get('googleSearch') !== 'false';
  const toolLatencyMs = Number(urlParams.get('toolLatencyMs') ?? 1800);

  if (!apiKey) {
    clientWs.send(
      JSON.stringify({
        type: 'error',
        message: 'Missing Gemini API Key. Set GEMINI_API_KEY in .env or pass in UI.'
      })
    );
    clientWs.close();
    return;
  }

  const geminiWsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(
    apiKey
  )}`;

  const geminiWs = new WebSocket(geminiWsUrl);
  let isSetupComplete = false;
  let latestVideoFrameBeforeSetup = null;

  const sendToClient = (payload) => {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify(payload));
    }
  };

  geminiWs.on('open', () => {
    const toolsList = [
      {
        functionDeclarations: NON_BLOCKING_TOOL_DECLARATIONS
      }
    ];
    if (enableGoogleSearch) {
      toolsList.push({ googleSearch: {} });
    }

    const setupFrame = {
      setup: {
        model: modelName.startsWith('models/') ? modelName : `models/${modelName}`,
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName
              }
            }
          },
          thinkingConfig: {
            thinkingLevel
          }
        },
        systemInstruction: {
          parts: [{ text: CONCIERGE_SYSTEM_INSTRUCTION }]
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        tools: toolsList
      }
    };

    geminiWs.send(JSON.stringify(setupFrame));

    sendToClient({
      type: 'session_init',
      model: modelName,
      thinkingLevel,
      voiceName,
      enableGoogleSearch,
      tools: NON_BLOCKING_TOOL_DECLARATIONS.map((t) => t.name),
      setupFrame
    });
  });

  geminiWs.on('message', async (rawData) => {
    try {
      const textData = rawData.toString('utf8');
      const message = JSON.parse(textData);

      // Detect upstream Gemini Live setupComplete so continuous video streaming starts at the exact right moment
      if (message.setupComplete || message.setup_complete) {
        isSetupComplete = true;
        if (latestVideoFrameBeforeSetup && geminiWs.readyState === WebSocket.OPEN) {
          geminiWs.send(JSON.stringify(latestVideoFrameBeforeSetup));
          latestVideoFrameBeforeSetup = null;
        }
        sendToClient({
          type: 'gemini_setup_complete',
          timestamp: new Date().toISOString()
        });
      }

      // Extract interactionStatus (supports both camelCase & snake_case)
      const interactionStatus =
        message.interactionStatus ||
        message.interaction_status ||
        message.serverContent?.interactionStatus ||
        message.serverContent?.interaction_status ||
        null;

      // Forward raw message + normalized metadata to browser UI
      sendToClient({
        type: 'gemini_message',
        interactionStatus,
        message
      });

      // Handle asynchronous NON_BLOCKING tool calls from Gemini 3.8 Live Extended Thinking
      const functionCalls =
        message.toolCall?.functionCalls || message.tool_call?.function_calls || [];

      if (functionCalls.length > 0) {
        // Execute all requested NON_BLOCKING tools concurrently in the background
        await Promise.all(
          functionCalls.map(async (call) => {
            sendToClient({
              type: 'tool_execution_start',
              id: call.id,
              name: call.name,
              args: call.args || {},
              behavior: 'NON_BLOCKING',
              interactionStatus: interactionStatus || 'IN_PROGRESS',
              timestamp: new Date().toISOString()
            });

            const toolResult = await executeCrmTool(call.name, call.args || {}, toolLatencyMs);

            sendToClient({
              type: 'tool_execution_complete',
              id: call.id,
              name: call.name,
              args: call.args || {},
              result: toolResult,
              interactionStatus: interactionStatus || 'IN_PROGRESS',
              timestamp: new Date().toISOString()
            });

            const toolResponseFrame = {
              toolResponse: {
                functionResponses: [
                  {
                    id: call.id,
                    name: call.name,
                    response: {
                      output: toolResult
                    }
                  }
                ]
              }
            };

            if (geminiWs.readyState === WebSocket.OPEN) {
              geminiWs.send(JSON.stringify(toolResponseFrame));
            }
          })
        );
      }
    } catch (err) {
      sendToClient({
        type: 'error',
        message: `Failed parsing Gemini Live frame: ${err.message}`
      });
    }
  });

  geminiWs.on('error', (err) => {
    sendToClient({
      type: 'error',
      message: `Gemini Live WebSocket error: ${err.message}`
    });
  });

  geminiWs.on('close', (code, reason) => {
    sendToClient({
      type: 'session_closed',
      code,
      reason: reason?.toString() || 'Closed'
    });
  });

  clientWs.on('message', (clientRaw) => {
    try {
      const parsed = JSON.parse(clientRaw.toString('utf8'));
      if (!isSetupComplete) {
        if (parsed.realtimeInput?.video) {
          latestVideoFrameBeforeSetup = parsed;
        }
        return;
      }
      if (geminiWs.readyState === WebSocket.OPEN) {
        geminiWs.send(JSON.stringify(parsed));
      }
    } catch (err) {
      sendToClient({
        type: 'error',
        message: `Invalid client frame: ${err.message}`
      });
    }
  });

  clientWs.on('close', () => {
    if (geminiWs.readyState === WebSocket.OPEN || geminiWs.readyState === WebSocket.CONNECTING) {
      geminiWs.close();
    }
  });
});

export { app, server };

if (process.argv[1] === __filename) {
  server.listen(PORT, () => {
    console.log(
      `\n🚀 Tier-3 Enterprise Contact Center Concierge (${DEFAULT_MODEL}) running at http://localhost:${PORT}`
    );
    console.log(`📄 Printable Boarding Pass & Receipt Kit: http://localhost:${PORT}/samples/printable-demo-kit.html`);
  });
}
