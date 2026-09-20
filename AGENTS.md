# AGENTS.md — Project Context & Architectural Guide

## 1. Project Overview

**Repository**: `google-live-38-extended` (`gemini-38-live-extended-thinking-concierge`)  
**Domain**: Tier-3 Enterprise Airline Contact Center VIP Concierge (Star Alliance / Lufthansa / United 1K IRROPS Escalation)

> **Disclaimer**: All airline names, hotel brands, loyalty programs, flight numbers, PNRs, baggage records, and receipts in this project are **fictitious/synthetic and provided strictly for technical demonstration purposes**.

This project is an end-to-end reference architecture demonstrating **Gemini 3.8 Live Extended Thinking (`gemini-3.8-live-extended-thinking`)** alongside **`gemini-3.8-live`** (standard ultra-low-latency Live model without extended thinking) and **`gemini-3.8-flash`** (multimodal OCR and LLM rubric evaluation).

### Core Capabilities Demonstrated
1. **Continuous Hands-Free Live Video Stream (`realtimeInput.video` @ 1–2 FPS)**:
   - Streams live webcam JPEG frames over `BidiGenerateContent` WebSockets as soon as the upstream `setupComplete` handshake finishes.
   - Extracts passenger PNR (`LH8942X`), flight (`LH401`), priority baggage tag (`0220-774910-PRIO`), PIR claim (`FRALH44912`), and hotel folio amount (`EUR 245.00`) directly from printed airport documents held up to the camera—even when the user does not speak those identifiers aloud.
2. **Asynchronous Dual-Track Execution (`interaction_status` + Spoken Fillers)**:
   - **Track 1 (Immediate Spoken Conversational Filler)**: While `interaction_status` is `"IN_PROGRESS"`, the concierge ("Aria") immediately speaks a context-aware acknowledgment and asks clarifying questions (e.g., morning vs. evening departure, window vs. aisle seat) to eliminate dead air.
   - **Track 2 (Parallel Background Extended Thinking & `NON_BLOCKING` Tools)**: Concurrently executes 4 `behavior: "NON_BLOCKING"` tools backed by SQLite + BigQuery + Firestore and reconciles multi-clause legal policies (`thinkingConfig.thinkingLevel: "HIGH" | "MEDIUM" | "LOW"`).
3. **Multi-Clause Legal & VIP Policy Reasoning**:
   - Distinguishes between **EU261 Article 5(3)** (extraordinary weather `WX84` exempts the €600 Article 7 statutory cash penalty) and **EU261 Article 9** (mandatory "Right to Care" requires 100% reimbursement of the €245.00 Sheraton Frankfurt Hotel receipt + €45.00 meal voucher regardless of weather), combined with **Star Alliance Gold / United 1K / Senator** goodwill overrides ($350 USD voucher + 25,000 bonus miles + Senator Lounge access + automatic WorldTracer priority bag transfer).

---

## 2. Repository Structure & Key Files

| File / Directory | Purpose |
| :--- | :--- |
| [`server.js`](server.js) | Express HTTP server + `/ws/live` WebSocket proxy (`BidiGenerateContent` `v1alpha`). Implements environment-driven authentication gate (`/auth/login`, `/auth/logout`, `concierge_session` cookie + HTTP Basic Auth), `setupComplete` video frame gating, and concurrent `NON_BLOCKING` tool dispatch. |
| [`src/crm_tools.js`](src/crm_tools.js) | Declares the 4 `behavior: "NON_BLOCKING"` tool schemas (`scan_boarding_pass_and_bag_tag`, `search_star_alliance_partner_flights`, `evaluate_eu261_and_vip_entitlement`, `issue_rebooking_and_compensation_package`), system instructions (`CONCIERGE_SYSTEM_INSTRUCTION`), and tool execution handlers. |
| [`src/database_backend.js`](src/database_backend.js) | Dual-engine relational + cloud persistence layer. Runs parameterized ACID SQL queries (`SELECT`, `INSERT`, `UPDATE`) on local SQLite (`data/concierge_enterprise.db` in WAL mode) and automatically syncs with Google Cloud BigQuery (`star_alliance_concierge` in `US`) and Cloud Firestore (`concierge_rebookings` in `nam5`) when ADC is available. |
| [`src/seed_gcp_backend.js`](src/seed_gcp_backend.js) | CLI provisioning script (`npm run seed:gcp`) that creates and seeds the BigQuery dataset/tables and Firestore collection in `process.env.GCP_PROJECT_ID`. |
| [`public/index.html`](public/index.html) | Split-screen enterprise UI featuring a 440px live camera viewport, live model switcher (`gemini-3.8-live-extended-thinking` vs. `gemini-3.8-live`), `thinkingLevel` selector (`HIGH`/`MEDIUM`/`LOW`), FPS selector (`1 FPS`/`2 FPS`), real-time `interaction_status` telemetry HUD, and collapsible SQL/BigQuery/Firestore transaction logs. |
| [`public/samples/printable-demo-kit.html`](public/samples/printable-demo-kit.html) | Printable high-contrast airport prop kit (Lufthansa Boarding Pass + Priority Bag Tag `LH8942X`, Frankfurt IRROPS & Sheraton Hotel Receipt `EUR 245.00`, and Nano Banana architecture/sequence diagrams). |
| [`evals/run_evals.js`](evals/run_evals.js) | Automated 4-stage evaluation runner (`npm run eval`) testing schema & SQL integrity (`EVAL-01`), `gemini-3.8-flash` OCR accuracy (`EVAL-02`), live WebSocket video/audio/tool lifecycle (`EVAL-03`), and LLM-as-a-Judge policy rubric verification (`EVAL-04`). |
| [`evals/eval_report.json`](evals/eval_report.json) | Persisted JSON output of the 4-stage evaluation run (`4/4 PASSED`). Note: in `EVAL-03`, `sawInProgressStatus: true` and `sawIdleStatus: false` are recorded because the 24-second evaluation window captures session initialization, 60 streaming 24kHz audio chunks, and parallel `NON_BLOCKING` tool execution while the multi-tool spoken synthesis is still actively streaming. |
| [`Dockerfile`](Dockerfile) & [`.dockerignore`](.dockerignore) | Container image specification (`node:22-bookworm-slim` with `python3 make g++` for native Linux compilation of `better-sqlite3`). Excludes local macOS `node_modules/` to prevent `invalid ELF header` errors on Cloud Run. |
| `DEMO_TALKING_SCRIPT.md` | **Local-only** personal stage talking script. Explicitly listed in [`.gitignore`](.gitignore) and must **never** be committed or pushed to the public GitHub repository. |

