require("dotenv").config();
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const locations = [
  ["East Jaintia Hills", "Meghalaya", 25.25, 92.48, 122436, 31.5],
  ["West Jaintia Hills", "Meghalaya", 25.45, 92.15, 132806, 47.6],
  ["Kamrup", "Assam", 26.19, 91.74, 1517956, 512.8],
  ["Cachar", "Assam", 24.83, 92.78, 1736617, 285.5],
  ["Imphal East", "Manipur", 24.82, 93.94, 456113, 329.7],
  ["Imphal West", "Manipur", 24.78, 93.77, 514683, 847.5],
  ["Udalguri", "Assam", 26.76, 92.09, 832769, 291.4],
  ["Lunglei", "Mizoram", 22.88, 92.73, 161428, 38.0],
];

const users = [
  ["Anita War", "9000000001", "ASHA", "East Jaintia Hills", "en"],
  ["Rohit Das", "9000000002", "PHC_OFFICER", "Kamrup", "en"],
  ["Lalrini Sailo", "9000000003", "ASHA", "Lunglei", "en"],
  ["Meera Devi", "9000000004", "STATE_ADMIN", "Cachar", "en"],
];

const waterReadings = [
  ["SEED-WQ-001", "East Jaintia Hills", 6.8, 25.4, 450, 6.8, 27.0],
  ["SEED-WQ-002", "West Jaintia Hills", 6.9, 18.2, 320, 5.4, 26.4],
  ["SEED-WQ-003", "Kamrup", 7.2, 8.6, 145, 3.6, 29.1],
  ["SEED-WQ-004", "Cachar", 6.7, 21.1, 510, 7.1, 28.2],
  ["SEED-WQ-005", "Imphal East", 7.4, 4.8, 42, 2.8, 25.7],
  ["SEED-WQ-006", "Udalguri", 6.6, 17.5, 390, 5.9, 28.6],
  ["SEED-WQ-007", "Lunglei", 7.5, 2.9, 18, 1.9, 24.5],
  ["SEED-WQ-008", "Imphal West", 7.3, 3.6, 25, 2.2, 25.2],
];

const reports = [
  ["East Jaintia Hills", "ADD", 283, 2, 35, 20, 5, 18, 2026],
  ["West Jaintia Hills", "ADD", 210, 1, 28, 15, 3, 18, 2026],
  ["Kamrup", "Cholera", 145, 0, 18, 11, 2, 18, 2026],
  ["Cachar", "ADD", 198, 1, 25, 14, 4, 18, 2026],
  ["Imphal East", "Dengue", 87, 0, 7, 3, 1, 18, 2026],
  ["Udalguri", "Cholera", 178, 2, 22, 16, 3, 18, 2026],
  ["Lunglei", "Dengue", 35, 0, 2, 1, 0, 18, 2026],
  ["Imphal West", "Malaria", 42, 0, 4, 2, 1, 18, 2026],
];

const predictions = [
  ["East Jaintia Hills", 86, "Critical", "ADD", 93],
  ["West Jaintia Hills", 72, "High", "ADD", 91],
  ["Kamrup", 58, "High", "Cholera", 88],
  ["Cachar", 69, "High", "ADD", 90],
  ["Imphal East", 36, "Medium", "Dengue", 82],
  ["Udalguri", 76, "Critical", "Cholera", 92],
  ["Lunglei", 18, "Low", "No Outbreak", 79],
  ["Imphal West", 24, "Low", "Malaria", 81],
];

const alerts = [
  ["East Jaintia Hills", "OUTBREAK", "critical", "[Seed] Acute Diarrhoeal Disease risk is critical. Deploy rapid response team."],
  ["Cachar", "WATER", "high", "[Seed] Fecal coliform exceeded safe limit. Issue boil-water advisory."],
  ["Kamrup", "WEATHER", "high", "[Seed] Extreme rainfall forecast for next 72 hours. Flood-linked disease risk elevated."],
  ["Udalguri", "OUTBREAK", "critical", "[Seed] Cholera cluster detected. ASHA workers should begin active case finding."],
  ["Imphal East", "SENSOR", "medium", "[Seed] IoT sensor reported intermittent turbidity readings."],
];

