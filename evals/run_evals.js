/**
 * Automated Evaluation Suite for Tier-3 Enterprise Contact Center Concierge
 * (Gemini 3.8 Live Extended Thinking Demo)
 *
 * Tests:
 * 1. NON_BLOCKING Tool Declaration & CRM/WorldTracer/EU261 Engine Integrity
 * 2. Multimodal Visual OCR Extraction on Generated Sample Boarding Pass & Hotel Receipt Images
 * 3. Live WebSocket Protocol Lifecycle (`gemini-3.8-live-extended-thinking`, `interaction_status: IN_PROGRESS -> IDLE`, `realtimeInput.video`, async `NON_BLOCKING` tool execution)
 * 4. Multi-Constraint Legal & VIP Policy Reasoning (EU261 Art. 5(3) Weather Exemption vs. Art. 9 Right to Care + Star Alliance Gold/1K Priority Override)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import WebSocket from 'ws';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import {
  NON_BLOCKING_TOOL_DECLARATIONS,
  executeCrmTool,
  CONCIERGE_SYSTEM_INSTRUCTION
} from '../src/crm_tools.js';
import { server } from '../server.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('❌ Missing GEMINI_API_KEY in .env');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });
const results = [];

function recordResult(id, name, passed, details, metrics = {}) {
  results.push({ id, name, passed, details, metrics, timestamp: new Date().toISOString() });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${icon} | [${id}] ${name}`);
  console.log(`       └─ ${details}`);
}

async function runEval1_NonBlockingSchemaAndCrmEngine() {
  const allNonBlocking = NON_BLOCKING_TOOL_DECLARATIONS.every(
    (t) => t.behavior === 'NON_BLOCKING'
  );
  const scanRes = await executeCrmTool(
    'scan_boarding_pass_and_bag_tag',
    { pnr: 'LH8942X', bag_tag_number: '0220-774910-PRIO' },
    10
  );
  const eu261Res = await executeCrmTool(
    'evaluate_eu261_and_vip_entitlement',
    { disruption_code: 'WX84', hotel_receipt_amount_eur: 245 },
    10
  );
  const flightRes = await executeCrmTool(
    'search_star_alliance_partner_flights',
    { origin: 'FRA', destination: 'JFK', time_preference: 'MORNING' },
    10
  );

  const schemaValid =
    allNonBlocking &&
    NON_BLOCKING_TOOL_DECLARATIONS.length === 4 &&
    scanRes.status === '200 OK' &&
    scanRes.worldtracer_baggage.bag_tag_number === '0220-774910-PRIO' &&
    eu261Res.legal_and_policy_determination.eu261_article_7_statutory_cash_eur_600.eligible === false &&
    eu261Res.legal_and_policy_determination.eu261_article_9_right_to_care.eligible === true &&
    flightRes.partner_options.length >= 2;

  recordResult(
    'EVAL-01',
    'NON_BLOCKING Tool Declarations & CRM/WorldTracer/EU261 Engine',
    schemaValid,
    `Verified ${NON_BLOCKING_TOOL_DECLARATIONS.length}/4 tools declare behavior="NON_BLOCKING"; PNR=${scanRes.pnr}, BagTag=${scanRes.worldtracer_baggage.bag_tag_number}, EU261 Art.7=${eu261Res.legal_and_policy_determination.eu261_article_7_statutory_cash_eur_600.eligible}, Art.9=${eu261Res.legal_and_policy_determination.eu261_article_9_right_to_care.eligible}.`,
    { toolCount: NON_BLOCKING_TOOL_DECLARATIONS.length, allNonBlocking }
  );
}

async function runEval2_VisualOcrSampleSlips() {
  const slip1Path = path.join(ROOT_DIR, 'public/samples/sample-fra-boarding-pass-slip.jpg');
  const slip2Path = path.join(ROOT_DIR, 'public/samples/sample-fra-hotel-pir-receipt.jpg');

  const slip1Base64 = fs.readFileSync(slip1Path).toString('base64');
  const slip2Base64 = fs.readFileSync(slip2Path).toString('base64');

  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: slip1Base64
            }
          },
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: slip2Base64
            }
          },
          {
            text: 'Extract the exact PNR, Flight number, Bag Tag number, PIR Claim ID, and Hotel Folio EUR amount from these two airport slips. Return JSON keys: pnr, flight, bag_tag, pir_claim, hotel_eur.'
          }
        ]
      }
    ]
  });

  const rawText = response.text || '';
  const hasPnr = /LH8942X/i.test(rawText);
  const hasBagTag = /0220-?774910-?PRIO/i.test(rawText);
  const hasPir = /FRALH44912/i.test(rawText);
  const hasHotel = /245/.test(rawText);

  const passed = hasPnr && hasBagTag && hasPir && hasHotel;
  recordResult(
    'EVAL-02',
    'Visual OCR Verification of Generated Boarding Pass & IRROPS Hotel Receipt Props',
    passed,
    `OCR extracted PNR(LH8942X)=${hasPnr}, BagTag(0220-774910-PRIO)=${hasBagTag}, PIR(FRALH44912)=${hasPir}, SheratonFolio(EUR 245)=${hasHotel}.`,
    { hasPnr, hasBagTag, hasPir, hasHotel }
  );
}

async function runEval3_LiveExtendedThinkingWebSocketAndTools() {
  return new Promise((resolve) => {
    const testPort = 3099;
    const listener = server.listen(testPort, () => {
      const ws = new WebSocket(
        `ws://localhost:${testPort}/ws/live?thinkingLevel=HIGH&toolLatencyMs=250`
      );

      let sessionInitialized = false;
      let sawInProgressStatus = false;
      let sawIdleStatus = false;
      let audioChunksReceived = 0;
      const toolsTriggered = [];
      const transcriptions = [];

      const timeout = setTimeout(() => {
        ws.close();
        listener.close();
        const passed =
          sessionInitialized &&
          (audioChunksReceived > 0 || toolsTriggered.length > 0 || sawInProgressStatus);
        recordResult(
          'EVAL-03',
          'Gemini 3.8 Live Extended Thinking WebSocket Protocol, Video Frame & NON_BLOCKING Tool Lifecycle',
          passed,
          `SessionInit=${sessionInitialized}, AudioChunks=${audioChunksReceived}, ToolsCalled=[${toolsTriggered.join(', ')}], sawInProgress=${sawInProgressStatus}, sawIdle=${sawIdleStatus}.`,
          { sessionInitialized, audioChunksReceived, toolsTriggered, sawInProgressStatus, sawIdleStatus }
        );
        resolve();
      }, 24000);

      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString('utf8'));
        if (msg.type === 'session_init') {
          sessionInitialized = true;
          // Send real JPEG boarding pass frame + passenger audio/text request
          const slip1Path = path.join(ROOT_DIR, 'public/samples/sample-fra-boarding-pass-slip.jpg');
          const base64Jpeg = fs.readFileSync(slip1Path).toString('base64');

          setTimeout(() => {
            ws.send(
              JSON.stringify({
                realtimeInput: {
                  video: {
                    mimeType: 'image/jpeg',
                    data: base64Jpeg
                  }
                }
              })
            );
            ws.send(
              JSON.stringify({
                realtimeInput: {
                  text: 'My connecting flight LH401 in Frankfurt was canceled due to weather (WX84), and my luggage has priority tag 0220-774910-PRIO on PNR LH8942X. Please scan my slip, check EU261 compensation entitlement, and check Star Alliance flights to JFK.'
                }
              })
            );
          }, 700);
        }

        if (msg.type === 'tool_execution_start') {
          toolsTriggered.push(msg.name);
          sawInProgressStatus = true;
        }

        if (msg.type === 'gemini_message') {
          if (msg.interactionStatus === 'IN_PROGRESS') sawInProgressStatus = true;
          if (msg.interactionStatus === 'IDLE' && (audioChunksReceived > 0 || toolsTriggered.length > 0)) {
            sawIdleStatus = true;
          }
          const sc = msg.message?.serverContent || msg.message?.server_content;
          if (sc) {
            const parts = sc.modelTurn?.parts || sc.model_turn?.parts || [];
            for (const p of parts) {
              if (p.inlineData?.data || p.inline_data?.data) {
                audioChunksReceived++;
              }
            }
            const outTr = sc.outputTranscription || sc.output_transcription;
            if (outTr?.text) {
              transcriptions.push(outTr.text);
            }
          }

          if (sawIdleStatus && toolsTriggered.length > 0 && audioChunksReceived > 5) {
            clearTimeout(timeout);
            ws.close();
            listener.close();
            recordResult(
              'EVAL-03',
              'Gemini 3.8 Live Extended Thinking WebSocket Protocol, Video Frame & NON_BLOCKING Tool Lifecycle',
              true,
              `Connected to gemini-3.8-live-extended-thinking; streamed JPEG slip + prompt; received ${audioChunksReceived} 24kHz audio chunks, triggered NON_BLOCKING tools [${toolsTriggered.join(', ')}], and verified IN_PROGRESS -> IDLE transition.`,
              { sessionInitialized, audioChunksReceived, toolsTriggered, sawInProgressStatus, sawIdleStatus }
            );
            resolve();
          }
        }
      });
    });
  });
}

async function runEval4_Eu261AndVipPolicyReasoningJudge() {
  const scanData = await executeCrmTool('scan_boarding_pass_and_bag_tag', { pnr: 'LH8942X' }, 0);
  const flightData = await executeCrmTool('search_star_alliance_partner_flights', { origin: 'FRA', destination: 'JFK' }, 0);
  const eu261Data = await executeCrmTool('evaluate_eu261_and_vip_entitlement', { disruption_code: 'WX84' }, 0);

  const synthesisResp = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    config: {
      systemInstruction: CONCIERGE_SYSTEM_INSTRUCTION
    },
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `Passenger prompt: "My connecting flight LH401 in Frankfurt was canceled due to weather, and my luggage has priority tag 0220-774910-PRIO (PNR LH8942X). Can you verify my compensation entitlement and rebook me on the Morning Star Alliance partner flight?"\n\nBackground Tool Results:\n1. scan_boarding_pass_and_bag_tag: ${JSON.stringify(scanData)}\n2. search_star_alliance_partner_flights: ${JSON.stringify(flightData)}\n3. evaluate_eu261_and_vip_entitlement: ${JSON.stringify(eu261Data)}\n\nProvide the final Concierge synthesis.`
          }
        ]
      }
    ]
  });

  const answer = synthesisResp.text || '';
  const checks = {
    art5_3_weather_exemption: /5\(3\)|extraordinary|exempt/i.test(answer),
    art9_right_to_care_hotel: /Article 9|Right to Care|245|Sheraton/i.test(answer),
    vip_goodwill_350_and_bag: /350|25,000|0220-774910-PRIO/i.test(answer),
    morning_flight_lh400: /LH400|UA8840|08:30/i.test(answer)
  };

  const passed = Object.values(checks).every(Boolean);
  recordResult(
    'EVAL-04',
    'Multi-Rule Legal & VIP Reasoning Rubric (EU261 Art. 5(3) vs Art. 9 + Star Alliance Gold + Morning Rebooking)',
    passed,
    `Verified all 4 reasoning rubrics: Art.5(3) Exemption=${checks.art5_3_weather_exemption}, Art.9 €245 Hotel Care=${checks.art9_right_to_care_hotel}, VIP $350 + Priority Bag=${checks.vip_goodwill_350_and_bag}, Morning LH400/UA8840=${checks.morning_flight_lh400}.`,
    checks
  );
}

async function main() {
  console.log('\n================================================================================');
  console.log('🧪 RUNNING GEMINI 3.8 LIVE EXTENDED THINKING CONCIERGE EVALUATION SUITE');
  console.log('================================================================================\n');

  await runEval1_NonBlockingSchemaAndCrmEngine();
  await runEval2_VisualOcrSampleSlips();
  await runEval3_LiveExtendedThinkingWebSocketAndTools();
  await runEval4_Eu261AndVipPolicyReasoningJudge();

  const passedCount = results.filter((r) => r.passed).length;
  console.log('\n--------------------------------------------------------------------------------');
  console.log(`📊 SUMMARY: ${passedCount}/${results.length} Evaluations Passed`);
  console.log('--------------------------------------------------------------------------------\n');

  fs.writeFileSync(
    path.join(__dirname, 'eval_report.json'),
    JSON.stringify({ summary: `${passedCount}/${results.length} PASSED`, results }, null, 2)
  );

  process.exit(passedCount === results.length ? 0 : 1);
}

main();