---

## 3. Environment Variables & Configuration

Configure runtime settings via `.env` locally (copied from [`.env.example`](.env.example)) or via Cloud Run runtime environment variables:

```ini
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_LIVE_MODEL=gemini-3.8-live-extended-thinking
GEMINI_FLASH_MODEL=gemini-3.8-flash
GCP_PROJECT_ID=your-gcp-project-id
BQ_DATASET=star_alliance_concierge
APP_AUTH_USER=your_test_username_here
APP_AUTH_PASS=your_test_password_here
PORT=3080
```

### Authentication Protection Behavior (`server.js`)
- When **both** `APP_AUTH_USER` and `APP_AUTH_PASS` are defined in the environment:
  - Unauthenticated browser requests to `/` or static assets receive an HTTP `401` response rendering the built-in dark-themed Sign-In screen (`POST /auth/login`).
  - Unauthenticated requests to `/api/*` receive HTTP `401` with `WWW-Authenticate: Basic realm="Gemini 3.8 Live Concierge"`.
  - Unauthenticated WebSocket upgrade connections to `/ws/live` are rejected with close code `1008` (`Unauthorized`).
  - Authenticated sessions are maintained via an `HttpOnly` HMAC-signed cookie (`concierge_session`) or standard `Authorization: Basic ...` headers.
- When `APP_AUTH_USER` or `APP_AUTH_PASS` is unset (e.g., local development without auth vars), the app runs in open local mode so `npm run eval` and local testing work seamlessly.

---

## 4. Cloud Run Deployment Guidelines

When deploying or updating the service on Google Cloud Run:

1. **WebSocket & Session Affinity Flags**:
   Always include `--session-affinity` and `--timeout=3600` so bidirectional `/ws/live` streams are not prematurely terminated by the load balancer.
2. **Organization Policy & Public Login Gate Reachability**:
   In environments where `iam.allowedPolicyMemberDomains` blocks `allUsers` IAM bindings, use `--no-invoker-iam-check` on the Cloud Run service so external browsers can reach the application's built-in `/auth/login` gate:
   ```bash
   gcloud run deploy gemini-live-38-concierge \
     --source . \
     --region=us-central1 \
     --allow-unauthenticated \
     --no-invoker-iam-check \
     --session-affinity \
     --timeout=3600 \
     --set-env-vars="GEMINI_API_KEY=<KEY>,APP_AUTH_USER=<USER>,APP_AUTH_PASS=<PASS>,GCP_PROJECT_ID=<PROJECT_ID>"
   ```

---

## 5. Strict Security & Git Hygiene Rules for Agents

Whenever modifying or pushing changes in this repository, agents **MUST** enforce these rules:
1. **Zero Secrets in Git**: Never commit `.env`, `GEMINI_API_KEY`, `GITHUB_PAT`, or `APP_AUTH_USER` / `APP_AUTH_PASS` test credentials to any tracked file or commit message.
2. **No Hardcoded Real GCP Project IDs**: Always use `<YOUR_GCP_PROJECT_ID>` or `your-gcp-project-id` as the default fallback in source code and documentation; inject the real project ID strictly via `process.env.GCP_PROJECT_ID`.
3. **Never Push `DEMO_TALKING_SCRIPT.md`**: Keep `DEMO_TALKING_SCRIPT.md` in [`.gitignore`](.gitignore) as a local-only file.
4. **Preserve Accurate Evaluation Telemetry**: Ensure any documentation of `evals/eval_report.json` accurately reflects the recorded metrics (specifically that `EVAL-03` verifies `sawInProgressStatus: true` and `60` audio chunks + 3 `NON_BLOCKING` tools within the 24s window while `sawIdleStatus` is `false`).
