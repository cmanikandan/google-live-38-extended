import express from 'express';
import http from 'http';
import crypto from 'crypto';
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
app.use(express.urlencoded({ extended: false }));

const PORT = process.env.PORT || 3080;
const DEFAULT_MODEL = process.env.GEMINI_LIVE_MODEL || 'gemini-3.8-live-extended-thinking';

const APP_AUTH_USER = process.env.APP_AUTH_USER || '';
const APP_AUTH_PASS = process.env.APP_AUTH_PASS || '';
const AUTH_SECRET = process.env.APP_AUTH_SECRET || crypto.randomBytes(32).toString('hex');
const isAuthProtected = Boolean(APP_AUTH_USER && APP_AUTH_PASS);

function computeAuthToken(username, password) {
  return crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(`${username}:${password}`)
    .digest('hex');
}

function parseCookies(cookieHeader = '') {
  const out = {};
  cookieHeader.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx > -1) {
      const k = pair.slice(0, idx).trim();
      const v = decodeURIComponent(pair.slice(idx + 1).trim());
      out[k] = v;
    }
  });
  return out;
}

function isRequestAuthenticated(req) {
  if (!isAuthProtected) return true;

  const expectedToken = computeAuthToken(APP_AUTH_USER, APP_AUTH_PASS);
  const cookies = parseCookies(req.headers.cookie || '');
  if (cookies.concierge_session === expectedToken) {
    return true;
  }

  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Basic ')) {
    const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
    const sepIndex = decoded.indexOf(':');
    if (sepIndex > -1) {
      const user = decoded.slice(0, sepIndex);
      const pass = decoded.slice(sepIndex + 1);
      if (user === APP_AUTH_USER && pass === APP_AUTH_PASS) {
        return true;
      }
    }
  }
  return false;
}

function renderLoginHtml(errorMessage = '') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Sign In — Gemini 3.8 Live Extended Thinking Concierge</title>
  <style>
    :root {
      --bg-main: #060911;
      --bg-surface: #0d1322;
      --bg-elevated: #131c31;
      --border: #1e293b;
      --blue: #3b82f6;
      --text-primary: #f8fafc;
      --text-secondary: #94a3b8;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background: radial-gradient(circle at top, #131c31 0%, #060911 70%);
      color: var(--text-primary);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .login-card {
      width: 100%;
      max-width: 420px;
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 32px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
    }
    .pill {
      display: inline-block;
      background: linear-gradient(135deg, #2563eb, #7c3aed);
      color: #fff;
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.6px;
      margin-bottom: 14px;
    }
    h1 {
      margin: 0 0 8px 0;
      font-size: 22px;
      font-weight: 700;
    }
    p.sub {
      margin: 0 0 24px 0;
      font-size: 13px;
      color: var(--text-secondary);
      line-height: 1.5;
    }
    .error-box {
      background: rgba(220, 38, 38, 0.15);
      border: 1px solid #ef4444;
      color: #fca5a5;
      padding: 10px 14px;
      border-radius: 10px;
      font-size: 13px;
      margin-bottom: 18px;
    }
    label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      color: var(--text-secondary);
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    input {
      width: 100%;
      background: var(--bg-elevated);
      border: 1px solid #334155;
      color: var(--text-primary);
      padding: 12px 14px;
      border-radius: 10px;
      font-size: 14px;
      margin-bottom: 18px;
      outline: none;
    }
    input:focus {
      border-color: var(--blue);
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.25);
    }
    button {
      width: 100%;
      background: #2563eb;
      color: #fff;
      border: 1px solid #3b82f6;
      padding: 12px 16px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35);
    }
    button:hover {
      background: #1d4ed8;
    }
  </style>
</head>
<body>
  <div class="login-card">
    <div class="pill">PROTECTED ACCESS</div>
    <h1>Gemini 3.8 Live Concierge</h1>
    <p class="sub">Enter your authorized test credentials to access the Tier-3 Enterprise Contact Center Concierge.</p>
    ${errorMessage ? `<div class="error-box">${errorMessage}</div>` : ''}
    <form method="POST" action="/auth/login">
      <label for="username">Username</label>
      <input id="username" name="username" type="text" autocomplete="username" required autofocus />
      <label for="password">Password</label>
      <input id="password" name="password" type="password" autocomplete="current-password" required />
      <button type="submit">Sign In to Concierge</button>
    </form>
  </div>
</body>
</html>`;
}

app.post('/auth/login', (req, res) => {
  const { username = '', password = '' } = req.body || {};
  if (!isAuthProtected || (username === APP_AUTH_USER && password === APP_AUTH_PASS)) {
    const token = computeAuthToken(APP_AUTH_USER, APP_AUTH_PASS);
    res.setHeader(
      'Set-Cookie',
      `concierge_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`
    );
    return res.redirect('/');
  }
  return res.status(401).send(renderLoginHtml('Invalid username or password. Please try again.'));
});

app.get('/auth/logout', (req, res) => {
  res.setHeader('Set-Cookie', 'concierge_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  res.redirect('/');
});

app.use((req, res, next) => {
  if (!isAuthProtected) return next();
  if (req.path === '/auth/login' || req.path === '/auth/logout') return next();
  if (isRequestAuthenticated(req)) return next();

  if (req.path.startsWith('/api/')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Gemini 3.8 Live Concierge"');
    return res.status(401).json({ error: 'Unauthorized. Valid credentials required.' });
  }
  return res.status(401).send(renderLoginHtml());
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => {
  const hasServerKey = Boolean(
    process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here'
  );
  const dbSnapshot = getDatabaseSnapshot();
  res.json({
    status: 'ok',
    model: DEFAULT_MODEL,
    authProtected: isAuthProtected,
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
  if (!isRequestAuthenticated(req)) {
    clientWs.send(
      JSON.stringify({
        type: 'error',
        message: 'Unauthorized WebSocket session. Please sign in first.'
      })
    );
    clientWs.close(1008, 'Unauthorized');
    return;
  }
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

    const isExtendedThinkingModel = modelName.includes('extended-thinking');
    const generationConfig = {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName
          }
        }
      }
    };

    if (isExtendedThinkingModel) {
      generationConfig.thinkingConfig = {
        thinkingLevel
      };
    }

    const setupFrame = {
      setup: {
        model: modelName.startsWith('models/') ? modelName : `models/${modelName}`,
        generationConfig,
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
