/**
 * Tier-3 Enterprise Contact Center Concierge — Non-Blocking Database & Policy Tools
 * for Gemini 3.8 Live Extended Thinking.
 *
 * Backed by `src/database_backend.js` (Google Cloud BigQuery + Firestore in project
 * `your-gcp-project-id` with persistent SQLite ACID relational synchronization).
 */

import {
  queryPnrAndBaggageFromDb,
  queryStarAllianceFlightsFromDb,
  queryEu261PolicyFromDb,
  commitRebookingTransactionToDb
} from './database_backend.js';

export const NON_BLOCKING_TOOL_DECLARATIONS = [
  {
    name: 'scan_boarding_pass_and_bag_tag',
    description:
      'Queries the Star Alliance Passenger Service System (BigQuery / SQLite `pnr_baggage_records` table) and WorldTracer baggage database using the PNR and priority baggage tag read from the live camera video stream.',
    behavior: 'NON_BLOCKING',
    parameters: {
      type: 'OBJECT',
      properties: {
        pnr: {
          type: 'STRING',
          description: '6-character Booking Reference / PNR read from the boarding pass held up to the camera (e.g., LH8942X).'
        },
        bag_tag_number: {
          type: 'STRING',
          description: 'Baggage claim tag number read from the orange priority slip on camera (e.g., 0220-774910-PRIO).'
        },
        disrupted_flight: {
          type: 'STRING',
          description: 'Canceled or disrupted flight number shown on the boarding pass (e.g., LH401).'
        },
        pir_claim_id: {
          type: 'STRING',
          description: 'Optional Property Irregularity Report claim reference (e.g., FRALH44912).'
        }
      },
      required: ['pnr']
    }
  },
  {
    name: 'search_star_alliance_partner_flights',
    description:
      'Queries the `star_alliance_flight_inventory` database table for available Star Alliance partner codeshare flights (Lufthansa, United Airlines) from Frankfurt (FRA) to New York (JFK/EWR) across Morning and Evening departure windows.',
    behavior: 'NON_BLOCKING',
    parameters: {
      type: 'OBJECT',
      properties: {
        origin: {
          type: 'STRING',
          description: 'Origin IATA airport code (default: FRA).'
        },
        destination: {
          type: 'STRING',
          description: 'Destination IATA airport code (e.g., JFK or EWR).'
        },
        time_preference: {
          type: 'STRING',
          description: 'Preferred departure window: ALL, MORNING, or EVENING.'
        },
        cabin_class: {
          type: 'STRING',
          description: 'Cabin class (e.g., BUSINESS, FIRST).'
        }
      },
      required: ['origin', 'destination']
    }
  },
  {
    name: 'evaluate_eu261_and_vip_entitlement',
    description:
      'Queries the `eu261_policy_rules` database table to determine EU261 statutory cash eligibility (Article 7 vs Article 5(3) weather exemption), mandatory EU261 Article 9 Right to Care (hotel/meals), and Star Alliance Gold / 1K VIP goodwill compensation.',
    behavior: 'NON_BLOCKING',
    parameters: {
      type: 'OBJECT',
      properties: {
        disruption_code: {
          type: 'STRING',
          description: 'Disruption reason code read from the boarding pass/slip (e.g., WX84 Weather).'
        },
        vip_tier: {
          type: 'STRING',
          description: 'Passenger loyalty status (e.g., STAR_ALLIANCE_GOLD, UA_1K, LH_SENATOR).'
        },
        hotel_receipt_amount_eur: {
          type: 'NUMBER',
          description: 'Hotel folio expense in EUR if shown on receipt (default: 245.00).'
        }
      },
      required: ['disruption_code']
    }
  },
  {
    name: 'issue_rebooking_and_compensation_package',
    description:
      'Writes a transactional rebooking record to the `rebooking_transactions` database / Firestore collection, updates `pnr_baggage_records` to REBOOKED_CONFIRMED, transfers the priority bag in WorldTracer, and issues the EU261 Article 9 hotel reimbursement + $350 VIP Goodwill voucher.',
    behavior: 'NON_BLOCKING',
    parameters: {
      type: 'OBJECT',
      properties: {
        pnr: {
          type: 'STRING',
          description: 'Booking reference PNR (e.g., LH8942X).'
        },
        selected_flight_number: {
          type: 'STRING',
          description: 'Selected replacement Star Alliance flight (e.g., LH400 / UA8840 or LH404).'
        },
        departure_window: {
          type: 'STRING',
          description: 'Selected departure window (MORNING or EVENING).'
        },
        assigned_seat: {
          type: 'STRING',
          description: 'Assigned Business Class seat (e.g., 04A Window or 03D Aisle).'
        },
        bag_tag_number: {
          type: 'STRING',
          description: 'Priority bag tag number to transfer automatically (e.g., 0220-774910-PRIO).'
        }
      },
      required: ['pnr', 'selected_flight_number']
    }
  }
];

