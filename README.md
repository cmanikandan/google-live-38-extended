# Tier-3 Enterprise Contact Center Concierge (`gemini-3.8-live-extended-thinking`)

An interactive **Split-Screen Multimodal Voice & Vision Demo** built for **Gemini 3.8 Live Extended Thinking** (`gemini-3.8-live-extended-thinking`) and **Gemini 3.8 Flash** (`gemini-3.8-flash`).

It demonstrates how an enterprise airline/fintech VIP concierge handles a complex Frankfurt (`FRA`) flight disruption (`LH401 -> JFK`, Weather Code `WX84`) by:
1. **Reading a Boarding Pass & Star Alliance Priority Baggage Claim Slip (`0220-774910-PRIO`) via Live Video/Camera (`realtimeInput.video`)**
2. **Speaking Immediate Conversational Fillers (`turnComplete: true` while `interaction_status: "IN_PROGRESS"`)** — eliminating awkward dead air while asking the passenger whether they prefer a **Morning** or **Evening** departure.
3. **Executing Asynchronous `NON_BLOCKING` Multi-Tool CRM & Legal RAG Calls (`behavior: "NON_BLOCKING"`) + Google Search Grounding** in parallel while the conversation continues.
4. **Synthesizing Multi-Rule Legal & VIP Nuance (`thinkingLevel: "HIGH"`)** — distinguishing **EU261 Article 5(3)** (weather exemption for the €600 statutory cash penalty) from **EU261 Article 9 ("Right to Care")** (mandatory €245 Sheraton Frankfurt Airport Hotel reimbursement + €45 meals even during weather) and applying the **Star Alliance Gold / United 1K VIP Override** ($350 goodwill travel credit + 25,000 bonus miles + automatic WorldTracer priority bag transfer).

---

## Architecture & Asynchronous Dual-Track Lifecycle (Nano Banana Diagrams)

### 1. System Topology (`gemini-3.8-live-extended-thinking` + `gemini-3.8-flash`)
![Tier-3 Enterprise Contact Center Concierge Architecture Topology](public/samples/architecture-topology-nano-banana.jpg)

### 2. Asynchronous Dual-Track Lifecycle (`interactionStatus: IN_PROGRESS -> IDLE`)
![Gemini 3.8 Live Extended Thinking Dual-Track Lifecycle Sequence Diagram](public/samples/extended-thinking-sequence-nano-banana.jpg)

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
* **Main Split-Screen Concierge App:** [http://localhost:3080](http://localhost:3080)
* **Printable / Camera-Ready Boarding Pass, Receipt & Architecture Kit:** [http://localhost:3080/samples/printable-demo-kit.html](http://localhost:3080/samples/printable-demo-kit.html)

### 3. Run the Automated Evaluation Suite
```bash
npm run eval
```
Runs 4 end-to-end evaluations (`evals/run_evals.js`):
- **EVAL-01**: Verifies `behavior: "NON_BLOCKING"` across all 4 CRM/WorldTracer/EU261 tool declarations and deterministic engine responses.
- **EVAL-02**: Verifies multimodal Visual OCR extraction via `gemini-3.8-flash` against the generated boarding pass (`public/samples/sample-fra-boarding-pass-slip.jpg`) and hotel receipt (`public/samples/sample-fra-hotel-pir-receipt.jpg`).
- **EVAL-03**: Connects a live WebSocket client to `gemini-3.8-live-extended-thinking`, streams the JPEG boarding pass frame via `realtimeInput.video` + escalation prompt, and validates `interaction_status` (`IN_PROGRESS` ➔ `IDLE`), native audio streaming, and `NON_BLOCKING` tool execution.
- **EVAL-04**: Grades the model's legal & VIP policy synthesis via `gemini-3.8-flash` against the 4 EU261 Article 5(3) vs. Article 9 + Star Alliance Gold rubrics.