async function getLocationId(client, district) {
  const result = await client.query("SELECT location_id FROM locations WHERE district = $1 LIMIT 1", [district]);
  if (!result.rows.length) throw new Error(`Missing location: ${district}`);
  return result.rows[0].location_id;
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const location of locations) {
      await client.query(
        `INSERT INTO locations (district, state, latitude, longitude, population, density)
         SELECT $1, $2, $3, $4, $5, $6
         WHERE NOT EXISTS (SELECT 1 FROM locations WHERE district = $1 AND state = $2)`,
        location
      );
    }

    const passwordHash = await bcrypt.hash("password123", 10);
    const firstUserByDistrict = {};
    for (const [name, phone, role, district, language] of users) {
      const districtId = await getLocationId(client, district);
      const user = await client.query(
        `INSERT INTO users (name, phone, role, district_id, language_pref, password_hash)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (phone) DO UPDATE
           SET name = EXCLUDED.name,
               role = EXCLUDED.role,
               district_id = EXCLUDED.district_id,
               language_pref = EXCLUDED.language_pref
         RETURNING user_id`,
        [name, phone, role, districtId, language, passwordHash]
      );
      firstUserByDistrict[district] = user.rows[0].user_id;
    }

    for (const [sensorId, district, ph, turbidity, coliform, bod, temperature] of waterReadings) {
      const districtId = await getLocationId(client, district);
      await client.query(
        `INSERT INTO water_quality (sensor_id, district_id, ph, turbidity_ntu, fecal_coliform, bod_mg_l, temperature_c)
         SELECT $1, $2, $3, $4, $5, $6, $7
         WHERE NOT EXISTS (SELECT 1 FROM water_quality WHERE sensor_id = $1)`,
        [sensorId, districtId, ph, turbidity, coliform, bod, temperature]
      );
    }

    const fallbackUser = Object.values(firstUserByDistrict)[0];
    for (const [district, disease, cases, deaths, diarrhea, dehydration, jaundice, week, year] of reports) {
      const districtId = await getLocationId(client, district);
      await client.query(
        `INSERT INTO disease_reports
           (user_id, district_id, disease_type, cases, deaths, diarrhea_cnt, dehydration_cnt, jaundice_cnt, week_number, year, source)
         SELECT $1::uuid, $2::int, $3::varchar, $4::int, $5::int, $6::int, $7::int, $8::int, $9::int, $10::int, 'SEED'
         WHERE NOT EXISTS (
           SELECT 1 FROM disease_reports
           WHERE district_id = $2 AND disease_type = $3 AND week_number = $9 AND year = $10 AND source = 'SEED'
         )`,
        [firstUserByDistrict[district] || fallbackUser, districtId, disease, cases, deaths, diarrhea, dehydration, jaundice, week, year]
      );
    }

    for (const [district, score, level, disease, confidence] of predictions) {
      const districtId = await getLocationId(client, district);
      await client.query(
        `INSERT INTO ml_predictions (district_id, risk_score, risk_level, predicted_disease, confidence)
         SELECT $1::int, $2::numeric, $3::varchar, $4::varchar, $5::numeric
         WHERE NOT EXISTS (
           SELECT 1 FROM ml_predictions
           WHERE district_id = $1 AND risk_score = $2 AND risk_level = $3 AND predicted_disease = $4
         )`,
        [districtId, score, level, disease, confidence]
      );
    }

    for (const [district, type, severity, message] of alerts) {
      const districtId = await getLocationId(client, district);
      await client.query(
        `INSERT INTO alerts (district_id, alert_type, severity, message)
         SELECT $1, $2, $3, $4
         WHERE NOT EXISTS (SELECT 1 FROM alerts WHERE message = $4)`,
        [districtId, type, severity, message]
      );
    }

    await client.query("COMMIT");
    console.log("Seed data inserted successfully.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Seed failed:", error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
