# Tier-3 Enterprise Contact Center Concierge (`gemini-3.8-live-extended-thinking`)

An interactive **Split-Screen Continuous Video & Voice Concierge** built for **Gemini 3.8 Live Extended Thinking** (`gemini-3.8-live-extended-thinking`) and **Gemini 3.8 Flash** (`gemini-3.8-flash`).

It demonstrates how an enterprise airline/fintech VIP concierge handles a complex Frankfurt (`FRA`) flight disruption (`LH401 -> JFK`, Weather Code `WX84`) by:
1. **Continuous Live Camera Video Streaming (`realtimeInput.video` @ 1–2 FPS)**: Automatically starts the user's webcam on page load and streams live JPEG video frames continuously after the upstream `BidiGenerateContent` `setupComplete` handshake—no manual picture taking or snapshot clicks required. Gemini reads the printed Boarding Pass (`PNR: LH8942X`), Priority Bag Tag (`0220-774910-PRIO`), and Sheraton Frankfurt Hotel receipt (`EUR 245.00`) directly from the live video stream while the user speaks.
2. **Immediate Conversational Fillers (`turnComplete: true` while `interaction_status: "IN_PROGRESS"`)**: Eliminates dead air by immediately acknowledging the visual boarding pass on the video stream and asking the passenger whether they prefer a **Morning** or **Evening** departure while background database queries run.
3. **Asynchronous `NON_BLOCKING` Database Queries (`behavior: "NON_BLOCKING"`) + Google Search Grounding**: Executes real SQL queries and ACID rebooking transactions in parallel while the voice conversation continues.
4. **Multi-Rule Legal & VIP Nuance Synthesis (`thinkingLevel: "HIGH"`)**: Distinguishes **EU261 Article 5(3)** (weather exemption for the €600 statutory cash penalty) from **EU261 Article 9 ("Right to Care")** (mandatory €245 Sheraton Frankfurt Airport Hotel reimbursement + €45 meals even during weather) and applies the **Star Alliance Gold / United 1K VIP Override** ($350 goodwill travel credit + 25,000 bonus miles + automatic WorldTracer priority bag transfer).

---

## Architecture & Asynchronous Dual-Track Lifecycle (Nano Banana Diagrams)

### 1. System & Database Topology (`gemini-3.8-live-extended-thinking` + `BigQuery US` + `Firestore nam5`)
![Tier-3 Enterprise Contact Center Concierge Architecture Topology](public/samples/architecture-topology-nano-banana.jpg)

### 2. Asynchronous Dual-Track Lifecycle (`interactionStatus: IN_PROGRESS -> IDLE`)
![Gemini 3.8 Live Extended Thinking Dual-Track Lifecycle Sequence Diagram](public/samples/extended-thinking-sequence-nano-banana.jpg)

---

## Real Dual-Engine Database Backend & Regions (`src/database_backend.js`)

Instead of hardcoded static responses, the concierge tools execute real parameterized SQL (`SELECT`, `INSERT`, `UPDATE`) and transactional document writes via [`src/database_backend.js`](src/database_backend.js) and [`src/seed_gcp_backend.js`](src/seed_gcp_backend.js):

| Storage Layer | Resource / Table | Region / Location | Role in Concierge Tool Execution |
| :--- | :--- | :--- | :--- |
| **Google Cloud BigQuery** (`your-gcp-project-id`) | Dataset: `star_alliance_concierge`<br/>• `pnr_baggage_records`<br/>• `star_alliance_flight_inventory`<br/>• `eu261_policy_rules` | **`US` Multi-Region** (`location: 'US'`) | Cloud analytical & operational store for PNR/WorldTracer lookup, Star Alliance seat inventory, and EU261 legal rules (`@google-cloud/bigquery`). |
| **Google Cloud Firestore** (`your-gcp-project-id`) | Collection: `concierge_rebookings`<br/>(`projects/your-gcp-project-id/databases/(default)/documents/concierge_rebookings`) | **`nam5` (`us-central1` Multi-Region)** | Cloud document store for issued rebooking transactions (`TXN-...`), hotel reimbursements, and VIP goodwill vouchers (`@google-cloud/firestore`). |
| **Synchronized Local SQLite ACID Store** | `data/concierge_enterprise.db` (`better-sqlite3`, WAL mode) | **Local Persistent Disk (`data/concierge_enterprise.db`)** | Always-on local relational SQL engine that executes every parameterized `SELECT`, `INSERT`, and `UPDATE` in real time and automatically syncs with BigQuery (`US`) and Firestore (`nam5`) when `gcloud` Application Default Credentials (ADC) are active. |

### Provisioning / Syncing Remote BigQuery (`US`) & Firestore (`nam5`) Tables
If your workstation's `gcloud` Application Default Credentials (ADC) token needs refreshing, run:
```bash
gcloud auth application-default login
gcloud config set project your-gcp-project-id
npm run seed:gcp
```
Even before running `gcloud auth application-default login`, `src/database_backend.js` executes 100% real SQL queries and ACID transactions against `data/concierge_enterprise.db` (inspectable live at [`http://localhost:3080/api/db-state`](http://localhost:3080/api/db-state)).

---

## Visual Demo Props (Generated with Nano Banana)

| Prop 1: Boarding Pass & Priority Baggage Tag (`LH8942X`) | Prop 2: Frankfurt IRROPS & Sheraton Hotel Receipt (`EUR 245.00`) |
| :---: | :---: |
| ![Boarding Pass & Priority Bag Slip](public/samples/sample-fra-boarding-pass-slip.jpg) | ![Frankfurt IRROPS & Sheraton Hotel Receipt](public/samples/sample-fra-hotel-pir-receipt.jpg) |

---

## Quick Start

### 1. Configure Environment
```bash
cp .env.example .env
# Add your GEMINI_API_KEY in .env
npm install
```

### 2. Start the Concierge Demo Server
```bash
npm start
```
* **Main Split-Screen Concierge App (Auto-Starts Webcam Stream):** [http://localhost:3080](http://localhost:3080)
* **Live Database Table & Transaction State JSON:** [http://localhost:3080/api/db-state](http://localhost:3080/api/db-state)
* **Printable / Camera-Ready Boarding Pass, Receipt & Architecture Kit:** [http://localhost:3080/samples/printable-demo-kit.html](http://localhost:3080/samples/printable-demo-kit.html)

### 3. Run the Automated Evaluation Suite
```bash
npm run eval
```
Runs 4 end-to-end evaluations (`evals/run_evals.js`):
- **EVAL-01**: Verifies `behavior: "NON_BLOCKING"` across all 4 CRM/WorldTracer/EU261 tool declarations and SQL database execution responses.
- **EVAL-02**: Verifies multimodal Visual OCR extraction via `gemini-3.8-flash` against the generated boarding pass (`public/samples/sample-fra-boarding-pass-slip.jpg`) and hotel receipt (`public/samples/sample-fra-hotel-pir-receipt.jpg`).
- **EVAL-03**: Connects a live WebSocket client to `gemini-3.8-live-extended-thinking`, streams the JPEG boarding pass frame via `realtimeInput.video` + escalation prompt, and validates `interaction_status` (`IN_PROGRESS` ➔ `IDLE`), native audio streaming, and `NON_BLOCKING` tool execution.
- **EVAL-04**: Grades the model's legal & VIP policy synthesis via `gemini-3.8-flash` against the 4 EU261 Article 5(3) vs. Article 9 + Star Alliance Gold rubrics.
