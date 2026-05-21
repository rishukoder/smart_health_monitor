require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const { Pool } = require('pg');
const axios   = require('axios');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const twilio = require('twilio');
const smsClient = process.env.TWILIO_SID
  ? twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN)
  : null;
const app  = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.use(cors());
app.use(express.json());

// ── Auth middleware
function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ── Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Smart Health Monitor API running' });
});

// ── Get all districts with latest risk score
app.get('/api/districts', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT l.*, p.risk_score, p.risk_level, p.predicted_disease
            FROM locations l
            LEFT JOIN LATERAL (
                SELECT * FROM ml_predictions
                WHERE district_id = l.location_id
                ORDER BY created_at DESC LIMIT 1
            ) p ON true
            ORDER BY p.risk_score DESC NULLS LAST
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Get latest water quality readings
app.get('/api/water', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT w.*, l.district
            FROM water_quality w
            JOIN locations l ON w.district_id = l.location_id
            ORDER BY w.recorded_at DESC LIMIT 50
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Get recent alerts
app.get('/api/alerts', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT a.*, l.district
            FROM alerts a
            JOIN locations l ON a.district_id = l.location_id
            ORDER BY a.sent_at DESC LIMIT 20
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Submit disease report + trigger ML prediction (requires login)
app.post('/api/reports', auth, async (req, res) => {
    try {
        const {
            district_id, cases, diarrhea_cnt,
            dehydration_cnt, jaundice_cnt,
            week_number, year,
            ph, turbidity_ntu, fecal_coliform
        } = req.body;

        // Save report WITH the logged-in ASHA worker's user_id
        const report = await pool.query(
            `INSERT INTO disease_reports
             (user_id, district_id, cases, diarrhea_cnt,
              dehydration_cnt, jaundice_cnt, week_number, year, source)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'APP')
             RETURNING *`,
            [req.user.id, district_id, cases,
             diarrhea_cnt, dehydration_cnt, jaundice_cnt,
             week_number, year]
        );

        // Save water quality reading linked to same ASHA worker
        if (ph) {
            await pool.query(
                `INSERT INTO water_quality
                 (sensor_id, district_id, ph, turbidity_ntu, fecal_coliform)
                 VALUES ($1,$2,$3,$4,$5)`,
                [`ASHA-${req.user.id.substring(0, 8)}`,
                 district_id, ph, turbidity_ntu, fecal_coliform || 0]
            );
        }

        // Call ML service for prediction
// Get current week and month
const now       = new Date();
const weekOfYear= Math.ceil((((now - new Date(now.getFullYear(),0,1)) / 86400000) + 1) / 7);
const month     = now.getMonth() + 1;
const quarter   = Math.ceil(month / 3);

const pred = await axios.post(process.env.ML_SERVICE_URL + '/predict', {
    // Water quality
    ph:                   ph || 7.0,
    turbidity_ntu:        turbidity_ntu || 5,
    fecal_coliform:       fecal_coliform || 0,
    bod_mg_l:             req.body.bod_mg_l || 2.0,
    // Symptoms
    diarrhea_cases:       diarrhea_cnt || 0,
    dehydration_cases:    dehydration_cnt || 0,
    jaundice_cases:       jaundice_cnt || 0,
    // Rainfall
    rainfall_mm:          req.body.rainfall_mm || 0,
    rainfall_lag1:        req.body.rainfall_lag1 || 0,
    rainfall_lag2:        req.body.rainfall_lag2 || 0,
    rainfall_4w_avg:      req.body.rainfall_4w_avg || 0,
    // Weather
    temperature_c:        req.body.temperature_c || 25,
    humidity_pct:         req.body.humidity_pct || 70,
    monsoon_flag:         req.body.monsoon_flag || 0,
    flood_risk_score:     req.body.flood_risk_score || 0.1,
    // Sanitation
    population_density:   req.body.population_density || 400,
    open_defecation_pct:  req.body.open_defecation_pct || 35,
    handwashing_pct:      req.body.handwashing_pct || 50,
    sanitation_pct:       req.body.sanitation_pct || 65,
    // Temporal
    week_of_year:         weekOfYear,
    month:                month,
    quarter:              quarter,
});
        // Save prediction to DB
        await pool.query(
            `INSERT INTO ml_predictions
             (district_id, risk_score, risk_level, predicted_disease, confidence)
             VALUES ($1,$2,$3,$4,$5)`,
            [district_id, pred.data.risk_score, pred.data.risk_level,
             pred.data.predicted_disease, 95]
        );

        // Create alert if risk is high
        if (pred.data.risk_score >= 50) {
            // Save alert to database
            await pool.query(
            `INSERT INTO alerts (district_id, alert_type, severity, message)
            VALUES ($1,'OUTBREAK',$2,$3)`,
            [district_id,
            pred.data.risk_level.toLowerCase(),
            `Risk ${pred.data.risk_score}/100 — ${pred.data.predicted_disease} — reported by ASHA worker`]
        );

        // Send real SMS via Twilio
        if (smsClient) {
            try {
            await smsClient.messages.create({
                body: `HEALTH ALERT - Risk ${pred.data.risk_score}/100 (${pred.data.risk_level}). Disease: ${pred.data.predicted_disease}. Immediate action needed.`,
                from: process.env.TWILIO_FROM,
                to:   process.env.TWILIO_TO
            });
            console.log('✅ SMS sent successfully');
            } catch (smsErr) {
            console.log('⚠ SMS failed:', smsErr.message);
            }
        }
        }


        res.json({
            success:    true,
            report:     report.rows[0],
            prediction: pred.data
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Add water quality reading manually
app.post('/api/water', async (req, res) => {
    try {
        const { sensor_id, district_id, ph, turbidity_ntu,
                fecal_coliform, bod_mg_l, temperature_c } = req.body;
        await pool.query(
            `INSERT INTO water_quality
             (sensor_id, district_id, ph, turbidity_ntu,
              fecal_coliform, bod_mg_l, temperature_c)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [sensor_id, district_id, ph, turbidity_ntu,
             fecal_coliform, bod_mg_l, temperature_c]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/register — create new ASHA worker account
app.post('/api/register', async (req, res) => {
    try {
        const { name, phone, password, role, district_id } = req.body;
        const hash = await bcrypt.hash(password, 10);
        const result = await pool.query(
            `INSERT INTO users (name, phone, password_hash, role, district_id)
             VALUES ($1,$2,$3,$4,$5)
             RETURNING user_id, name, phone, role`,
            [name, phone, hash, role || 'ASHA', district_id || 1]
        );
        res.json({ success: true, user: result.rows[0] });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// ── POST /api/login — login and get JWT token
app.post('/api/login', async (req, res) => {
    try {
        const { phone, password } = req.body;
        const result = await pool.query(
            `SELECT u.*, l.district FROM users u
             LEFT JOIN locations l ON u.district_id = l.location_id
             WHERE u.phone = $1`,
            [phone]
        );
        if (!result.rows.length)
            return res.status(401).json({ error: 'Phone number not found' });

        const user  = result.rows[0];
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid)
            return res.status(401).json({ error: 'Wrong password' });

        const token = jwt.sign(
            { id: user.user_id, name: user.name,
              role: user.role, district: user.district },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );
        res.json({
            success: true,
            token,
            user: { name: user.name, role: user.role, district: user.district }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/stats — real-time stats for live charts
app.get('/api/stats', async (req, res) => {
    try {
        const reports = await pool.query(`
            SELECT l.district,
                   SUM(r.diarrhea_cnt)    as diarrhea,
                   SUM(r.dehydration_cnt) as dehydration,
                   SUM(r.jaundice_cnt)    as jaundice,
                   SUM(r.cases)           as total_cases,
                   COUNT(*)               as report_count
            FROM disease_reports r
            JOIN locations l ON r.district_id = l.location_id
            GROUP BY l.district
            ORDER BY total_cases DESC
        `);

        const predictions = await pool.query(`
            SELECT l.district, p.risk_score, p.risk_level,
                   p.predicted_disease, p.created_at
            FROM ml_predictions p
            JOIN locations l ON p.district_id = l.location_id
            ORDER BY p.created_at DESC LIMIT 10
        `);

        const alerts = await pool.query(`
            SELECT COUNT(*) as total,
                   SUM(CASE WHEN severity='critical' THEN 1 ELSE 0 END) as critical,
                   SUM(CASE WHEN severity='high'     THEN 1 ELSE 0 END) as high,
                   SUM(CASE WHEN resolved_at IS NULL THEN 1 ELSE 0 END) as active
            FROM alerts
        `);

        const waterAvg = await pool.query(`
            SELECT ROUND(AVG(ph)::numeric,           2) as avg_ph,
                   ROUND(AVG(turbidity_ntu)::numeric, 1) as avg_turbidity,
                   ROUND(AVG(fecal_coliform)::numeric, 0) as avg_coliform
            FROM water_quality
            WHERE recorded_at > NOW() - INTERVAL '24 hours'
        `);

        res.json({
            timestamp:          new Date().toISOString(),
            district_stats:     reports.rows,
            recent_predictions: predictions.rows,
            alert_summary:      alerts.rows[0],
            water_avg_24h:      waterAvg.rows[0]
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/my-reports — ASHA worker sees only their own submitted reports
app.get('/api/my-reports', auth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT r.*, l.district,
                    p.risk_score, p.risk_level, p.predicted_disease
             FROM disease_reports r
             JOIN locations l ON r.district_id = l.location_id
             LEFT JOIN LATERAL (
                 SELECT * FROM ml_predictions
                 WHERE district_id = r.district_id
                 ORDER BY created_at DESC LIMIT 1
             ) p ON true
             WHERE r.user_id = $1
             ORDER BY r.submitted_at DESC LIMIT 20`,
            [req.user.id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/all-reports — officer/admin sees ALL reports with ASHA worker name
app.get('/api/all-reports', auth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT r.*,
                    l.district,
                    u.name  as asha_name,
                    u.phone as asha_phone,
                    p.risk_score, p.risk_level, p.predicted_disease
             FROM disease_reports r
             JOIN locations l ON r.district_id = l.location_id
             JOIN users     u ON r.user_id     = u.user_id
             LEFT JOIN LATERAL (
                 SELECT * FROM ml_predictions
                 WHERE district_id = r.district_id
                 ORDER BY created_at DESC LIMIT 1
             ) p ON true
             ORDER BY r.submitted_at DESC LIMIT 50`
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`✅ Backend API running on http://localhost:${PORT}`);
    console.log(`✅ Connected to ML service at ${process.env.ML_SERVICE_URL}`);
    console.log(`✅ Database: healthmonitor`);
});
