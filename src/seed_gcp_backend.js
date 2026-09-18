/**
 * Provisions and seeds the Google Cloud BigQuery dataset (`star_alliance_concierge`)
 * and Firestore collection (`concierge_rebookings`) in project `your-gcp-project-id`.
 *
 * Run after authenticating ADC (`gcloud auth application-default login`):
 *   npm run seed:gcp
 */

import { BigQuery } from '@google-cloud/bigquery';
import { Firestore } from '@google-cloud/firestore';
import dotenv from 'dotenv';

dotenv.config();

const projectId = process.env.GCP_PROJECT_ID || 'your-gcp-project-id';
const datasetId = process.env.BQ_DATASET || 'star_alliance_concierge';

async function seedGcpBackend() {
  console.log(`\n🌐 Provisioning BigQuery & Firestore in GCP Project: ${projectId}...`);
  const bq = new BigQuery({ projectId });
  const firestore = new Firestore({ projectId });

  // 1. Create Dataset
  const [dataset] = await bq.dataset(datasetId).get({ autoCreate: true, location: 'US' });
  console.log(`✅ BigQuery Dataset ready: ${dataset.id}`);

  // 2. Create & Seed PNR + WorldTracer Table
  const pnrQuery = `
    CREATE OR REPLACE TABLE \`${projectId}.${datasetId}.pnr_baggage_records\` AS
    SELECT
      'LH8942X' AS pnr,
      'MANIKANDAN / C MR' AS passenger_name,
      'STAR ALLIANCE GOLD (UNITED 1K / LUFTHANSA SENATOR)' AS vip_tier,
      284500 AS mileage_balance,
      'LH401 (Codeshare UA8845)' AS disrupted_flight,
      'FRA' AS origin,
      'JFK' AS destination,
      '04A Business Class (C)' AS original_seat,
      'CANCELLED' AS flight_status,
      'WX84 - SEVERE THUNDERSTORM & ATC GROUND STOP AT FRA' AS irrops_reason_code,
      '0220-774910-PRIO' AS bag_tag_number,
      'FRALH44912' AS pir_claim_id,
      TRUE AS priority_tag_verified,
      'FRA Terminal 1 Automated Priority Vault (Container AKE-44912)' AS current_bag_location,
      CAST(NULL AS STRING) AS rebooked_flight,
      CAST(NULL AS STRING) AS rebooked_seat,
      CURRENT_TIMESTAMP() AS updated_at
  `;
  await bq.query({ query: pnrQuery, labels: { datacloud: 'jetski' } });
  console.log(`✅ Seeded table: ${projectId}.${datasetId}.pnr_baggage_records`);

  // 3. Create & Seed Flight Inventory Table
  const flightQuery = `
    CREATE OR REPLACE TABLE \`${projectId}.${datasetId}.star_alliance_flight_inventory\` AS
    SELECT 'LH400-FRA-JFK' AS flight_id, 'MORNING' AS departure_window, 'LH400' AS flight_number, 'UA8840' AS codeshare_number,
           'Lufthansa (Boeing 747-8 Upper Deck Business)' AS operator, 'FRA' AS origin, 'JFK' AS destination,
           '08:30 CEST (FRA Gate Z52)' AS departure_time, '11:15 EDT (JFK Terminal 1)' AS arrival_time,
           'BUSINESS' AS cabin_class, '["04A (Upper Deck Window)", "03D (Aisle)", "05K (Window)"]' AS available_seats_json,
           3 AS seats_remaining, 'DIRECT_AUTO_LOAD_ENABLED' AS baggage_vault_transfer
    UNION ALL
    SELECT 'UA961-FRA-EWR', 'MORNING', 'UA961', 'LH7602',
           'United Airlines (Boeing 787-10 Polaris Business)', 'FRA', 'EWR',
           '11:10 CEST (FRA Gate Z24)', '14:00 EDT (EWR Newark Terminal C)',
           'BUSINESS', '["01A (Polaris Odd-Row Window)", "02L (Window)"]',
           2, 'DIRECT_AUTO_LOAD_ENABLED'
    UNION ALL
    SELECT 'LH404-FRA-JFK', 'EVENING', 'LH404', 'UA8842',
           'Lufthansa (Airbus A340-600 Business)', 'FRA', 'JFK',
           '17:15 CEST (FRA Gate Z50)', '20:05 EDT (JFK Terminal 1)',
           'BUSINESS', '["02A (Window)", "04D (Aisle)", "06K (Window)"]',
           4, 'DIRECT_AUTO_LOAD_ENABLED'
  `;
  await bq.query({ query: flightQuery, labels: { datacloud: 'jetski' } });
  console.log(`✅ Seeded table: ${projectId}.${datasetId}.star_alliance_flight_inventory`);

  // 4. Create & Seed EU261 Policy Table
  const eu261Query = `
    CREATE OR REPLACE TABLE \`${projectId}.${datasetId}.eu261_policy_rules\` AS
    SELECT
      'WX84' AS disruption_code,
      'EU Regulation 261/2004 + Star Alliance VIP Disruption Charter' AS regulation_framework,
      FALSE AS art7_cash_eligible,
      'EU261 Article 5(3) Extraordinary Circumstances Exemption' AS art7_citation,
      'Because flight LH401 was canceled due to WX84 Severe Thunderstorm & ATC Ground Stop at Frankfurt, the €600 statutory cash penalty under Article 7 is legally exempt.' AS art7_explanation,
      TRUE AS art9_care_eligible,
      'EU261 Article 9(1)(b) & (c) Mandatory Duty of Care (Applies Even in Weather)' AS art9_citation,
      245.0 AS art9_max_hotel_eur,
      45.0 AS art9_meal_voucher_eur,
      350.0 AS vip_goodwill_voucher_usd,
      25000 AS vip_bonus_miles,
      'Lufthansa Senator & First Class Lounge Access (Gate Z50)' AS vip_lounge_access
  `;
  await bq.query({ query: eu261Query, labels: { datacloud: 'jetski' } });
  console.log(`✅ Seeded table: ${projectId}.${datasetId}.eu261_policy_rules`);

  // 5. Seed Firestore initial document
  await firestore.collection('concierge_rebookings').doc('SEED_CHECK').set({
    initializedAt: new Date().toISOString(),
    projectId,
    status: 'READY'
  });
  console.log(`✅ Firestore collection ready: projects/${projectId}/databases/(default)/documents/concierge_rebookings\n`);
}

seedGcpBackend().catch((err) => {
  console.error(`⚠️ GCP Cloud Seed requires active ADC ('gcloud auth application-default login'): ${err.message}`);
  process.exit(1);
});