export async function executeCrmTool(name, args = {}, simulateLatencyMs = 1200) {
  const startTime = Date.now();
  if (simulateLatencyMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, simulateLatencyMs));
  }

  let payload;

  switch (name) {
    case 'scan_boarding_pass_and_bag_tag':
      payload = await queryPnrAndBaggageFromDb(args.pnr, args.bag_tag_number);
      break;

    case 'search_star_alliance_partner_flights':
      payload = await queryStarAllianceFlightsFromDb(
        args.origin || 'FRA',
        args.destination || 'JFK',
        args.time_preference || 'ALL'
      );
      break;

    case 'evaluate_eu261_and_vip_entitlement':
      payload = await queryEu261PolicyFromDb(
        args.disruption_code || 'WX84',
        args.hotel_receipt_amount_eur || 245.0
      );
      break;

    case 'issue_rebooking_and_compensation_package':
      payload = await commitRebookingTransactionToDb(args);
      break;

    default:
      payload = {
        status: '404_UNKNOWN_TOOL',
        message: `Unknown tool: ${name}`
      };
  }

  return {
    ...payload,
    _execution_time_ms: Date.now() - startTime
  };
}

export const CONCIERGE_SYSTEM_INSTRUCTION = `You are "Aria", a Tier-3 Enterprise Contact Center VIP Concierge for Star Alliance (Lufthansa & United Airlines Executive Desk) powered by Gemini 3.8 Live Extended Thinking.
Speak strictly in clear, natural, professional English.

CRITICAL PROTOCOL FOR REAL-TIME CAMERA VISION & EXTENDED THINKING:
1. READING THE PHYSICAL PRINTED BOARDING PASS / RECEIPT FROM THE CAMERA STREAM:
   The passenger is streaming live camera video (\`realtimeInput.video\`) and will physically hold up a printed Lufthansa / Star Alliance boarding pass and orange priority baggage claim tag (or hotel receipt) to their webcam while speaking.
   - Read the visual details from the camera frames (e.g., Passenger MANIKANDAN / C, PNR LH8942X, Canceled Flight LH401 FRA to JFK, Reason Code WX84 Weather, Priority Bag Tag 0220-774910-PRIO, PIR Claim FRALH44912, Sheraton Frankfurt Hotel €245.00).
   - Immediately speak a natural conversational filler acknowledging that you see their boarding pass and priority baggage slip on camera ("I can see your boarding pass and Star Alliance priority baggage slip for PNR LH8942X right on camera. Let me query our Star Alliance flight inventory, WorldTracer baggage vault, and EU261 compensation rules in the background. In the meantime, do you prefer a morning departure or an evening one, and would you like a window or aisle seat?").
2. PARALLEL NON_BLOCKING DATABASE TOOLS:
   Trigger \`scan_boarding_pass_and_bag_tag\`, \`search_star_alliance_partner_flights\`, and \`evaluate_eu261_and_vip_entitlement\` asynchronously in the background while keeping the voice conversation active.
3. MULTI-RULE LEGAL & VIP POLICY SYNTHESIS:
   Once the database queries return:
   - Explain that because Flight LH401 was canceled due to severe weather (Code WX84), the €600 statutory cash penalty under **EU261 Article 7** is exempt under **Article 5(3) (Extraordinary Circumstances)**.
   - However, emphasize that **EU261 Article 9 ("Right to Care")** STILL legally mandates full reimbursement of their **€245.00 Sheraton Frankfurt Airport Hotel folio + €45.00 meals** even during weather disruptions.
   - Furthermore, because their boarding pass carries a **Star Alliance Gold / United 1K Priority Tag (0220-774910-PRIO)**, our VIP Executive Recovery policy grants a **$350 USD Goodwill Travel Voucher (plus 25,000 bonus miles)**, Lufthansa Senator Lounge access at Gate Z50, and automatic WorldTracer transfer of their priority bag.
4. TRANSACTIONAL REBOOKING:
   When the passenger confirms their preference (e.g., Morning departure LH400 / UA8840 at 08:30, Seat 04A), call \`issue_rebooking_and_compensation_package\` to commit the transaction to the database and read back their confirmed transaction ID and itinerary.`;
