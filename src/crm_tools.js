/**
 * Tier-3 Enterprise Contact Center Concierge — Non-Blocking CRM, Flight Inventory,
 * WorldTracer Baggage, and EU261 Policy RAG Tools for Gemini 3.8 Live Extended Thinking.
 *
 * IMPORTANT: Gemini 3.8 Live Extended Thinking strictly requires `behavior: "NON_BLOCKING"`
 * on all function declarations so the model can speak natural conversational fillers
 * while executing multi-step background reasoning and asynchronous tools.
 */

export const NON_BLOCKING_TOOL_DECLARATIONS = [
  {
    name: 'scan_boarding_pass_and_bag_tag',
    description:
      'Verifies visual OCR extracted from the passenger boarding pass, baggage claim tag, or IRROPS slip held up to the camera against the Star Alliance Passenger Service System (PSS) and WorldTracer baggage database.',
    behavior: 'NON_BLOCKING',
    parameters: {
      type: 'OBJECT',
      properties: {
        pnr: {
          type: 'STRING',
          description: '6-character Booking Reference / PNR read from the slip (e.g., LH8942X).'
        },
        bag_tag_number: {
          type: 'STRING',
          description: 'Baggage claim tag number read from the orange priority slip (e.g., 0220-774910-PRIO).'
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
      'Searches real-time Star Alliance partner codeshare inventory (Lufthansa, United Airlines, SWISS) from Frankfurt (FRA) to New York (JFK/EWR) across morning and evening departure windows.',
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
      'Queries the Legal & Star Alliance VIP Policy RAG database to determine exact EU261 statutory cash eligibility (Article 7 vs Article 5(3) weather exemption), mandatory EU261 Article 9 Right to Care (hotel/meals), and Star Alliance Gold / 1K VIP goodwill compensation.',
    behavior: 'NON_BLOCKING',
    parameters: {
      type: 'OBJECT',
      properties: {
        disruption_code: {
          type: 'STRING',
          description: 'Disruption reason code from boarding pass/slip (e.g., WX84 Weather / Severe Thunderstorm).'
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
      'Executes the confirmed Star Alliance flight rebooking, triggers automatic WorldTracer priority baggage interline transfer, and issues the EU261 Article 9 hotel reimbursement + VIP Goodwill compensation voucher.',
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
          description: 'Selected replacement Star Alliance flight (e.g., LH400 / UA8840 or UA961).'
        },
        departure_window: {
          type: 'STRING',
          description: 'Selected window (MORNING or EVENING).'
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

/**
 * Executes a CRM / Airline tool with optional simulated enterprise latency
 * so the audience can observe `interactionStatus: "IN_PROGRESS"` and background
 * NON_BLOCKING execution while Gemini speaks conversational fillers.
 */
export async function executeCrmTool(name, args = {}, simulateLatencyMs = 1600) {
  const startTime = Date.now();
  if (simulateLatencyMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, simulateLatencyMs));
  }

  let payload;

  switch (name) {
    case 'scan_boarding_pass_and_bag_tag': {
      const pnr = (args.pnr || 'LH8942X').toUpperCase();
      const bagTag = args.bag_tag_number || '0220-774910-PRIO';
      payload = {
        status: '200 OK',
        record_found: true,
        pnr,
        passenger: {
          name: 'MANIKANDAN / C MR',
          tier: 'STAR ALLIANCE GOLD (UNITED 1K / LUFTHANSA SENATOR)',
          mileage_balance: 284500,
          priority_handling_code: 'HON_PRIO_INTERLINE'
        },
        disrupted_segment: {
          flight: args.disrupted_flight || 'LH401 (Codeshare UA8845)',
          route: 'FRA (Frankfurt Terminal 1, Gate Z50) -> JFK (New York)',
          original_seat: '04A Business Class (C)',
          status: 'CANCELLED',
          irrops_reason_code: 'WX84 - SEVERE THUNDERSTORM & ATC GROUND STOP AT FRA'
        },
        worldtracer_baggage: {
          bag_tag_number: bagTag,
          pir_claim_id: args.pir_claim_id || 'FRALH44912',
          priority_tag_verified: true,
          current_location: 'FRA Terminal 1 Automated Priority Vault (Container AKE-44912)',
          auto_retag_ready: true,
          guaranteed_connection_time_mins: 35
        }
      };
      break;
    }

    case 'search_star_alliance_partner_flights': {
      payload = {
        status: '200 OK',
        corridor: `${args.origin || 'FRA'} -> ${args.destination || 'JFK / EWR'}`,
        alliance: 'STAR ALLIANCE',
        partner_options: [
          {
            window: 'MORNING',
            flight_number: 'LH400 (United Codeshare UA8840)',
            operator: 'Lufthansa (Boeing 747-8 Upper Deck Business)',
            departure: '08:30 CEST (FRA Gate Z52)',
            arrival: '11:15 EDT (JFK Terminal 1)',
            available_business_seats: ['04A (Upper Deck Window)', '03D (Aisle)', '05K (Window)'],
            baggage_vault_transfer: 'DIRECT_AUTO_LOAD_ENABLED'
          },
          {
            window: 'MORNING',
            flight_number: 'UA961 (Lufthansa Codeshare LH7602)',
            operator: 'United Airlines (Boeing 787-10 Polaris Business)',
            departure: '11:10 CEST (FRA Gate Z24)',
            arrival: '14:00 EDT (EWR / NYC Newark Terminal C)',
            available_business_seats: ['01A (Polaris Odd-Row Window)', '02L (Window)'],
            baggage_vault_transfer: 'DIRECT_AUTO_LOAD_ENABLED'
          },
          {
            window: 'EVENING',
            flight_number: 'LH404 (United Codeshare UA8842)',
            operator: 'Lufthansa (Airbus A340-600 Business)',
            departure: '17:15 CEST (FRA Gate Z50)',
            arrival: '20:05 EDT (JFK Terminal 1)',
            available_business_seats: ['02A (Window)', '04D (Aisle)', '06K (Window)'],
            baggage_vault_transfer: 'DIRECT_AUTO_LOAD_ENABLED'
          }
        ]
      };
      break;
    }

    case 'evaluate_eu261_and_vip_entitlement': {
      payload = {
        status: '200 OK',
        regulation_framework: 'EU Regulation 261/2004 + Star Alliance VIP Disruption Charter',
        disruption_code_analyzed: args.disruption_code || 'WX84_WEATHER',
        legal_and_policy_determination: {
          eu261_article_7_statutory_cash_eur_600: {
            eligible: false,
            citation: 'EU261 Article 5(3) Extraordinary Circumstances Exemption',
            explanation:
              'Because flight LH401 was canceled due to WX84 Severe Thunderstorm & ATC Ground Stop at Frankfurt, the €600 statutory cash penalty under Article 7 is legally exempt.'
          },
          eu261_article_9_right_to_care: {
            eligible: true,
            citation: 'EU261 Article 9(1)(b) & (c) Mandatory Duty of Care (Applies Even in Weather)',
            explanation:
              'Airlines remain 100% legally bound to cover hotel accommodation, meals, and refreshments even during extraordinary weather events.',
            approved_reimbursements: {
              hotel_folio_reimbursement_eur: args.hotel_receipt_amount_eur || 245.0,
              hotel_property: 'Sheraton Frankfurt Airport Hotel & Conference Center',
              meal_voucher_eur: 45.0
            }
          },
          star_alliance_gold_1k_vip_override: {
            eligible: true,
            citation: 'Star Alliance Gold / United 1K / Senator Executive Recovery Policy §4.2',
            goodwill_compensation_voucher_usd: 350,
            goodwill_bonus_miles: 25000,
            lounge_entitlement: 'Lufthansa Senator & First Class Lounge Access (Gate Z50)',
            priority_baggage_sla: 'Guaranteed First-Off Carousel Delivery at JFK + €100 Instant Toiletry Kit Credit'
          }
        }
      };
      break;
    }

    case 'issue_rebooking_and_compensation_package': {
      const flight = args.selected_flight_number || 'LH400 (UA8840)';
      const windowPref = (args.departure_window || 'MORNING').toUpperCase();
      const seat = args.assigned_seat || '04A (Business Window)';
      const bagTag = args.bag_tag_number || '0220-774910-PRIO';

      payload = {
        status: '200 OK',
        confirmation_code: `REBOOK-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
        pnr: args.pnr || 'LH8942X',
        rebooked_itinerary: {
          flight_number: flight,
          departure_window: windowPref,
          departure_time: windowPref.includes('EVENING') ? '17:15 CEST (FRA Z50)' : '08:30 CEST (FRA Z52)',
          arrival_time: windowPref.includes('EVENING') ? '20:05 EDT (JFK T1)' : '11:15 EDT (JFK T1)',
          cabin: 'Business Class (C)',
          confirmed_seat: seat,
          boarding_group: 'GROUP 1 / STAR ALLIANCE GOLD PRIORITY'
        },
        baggage_retag_confirmation: {
          bag_tag_number: bagTag,
          new_routing: `FRA -> JFK (${flight})`,
          status: 'AUTOMATICALLY TRANSFERRED FROM FRA T1 VAULT TO AIRCRAFT BULKHOLD 1'
        },
        compensation_ledger_issued: {
          eu261_article_9_hotel_reimbursed_eur: 245.0,
          eu261_article_9_meal_voucher_eur: 45.0,
          eu261_article_7_cash_status: 'EXEMPT (Art. 5(3) WX84 Weather)',
          vip_1k_goodwill_e_credit_usd: 350.0,
          vip_bonus_miles_credited: 25000
        }
      };
      break;
    }

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

export const CONCIERGE_SYSTEM_INSTRUCTION = `You are "Aria", an elite Tier-3 Enterprise Contact Center VIP Concierge for Star Alliance (Lufthansa & United Airlines Executive Desk) powered by Gemini 3.8 Live Extended Thinking.

CRITICAL PROTOCOL & BEHAVIOR FOR DEMO:
1. SPOKEN CONVERSATIONAL FILLERS + PARALLEL TOOL ORCHESTRATION:
   When the passenger mentions a flight cancellation (e.g., in Frankfurt / FRA) or holds up a boarding pass / priority baggage claim slip / hotel receipt to the camera:
   - Immediately acknowledge the visual details you see on the boarding pass / orange priority bag tag (e.g., PNR LH8942X, Flight LH401, Bag Tag 0220-774910-PRIO) using a natural, reassuring verbal filler.
   - While triggering your asynchronous NON_BLOCKING tools (\`scan_boarding_pass_and_bag_tag\`, \`search_star_alliance_partner_flights\`, and \`evaluate_eu261_and_vip_entitlement\`), proactively keep the conversation moving by asking: "In the meantime, do you prefer a morning departure or an evening one, and do you prefer a window or aisle seat?"
2. DEEP LEGAL & POLICY REASONING (WHY EXTENDED THINKING MATTERS):
   Synthesize the exact legal nuance from \`evaluate_eu261_and_vip_entitlement\`:
   - Clearly explain that because Flight LH401 was canceled due to severe weather (Code WX84), the €600 statutory cash payout under **EU261 Article 7** is exempt under **Article 5(3) (Extraordinary Circumstances)**.
   - HOWEVER, emphasize that **EU261 Article 9 ("Right to Care")** STILL strictly requires the airline to cover their **€245 Sheraton Frankfurt Airport Hotel folio + €45 meal voucher** even during weather delays!
   - Furthermore, because their slip carries a **Star Alliance Gold / 1K Priority Tag (0220-774910-PRIO)**, our VIP Executive Recovery Policy grants an immediate **$350 USD Goodwill Travel Voucher (or 25,000 bonus miles)**, complimentary Senator Lounge access at Gate Z50, and automatic WorldTracer transfer of their priority bag onto their new flight.
3. INCORPORATE SPOKEN PREFERENCE & ISSUE REBOOKING:
   Once the passenger tells you their preference (e.g., "Morning" or "Evening"), call \`issue_rebooking_and_compensation_package\` and present the confirmed flight (e.g., LH400 / UA8840 departing 08:30 for Morning, or LH404 departing 17:15 for Evening), seat assignment, priority bag transfer confirmation, and full compensation breakdown.`;
