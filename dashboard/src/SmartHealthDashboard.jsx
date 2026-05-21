import { useState, useEffect, useRef } from "react";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  PieChart, Pie, Cell
} from "recharts";

const DISEASES_DATA = [
  { week: "W1", ADD: 160, Cholera: 12, Malaria: 8, Dengue: 5 },
  { week: "W5", ADD: 210, Cholera: 18, Malaria: 15, Dengue: 9 },
  { week: "W9", ADD: 310, Cholera: 45, Malaria: 22, Dengue: 18 },
  { week: "W13", ADD: 520, Cholera: 89, Malaria: 35, Dengue: 42 },
  { week: "W17", ADD: 780, Cholera: 145, Malaria: 58, Dengue: 67 },
  { week: "W21", ADD: 1120, Cholera: 220, Malaria: 45, Dengue: 95 },
  { week: "W25", ADD: 1450, Cholera: 310, Malaria: 38, Dengue: 120 },
  { week: "W29", ADD: 980, Cholera: 198, Malaria: 28, Dengue: 85 },
  { week: "W33", ADD: 620, Cholera: 110, Malaria: 20, Dengue: 52 },
  { week: "W37", ADD: 380, Cholera: 65, Malaria: 14, Dengue: 30 },
  { week: "W41", ADD: 220, Cholera: 32, Malaria: 10, Dengue: 18 },
  { week: "W45", ADD: 145, Cholera: 18, Malaria: 8, Dengue: 10 },
];

const WATER_QUALITY = [
  { month: "Jan", pH: 7.4, turbidity: 2.1, fecalColiform: 15, BOD: 1.8, risk: 12 },
  { month: "Feb", pH: 7.3, turbidity: 2.4, fecalColiform: 18, BOD: 2.0, risk: 15 },
  { month: "Mar", pH: 7.2, turbidity: 3.8, fecalColiform: 35, BOD: 2.8, risk: 28 },
  { month: "Apr", pH: 7.1, turbidity: 5.2, fecalColiform: 68, BOD: 3.5, risk: 42 },
  { month: "May", pH: 7.0, turbidity: 8.9, fecalColiform: 145, BOD: 4.2, risk: 58 },
  { month: "Jun", pH: 6.8, turbidity: 18.5, fecalColiform: 420, BOD: 6.8, risk: 78 },
  { month: "Jul", pH: 6.5, turbidity: 28.3, fecalColiform: 719, BOD: 8.2, risk: 92 },
  { month: "Aug", pH: 6.6, turbidity: 25.4, fecalColiform: 650, BOD: 7.5, risk: 88 },
  { month: "Sep", pH: 6.9, turbidity: 15.2, fecalColiform: 310, BOD: 5.4, risk: 70 },
  { month: "Oct", pH: 7.1, turbidity: 8.5, fecalColiform: 125, BOD: 3.8, risk: 45 },
  { month: "Nov", pH: 7.3, turbidity: 4.2, fecalColiform: 52, BOD: 2.5, risk: 28 },
  { month: "Dec", pH: 7.5, turbidity: 2.8, fecalColiform: 22, BOD: 1.9, risk: 16 },
];

const DISTRICTS = [
  { name: "East Jaintia Hills", state: "Meghalaya", risk: "High", cases: 283, disease: "ADD", lat: 25.25, lng: 92.48 },
  { name: "West Jaintia Hills", state: "Meghalaya", risk: "High", cases: 210, disease: "ADD", lat: 25.45, lng: 92.15 },
  { name: "Kamrup", state: "Assam", risk: "Medium", cases: 145, disease: "Cholera", lat: 26.19, lng: 91.74 },
  { name: "Cachar", state: "Assam", risk: "High", cases: 198, disease: "ADD", lat: 24.83, lng: 92.78 },
  { name: "Imphal East", state: "Manipur", risk: "Medium", cases: 87, disease: "Dengue", lat: 24.82, lng: 93.94 },
  { name: "Imphal West", state: "Manipur", risk: "Low", cases: 42, disease: "Malaria", lat: 24.78, lng: 93.77 },
  { name: "Udalguri", state: "Assam", risk: "High", cases: 178, disease: "ADD", lat: 26.76, lng: 92.09 },
  { name: "Lunglei", state: "Mizoram", risk: "Low", cases: 35, disease: "Dengue", lat: 22.88, lng: 92.73 },
];

const DISEASE_DIST = [
  { name: "Acute Diarrhoeal", value: 283, color: "#E24B4A" },
  { name: "Dengue", value: 110, color: "#EF9F27" },
  { name: "Malaria", value: 83, color: "#1D9E75" },
  { name: "Cholera", value: 49, color: "#7F77DD" },
  { name: "AES", value: 51, color: "#378ADD" },
  { name: "Others", value: 12, color: "#888780" },
];

const ALERTS = [
  { id: 1, time: "14:23", district: "East Jaintia Hills", type: "OUTBREAK", msg: "Acute Diarrhoeal Disease — 283 cases reported. Risk: CRITICAL", severity: "critical" },
  { id: 2, time: "12:45", district: "Cachar", type: "WATER", msg: "Fecal coliform 719 MPN/100ml — 14x WHO safe limit exceeded", severity: "high" },
  { id: 3, time: "11:30", district: "Kamrup", type: "WEATHER", msg: "Extreme rainfall forecast next 72h. Flood risk elevated.", severity: "high" },
  { id: 4, time: "09:15", district: "Udalguri", type: "OUTBREAK", msg: "Cholera cluster detected — 34 cases, 2 deaths. ASHA deployed.", severity: "critical" },
  { id: 5, time: "08:00", district: "Imphal East", type: "SENSOR",  severity: "medium" },
  { id: 6, time: "Yesterday", district: "West Jaintia Hills", type: "WATER", msg: "pH dropped to 6.2. Acidification event post-flooding.", severity: "medium" },
];

const RADAR_DATA = [
  { metric: "Water Safety", value: 45 },
  { metric: "Sanitation", value: 62 },
  { metric: "Rainfall Risk", value: 85 },
  { metric: "Population\nDensity", value: 70 },
  { metric: "Healthcare\nAccess", value: 38 },
  { metric: "Handwashing", value: 55 },
];

const ML_FEATURES = {
  symptoms: ["Diarrhea", "Dehydration", "Jaundice", "Fever", "Vomiting"],
  diseases: ["ADD (Acute Diarrhoeal)", "Cholera", "Malaria", "Dengue", "No Outbreak"],
};

const ARCH_LAYERS = [
  { label: "Mobile App / SMS Gateway", color: "#185FA5", items: [ "SMS", "ASHA Forms", "Multilingual UI"] },
  { label: "Backend API Layer", color: "#0F6E56", items: ["Node.js REST API", "Auth & RBAC", "Alert Engine"] },
  { label: "Data Storage Layer", color: "#534AB7", items: ["PostgreSQL", "TimescaleDB", "Redis Cache", "S3 Storage"] },
  { label: "AI/ML Engine", color: "#993C1D", items: ["XGBoost Model", "LSTM Forecasting", "Risk Scorer", "AutoML Pipeline"] },
  { label: "Output & Alerts", color: "#854F0B", items: ["SMS Alerts", "Govt Dashboard", "Push Notifications", "Health Reports"] },
];

const DB_SCHEMA = [
  { table: "users", fields: ["user_id PK", "name", "role (ASHA/Officer/Admin)", "district_id FK", "phone", "language"], color: "#185FA5" },
  { table: "disease_reports", fields: ["report_id PK", "user_id FK", "district_id FK", "disease_type", "cases", "deaths", "timestamp", "symptoms[]"], color: "#E24B4A" },
  { table: "water_quality", fields: ["sensor_id PK", "location_id FK", "ph", "turbidity_ntu", "fecal_coliform", "bod_mg_l", "timestamp", "source"], color: "#1D9E75" },
  { table: "alerts", fields: ["alert_id PK", "district_id FK", "alert_type", "severity", "message", "sent_at", "channels[]", "resolved"], color: "#EF9F27" },
  { table: "ml_predictions", fields: ["pred_id PK", "district_id FK", "risk_score", "disease_predicted", "confidence", "features_used", "created_at"], color: "#7F77DD" },
  { table: "locations", fields: ["location_id PK", "district", "state", "latitude", "longitude", "population", "density"], color: "#888780" },
];

const RISK_COLOR = { High: "#E24B4A", Medium: "#EF9F27", Low: "#1D9E75", Critical: "#A32D2D" };
const ML_SERVICE_URL = import.meta.env.VITE_ML_SERVICE_URL || "http://localhost:5001";

const getRiskDrivers = (inputs) => {
  const drivers = [
    { label: `Fecal coliform at ${inputs.fecalColiform} MPN/100ml`, score: inputs.fecalColiform / 8 },
    { label: `Weekly rainfall at ${inputs.rainfall} mm`, score: inputs.rainfall / 8 },
    { label: `Turbidity at ${inputs.turbidity} NTU`, score: inputs.turbidity * 2 },
    { label: `Diarrhea reports at ${inputs.diarrhea} cases`, score: inputs.diarrhea * 2 },
    { label: `Open defecation at ${inputs.openDefecation}%`, score: inputs.openDefecation },
    { label: `Handwashing coverage only ${inputs.handwashing}%`, score: 100 - inputs.handwashing },
    { label: `Water pH at ${inputs.ph}`, score: Math.abs(inputs.ph - 7) * 18 },
  ];

  return drivers
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((driver) => driver.label);
};

const formatPredictionResult = (prediction, inputs) => {
  const riskScore = Number(prediction.risk_score) || 0;
  const predictedDisease = prediction.predicted_disease || "No Outbreak";

  return {
    risk_level: prediction.risk_level || "Low",
    risk_score: riskScore,
    predicted_disease: predictedDisease,
    confidence: Math.round((prediction.outbreak_prob ?? riskScore / 100) * 100),
    key_drivers: getRiskDrivers(inputs),
    recommended_actions: [
      "Disinfect community water sources and issue boil-water guidance.",
      "Increase ASHA household visits for diarrhea, dehydration, and jaundice screening.",
      "Send ward-level alerts and prepare ORS, chlorine tablets, and rapid response kits.",
    ],
    alert_message: `${inputs.district}: ${prediction.risk_level || "Low"} risk for ${predictedDisease}. Risk score ${riskScore}/100. Begin water safety and surveillance actions.`,
    time_to_outbreak: riskScore >= 75 ? "1-3 days" : riskScore >= 50 ? "3-7 days" : riskScore >= 25 ? "7-14 days" : null,
  };
};

export default function App() {
  const [tab, setTab] = useState("overview");
  const [predicting, setPredicting] = useState(false);
  const [predResult, setPredResult] = useState(null);
  const [predError, setPredError] = useState(null);
  const [formData, setFormData] = useState({
    district: "East Jaintia Hills",
    rainfall: 700,
    ph: 6.8,
    turbidity: 25,
    fecalColiform: 450,
    diarrhea: 35,
    dehydration: 20,
    jaundice: 5,
    temperature: 27,
    humidity: 88,
    openDefecation: 32,
    handwashing: 48,
  });
  const [alertFilter, setAlertFilter] = useState("all");
  useEffect(() => {
  fetch("http://localhost:3001/api/districts")
    .then(r => r.json())
    .then(data => {
      if (data && data.length > 0) {
        setDistrictList(data.map(d => d.district));
      }
    })
    .catch(() => {
      // keep fallback hardcoded districts if API fails
    });
}, []);
  const [districtList, setDistrictList] = useState(DISTRICTS.map(d => d.name));
const [lstmDistrict, setLstmDistrict]     = useState("East Jaintia Hills");
const [lstmResult,   setLstmResult]       = useState(null);
const [lstmLoading,  setLstmLoading]      = useState(false);
const [lstmError,    setLstmError]        = useState(null);
const [xgbCurrent,   setXgbCurrent]      = useState(null);

 const handleLSTMForecast = async () => {
  setLstmLoading(true);
  setLstmResult(null);
  setLstmError(null);
  setXgbCurrent(null);

  try {
    // Step 1 — Get XGBoost current risk for comparison
    const xgbRes = await fetch("http://localhost:5001/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ph: 6.5, turbidity_ntu: 18, fecal_coliform: 350,
        diarrhea_cases: 18, dehydration_cases: 10, jaundice_cases: 1,
        rainfall_mm: 480, monsoon_flag: new Date().getMonth() >= 5 && new Date().getMonth() <= 8 ? 1 : 0,
        week_of_year: Math.ceil((((new Date()) - new Date(new Date().getFullYear(),0,1)) / 86400000) + 1) / 7,
        month: new Date().getMonth() + 1,
        quarter: Math.ceil((new Date().getMonth() + 1) / 3),
      }),
    });
    const xgbData = await xgbRes.json();
    setXgbCurrent(xgbData);

    // Step 2 — Get LSTM 4-week forecast
    const monsoon = new Date().getMonth() >= 5 && new Date().getMonth() <= 8 ? 1 : 0;
    const weeks = Array.from({ length: 8 }, (_, i) => ({
      ph:              6.2 + i * 0.1,
      turbidity_ntu:   30 - i * 1.5,
      fecal_coliform:  600 - i * 40,
      rainfall_mm:     650 - i * 30,
      monsoon_flag:    monsoon,
      diarrhea_cases:  25 - i * 1,
      dehydration_cases: 12,
      jaundice_cases:  2,
      population_density: 420,
      open_defecation_pct: 32,
      handwashing_pct: 48,
    }));

    const lstmRes = await fetch("http://localhost:5001/forecast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ district: lstmDistrict, weeks }),
    });
    const lstmData = await lstmRes.json();
    if (lstmData.error) throw new Error(lstmData.error);
    setLstmResult(lstmData);

  } catch (e) {
    setLstmError("Forecast failed: " + e.message);
  }
  setLstmLoading(false);
};
const prompt = `You are a Machine Learning Model for the Smart Health Monitoring System for rural Northeast India.

Given these real-time community health indicators for ${formData.district}, analyze and predict disease outbreak risk.

INPUT FEATURES:
- Rainfall (past week): ${formData.rainfall} mm
- Water pH: ${formData.ph}
- Water Turbidity: ${formData.turbidity} NTU
- Fecal Coliform: ${formData.fecalColiform} MPN/100ml
- Diarrhea cases reported: ${formData.diarrhea}
- Dehydration cases: ${formData.dehydration}
- Jaundice cases: ${formData.jaundice}
- Temperature: ${formData.temperature}°C
- Humidity: ${formData.humidity}%
- Open defecation rate: ${formData.openDefecation}%
- Handwashing with soap: ${formData.handwashing}%

Respond ONLY with a valid JSON object, no markdown, no extra text:
{
  "risk_level": "Low|Medium|High|Critical",
  "risk_score": 0-100,
  "predicted_disease": "disease name or No Outbreak",
  "confidence": 0-100,
  "key_drivers": ["top 3 contributing factors"],
  "recommended_actions": ["3 specific immediate actions"],
  "alert_message": "one-line SMS alert in simple English",
  "time_to_outbreak": "estimated days if no intervention or null"
}`;
const handlePredict = async () => {
  setPredicting(true);
  setPredResult(null);
  setPredError(null);
  try{
      const res = await fetch(`${ML_SERVICE_URL}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rainfall_mm: formData.rainfall,
          rainfall_4w_avg: Math.round(formData.rainfall * 0.72),
          ph: formData.ph,
          turbidity_ntu: formData.turbidity,
          fecal_coliform: formData.fecalColiform,
          diarrhea_cases: formData.diarrhea,
          dehydration_cases: formData.dehydration,
          jaundice_cases: formData.jaundice,
          temperature_c: formData.temperature,
          humidity_pct: formData.humidity,
          open_defecation_pct: formData.openDefecation,
          handwashing_pct: formData.handwashing,
          monsoon_flag: formData.rainfall >= 250 ? 1 : 0,
          flood_risk_score: Math.min(1, formData.rainfall / 800),
        }),
      });
      if (!res.ok) {
        const message = await res.text();
        throw new Error(message || `ML service returned ${res.status}`);
      }
      const data = await res.json();
      setPredResult(formatPredictionResult(data, formData));
    } catch (e) {
      setPredError(`Prediction failed: ${e.message}. Make sure the ML service is running at ${ML_SERVICE_URL}.`);
    }
    setPredicting(false);
  };

const tabs = [
  { id: "overview",      label: "Overview" },
  { id: "prediction",    label: "XGBoost Prediction Engine" },
  { id: "lstm",          label: "LSTM Forecast" },
  { id: "water",         label: "Water Quality" },
  { id: "alerts",        label: "Alert System" },
  { id: "architecture",  label: "Architecture & DB" },
];

  const filteredAlerts = alertFilter === "all" ? ALERTS : ALERTS.filter(a => a.severity === alertFilter || a.type === alertFilter.toUpperCase());

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: "var(--color-background-tertiary)", minHeight: "100vh", padding: "0" }}>
      <h2 className="sr-only">Smart Community Health Monitoring and Early Warning System for Water-Borne Diseases in Rural Northeast India</h2>

      {/* Header */}
      <div style={{ background: "var(--color-background-primary)", borderBottom: "0.5px solid var(--color-border-tertiary)", padding: "14px 24px", display: "flex", alignItems: "center", gap: "14px" }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#E24B4A", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="white"/>
          </svg>
        </div>
        <div>
          <div style={{ fontWeight: 500, fontSize: 15, color: "var(--color-text-primary)" }}>Smart Community Health Monitor</div>
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Northeast India — Early Warning System for Water-Borne Diseases</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 11, background: "#E24B4A20", color: "#E24B4A", padding: "3px 10px", borderRadius: 20, fontWeight: 500 }}>2 CRITICAL ALERTS</span>
          <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>Live • May 2026</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: "var(--color-background-primary)", borderBottom: "0.5px solid var(--color-border-tertiary)", padding: "0 24px", display: "flex", gap: 0 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: "none", border: "none", padding: "12px 16px", cursor: "pointer", fontSize: 13, fontWeight: 500,
            color: tab === t.id ? "#E24B4A" : "var(--color-text-secondary)",
            borderBottom: tab === t.id ? "2px solid #E24B4A" : "2px solid transparent",
            transition: "all 0.15s",
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ padding: "20px 24px" }}>

        {/* ===== OVERVIEW TAB ===== */}
        {tab === "overview" && (
          <div>
            {/* KPI Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
   	{[
  { label: "Total Cases (NE India)", value: "10,000", sub: "training records 2021–2025", color: "#E24B4A" },
  { label: "Districts Monitored", value: "82", sub: "across 8 NE states", color: "#185FA5" },
  { label: "Active Outbreaks", value: "5", sub: "ADD, Cholera, Malaria", color: "#EF9F27" },
  { label: "High Risk Districts", value: "12", sub: "immediate action needed", color: "#A32D2D" },
  { label: "ASHA Workers", value: "147", sub: "field reporters active", color: "#7F77DD" },
  { label: "Early Warning", value: "4 weeks", sub: "LSTM forecast horizon", color: "#1D9E75" },
].map(k => (
                <div key={k.label} style={{ background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", padding: "14px" }}>
                  <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 6 }}>{k.label}</div>
                  <div style={{ fontSize: 26, fontWeight: 500, color: k.color, lineHeight: 1 }}>{k.value}</div>
                  <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 4 }}>{k.sub}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              {/* Disease Trend */}
              <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "16px" }}>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, color: "var(--color-text-primary)" }}>Disease outbreak trends (2022 — NE India)</div>
                <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 12 }}>Weekly case counts by disease type</div>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={DISEASES_DATA} margin={{ top: 0, right: 8, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#88878020" />
                    <XAxis dataKey="week" tick={{ fontSize: 10, fill: "#888780" }} />
                    <YAxis tick={{ fontSize: 10, fill: "#888780" }} />
                    <Tooltip contentStyle={{ fontSize: 11, background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)" }} />
                    <Area type="monotone" dataKey="ADD" stroke="#E24B4A" fill="#E24B4A30" strokeWidth={2} />
                    <Area type="monotone" dataKey="Cholera" stroke="#7F77DD" fill="#7F77DD20" strokeWidth={2} />
                    <Area type="monotone" dataKey="Malaria" stroke="#1D9E75" fill="#1D9E7510" strokeWidth={1.5} />
                    <Area type="monotone" dataKey="Dengue" stroke="#EF9F27" fill="#EF9F2710" strokeWidth={1.5} />
                  </AreaChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
                  {[["ADD", "#E24B4A"], ["Cholera", "#7F77DD"], ["Malaria", "#1D9E75"], ["Dengue", "#EF9F27"]].map(([label, color]) => (
                    <span key={label} style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4, color: "var(--color-text-secondary)" }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: color, display: "inline-block" }} />{label}
                    </span>
                  ))}
                </div>
              </div>

              {/* Disease Distribution Pie */}
              <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "16px" }}>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, color: "var(--color-text-primary)" }}>Disease distribution — NE India 2022</div>
                <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 8 }}>588 total reported outbreak events</div>
                <ResponsiveContainer width="100%" height={170}>
                  <PieChart>
                    <Pie data={DISEASE_DIST} cx="50%" cy="50%" outerRadius={75} dataKey="value" label={({ name, percent }) => `${Math.round(percent * 100)}%`} labelLine={false} fontSize={10}>
                      {DISEASE_DIST.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                  {DISEASE_DIST.map(d => (
                    <span key={d.name} style={{ fontSize: 10, display: "flex", alignItems: "center", gap: 3, color: "var(--color-text-secondary)" }}>
                      <span style={{ width: 7, height: 7, borderRadius: 2, background: d.color, display: "inline-block" }} />{d.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* District Risk Table */}
            <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "16px" }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12, color: "var(--color-text-primary)" }}>District-level risk status — real-time monitoring</div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
                      {["District", "State", "Risk Level", "Cases", "Primary Disease", "Coordinates", "Action"].map(h => (
                        <th key={h} style={{ textAlign: "left", padding: "8px 10px", fontWeight: 500, color: "var(--color-text-secondary)", fontSize: 11 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {DISTRICTS.map((d, i) => (
                      <tr key={i} style={{ borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
                        <td style={{ padding: "10px 10px", fontWeight: 500, color: "var(--color-text-primary)" }}>{d.name}</td>
                        <td style={{ padding: "10px 10px", color: "var(--color-text-secondary)" }}>{d.state}</td>
                        <td style={{ padding: "10px 10px" }}>
                          <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 20, fontWeight: 500, background: RISK_COLOR[d.risk] + "20", color: RISK_COLOR[d.risk] }}>{d.risk}</span>
                        </td>
                        <td style={{ padding: "10px 10px", color: "var(--color-text-primary)" }}>{d.cases}</td>
                        <td style={{ padding: "10px 10px", color: "var(--color-text-secondary)" }}>{d.disease}</td>
                        <td style={{ padding: "10px 10px", color: "var(--color-text-tertiary)", fontFamily: "monospace", fontSize: 10 }}>{d.lat.toFixed(2)}°N, {d.lng.toFixed(2)}°E</td>
                        <td style={{ padding: "10px 10px" }}>
                          <button onClick={() => { setTab("prediction"); setFormData(f => ({ ...f, district: d.name })); }} style={{ fontSize: 10, padding: "4px 10px", borderRadius: "var(--border-radius-md)", cursor: "pointer" }}>Predict ↗</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ===== PREDICTION TAB ===== */}
        {tab === "prediction" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "16px", marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, color: "var(--color-text-primary)" }}>Prediction engine — XGBoost</div>
                <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 16 }}>Input real-time field data from ASHA workers and Medical Staff</div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>District</label>
                <select value={formData.district} onChange={e => setFormData(f => ({ ...f, district: e.target.value }))} style={{ width: "100%", fontSize: 12 }}>
                  {districtList.map(d => <option key={d}>{d}</option>)}
                </select>
                  </div>
                  {[
                    { key: "rainfall", label: "Weekly Rainfall (mm)", min: 0, max: 800, step: 10 },
                    { key: "ph", label: "Water pH", min: 5, max: 9, step: 0.1 },
                    { key: "turbidity", label: "Turbidity (NTU)", min: 0, max: 50, step: 1 },
                    { key: "fecalColiform", label: "Fecal Coliform (MPN/100ml)", min: 0, max: 800, step: 10 },
                    { key: "diarrhea", label: "Diarrhea Cases Reported", min: 0, max: 100, step: 1 },
                    { key: "dehydration", label: "Dehydration Cases", min: 0, max: 60, step: 1 },
                    { key: "jaundice", label: "Jaundice Cases", min: 0, max: 30, step: 1 },
                    { key: "temperature", label: "Avg Temperature (°C)", min: 18, max: 38, step: 0.5 },
                    { key: "humidity", label: "Humidity (%)", min: 40, max: 100, step: 1 },
                    { key: "openDefecation", label: "Open Defecation (%)", min: 0, max: 80, step: 1 },
                    { key: "handwashing", label: "Handwashing w/ Soap (%)", min: 10, max: 90, step: 1 },
                  ].map(({ key, label, min, max, step }) => (
                    <div key={key}>
                      <label style={{ fontSize: 11, color: "var(--color-text-secondary)", display: "block", marginBottom: 2 }}>{label}</label>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input type="range" min={min} max={max} step={step} value={formData[key]}
                          onChange={e => setFormData(f => ({ ...f, [key]: parseFloat(e.target.value) }))}
                          style={{ flex: 1 }} />
                        <span style={{ fontSize: 12, minWidth: 40, textAlign: "right", color: "var(--color-text-primary)" }}>{formData[key]}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <button onClick={handlePredict} disabled={predicting} style={{
                  width: "100%", marginTop: 16, padding: "10px", cursor: predicting ? "not-allowed" : "pointer",
                  background: predicting ? "var(--color-background-secondary)" : "#E24B4A", color: predicting ? "var(--color-text-secondary)" : "white",
                  border: "none", borderRadius: "var(--border-radius-md)", fontSize: 13, fontWeight: 500
                }}>
                  {predicting ? "Running prediction model..." : "Run Outbreak Prediction ↗"}
                </button>
              </div>

              {/* Radar chart */}
              <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "16px" }}>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, color: "var(--color-text-primary)" }}>Risk factor radar — East Jaintia Hills</div>
                <ResponsiveContainer width="100%" height={220}>
                  <RadarChart data={RADAR_DATA}>
                    <PolarGrid stroke="#88878030" />
                    <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: "#888780" }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9, fill: "#888780" }} />
                    <Radar dataKey="value" stroke="#E24B4A" fill="#E24B4A" fillOpacity={0.25} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div>
              {/* Result */}
              {predResult ? (
                <div style={{ background: "var(--color-background-primary)", border: `2px solid ${RISK_COLOR[predResult.risk_level] || "#888"}`, borderRadius: "var(--border-radius-lg)", padding: "20px", marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                    <div>
                      <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 4 }}>Predicted outbreak risk</div>
                      <div style={{ fontSize: 28, fontWeight: 500, color: RISK_COLOR[predResult.risk_level] }}>{predResult.risk_level}</div>
                      <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginTop: 2 }}>{predResult.predicted_disease}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>Risk Score</div>
                      <div style={{ fontSize: 36, fontWeight: 500, color: RISK_COLOR[predResult.risk_level] }}>{predResult.risk_score}</div>
                      <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>Confidence: {predResult.confidence}%</div>
                    </div>
                  </div>

                  {/* Score bar */}
                  <div style={{ height: 6, background: "var(--color-background-tertiary)", borderRadius: 3, marginBottom: 16, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${predResult.risk_score}%`, background: RISK_COLOR[predResult.risk_level], borderRadius: 3, transition: "width 0.6s ease" }} />
                  </div>

                  {predResult.time_to_outbreak && (
                    <div style={{ background: "#E24B4A10", border: "0.5px solid #E24B4A40", borderRadius: "var(--border-radius-md)", padding: "10px 12px", marginBottom: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 500, color: "#E24B4A" }}>Estimated time to outbreak (without intervention)</div>
                      <div style={{ fontSize: 18, fontWeight: 500, color: "#E24B4A", marginTop: 2 }}>{predResult.time_to_outbreak}</div>
                    </div>
                  )}

                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 6 }}>Key risk drivers</div>
                    {(predResult.key_drivers || []).map((d, i) => (
                      <div key={i} style={{ fontSize: 12, color: "var(--color-text-secondary)", padding: "4px 0", borderBottom: "0.5px solid var(--color-border-tertiary)", display: "flex", gap: 8, alignItems: "flex-start" }}>
                        <span style={{ color: "#E24B4A", fontWeight: 500, minWidth: 14 }}>{i + 1}.</span>{d}
                      </div>
                    ))}
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 6 }}>Recommended actions</div>
                    {(predResult.recommended_actions || []).map((a, i) => (
                      <div key={i} style={{ fontSize: 12, color: "var(--color-text-secondary)", padding: "5px 0", borderBottom: "0.5px solid var(--color-border-tertiary)", display: "flex", gap: 8, alignItems: "flex-start" }}>
                        <span style={{ color: "#1D9E75", fontWeight: 500, minWidth: 14 }}>✓</span>{a}
                      </div>
                    ))}
                  </div>

                  {predResult.alert_message && (
                    <div style={{ background: "#EF9F2715", border: "0.5px solid #EF9F2740", borderRadius: "var(--border-radius-md)", padding: "10px 12px" }}>
                      <div style={{ fontSize: 10, fontWeight: 500, color: "#854F0B", marginBottom: 4 }}>SMS ALERT TEXT (ready to send)</div>
                      <div style={{ fontSize: 12, color: "var(--color-text-primary)", fontStyle: "italic" }}>"{predResult.alert_message}"</div>
                    </div>
                  )}
                </div>
              ) : predError ? (
                <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: 20, color: "#E24B4A", fontSize: 12 }}>{predError}</div>
              ) : (
                <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: 40, textAlign: "center" }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>🔬</div>
                  <div style={{ fontSize: 13, color: "var(--color-text-secondary)", maxWidth: 240, margin: "0 auto" }}>Adjust the input parameters and click "Run Outbreak Prediction" to get risk analysis</div>
                </div>
              )}

              {/* ML Model Info */}
                   <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "16px" }}>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12, color: "var(--color-text-primary)" }}>ML model performance — training results</div>
                {[
                  { metric: "Accuracy", value: "90.85%", bar: 91 },
                  { metric: "Precision (Outbreak)", value: "95.0%", bar: 95 },
                  { metric: "Recall (Outbreak)", value: "86.0%", bar: 86},
                  { metric: "F1-Score", value: "90.4%", bar: 90 },
                  { metric: "AUC-ROC", value: "0.9727", bar: 97 },
                ].map(m => (
                  <div key={m.metric} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                      <span style={{ color: "var(--color-text-secondary)" }}>{m.metric}</span>
                      <span style={{ color: "var(--color-text-primary)", fontWeight: 500 }}>{m.value}</span>
                    </div>
                    <div style={{ height: 4, background: "var(--color-background-tertiary)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${m.bar}%`, background: "#1D9E75", borderRadius: 2 }} />
                    </div>
                  </div>
                ))}
                <div style={{ fontSize: 10, color: "var(--color-text-tertiary)", marginTop: 8 }}>Model: XGBoost • Dataset: 10,000 records • Features: 32 • Train/Test: 80/20 •CV AUC: 0.9585 </div>
              </div>
              {/* LSTM Model Performance */}
<div style={{
  background: "#1a1a1a",
  border: "1px solid #2a2a2a",
  borderLeft: "3px solid #185FA5",
  borderRadius: 10,
  padding: 16,
  marginTop: 12
}}>
  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: "#e8e3d9" }}>
    LSTM model performance — 4-week forecasting
  </div>

  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
    {[
      { label: "Accuracy",          value: "75.22%", color: "#EF9F27" },
      { label: "AUC-ROC",           value: "0.8560",  color: "#EF9F27" },
      { label: "Precision (Outbreak)", value: "90.0%", color: "#EF9F27" },
      { label: "Recall (Outbreak)",    value: "71.0%", color: "#EF9F27" },
    ].map((m, i) => (
      <div key={i} style={{
        background: "#111",
        borderRadius: 8,
        padding: "10px 14px",
        borderTop: `2px solid ${m.color}`
      }}>
        <div style={{ fontSize: 10, color: "#555", marginBottom: 4 }}>{m.label}</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: m.color }}>{m.value}</div>
      </div>
    ))}
  </div>

  <div style={{ fontSize: 11, color: "#555" }}>
    Model: LSTM (TensorFlow 2.21) • Sequence: 8 weeks • Forecast: 4 weeks • Features: 21
        </div>
          </div>
            </div>
          </div>
      )}

{/* ===== LSTM FORECAST TAB ===== */}
        {tab === "lstm" && (
          <div>
            {/* Header info */}
            <div style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:"var(--border-radius-lg)", padding:16, marginBottom:16, display:"flex", gap:16, alignItems:"flex-start" }}>
              <div style={{ width:44, height:44, borderRadius:"50%", background:"#185FA520", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>🔮</div>
              <div>
                <div style={{ fontSize:14, fontWeight:500, color:"var(--color-text-primary)", marginBottom:4 }}>LSTM — 4-Week Outbreak Risk Forecasting</div>
                <div style={{ fontSize:12, color:"var(--color-text-secondary)", lineHeight:1.6 }}>
                  LSTM (Long Short-Term Memory) analyses 8 consecutive weeks of district health data and predicts outbreak risk for the next 4 weeks.
                  Unlike XGBoost which answers <strong style={{color:"var(--color-text-primary)"}}>right now</strong>, LSTM answers <strong style={{color:"#185FA5"}}>what will happen next</strong>.
                </div>
              </div>
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>

              {/* Left — controls */}
              <div>
                <div style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:"var(--border-radius-lg)", padding:16, marginBottom:16 }}>
                  <div style={{ fontSize:13, fontWeight:500, color:"var(--color-text-primary)", marginBottom:12 }}>Select district to forecast</div>

                  <label style={{ fontSize:11, color:"var(--color-text-secondary)", display:"block", marginBottom:4 }}>District</label>
                  <select
                    value={lstmDistrict}
                    onChange={e => setLstmDistrict(e.target.value)}
                    style={{ width:"100%", fontSize:12, marginBottom:16, padding:"8px 10px", borderRadius:6, background:"var(--color-background-secondary)", border:"0.5px solid var(--color-border-tertiary)", color:"var(--color-text-primary)" }}
                  >
                    {districtList.map(d => <option key={d}>{d}</option>)}
                  </select>

                  <button
                    onClick={handleLSTMForecast}
                    disabled={lstmLoading}
                    style={{
                      width:"100%", padding:12, border:"none", borderRadius:8, cursor: lstmLoading ? "not-allowed" : "pointer",
                      background: lstmLoading ? "var(--color-background-secondary)" : "#185FA5",
                      color: lstmLoading ? "var(--color-text-secondary)" : "white",
                      fontSize:13, fontWeight:500,
                    }}
                  >
                    {lstmLoading ? "Running LSTM forecast..." : "Run 4-Week LSTM Forecast →"}
                  </button>
                </div>

                {/* How LSTM works */}
                <div style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:"var(--border-radius-lg)", padding:16 }}>
                  <div style={{ fontSize:13, fontWeight:500, color:"var(--color-text-primary)", marginBottom:12 }}>How LSTM works</div>
                  {[
                    { step:"1", title:"Reads 8 weeks of history", desc:"Collects pH, turbidity, fecal coliform, rainfall, symptom counts from last 8 weeks for the selected district" },
                    { step:"2", title:"Memory cells detect patterns", desc:"LSTM remembers patterns like — rainfall rising for 3 weeks means outbreak risk rises week 4" },
                    { step:"3", title:"Predicts next 4 weeks", desc:"Returns a risk score for each of the next 4 weeks with trend direction" },
                    { step:"4", title:"Enables early action", desc:"4 weeks advance warning gives health officers time to deploy ORS kits and chlorinate water before outbreak peaks" },
                  ].map(s => (
                    <div key={s.step} style={{ display:"flex", gap:10, padding:"8px 0", borderBottom:"0.5px solid var(--color-border-tertiary)" }}>
                      <div style={{ width:22, height:22, borderRadius:"50%", background:"#185FA5", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:600, color:"white", flexShrink:0 }}>{s.step}</div>
                      <div>
                        <div style={{ fontSize:12, fontWeight:500, color:"var(--color-text-primary)", marginBottom:2 }}>{s.title}</div>
                        <div style={{ fontSize:11, color:"var(--color-text-secondary)", lineHeight:1.5 }}>{s.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right — results */}
              <div>
                {lstmError && (
                  <div style={{ background:"var(--color-background-primary)", border:"0.5px solid #E24B4A60", borderRadius:"var(--border-radius-lg)", padding:16, color:"#E24B4A", fontSize:12, marginBottom:16 }}>
                    ❌ {lstmError}
                  </div>
                )}

                {lstmResult ? (
                  <div>
                    {/* Summary card */}
                    <div style={{ background:"var(--color-background-primary)", border:`2px solid ${RISK_COLOR[lstmResult.risk_level] || "#888"}`, borderRadius:"var(--border-radius-lg)", padding:16, marginBottom:14 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14 }}>
                        <div>
                          <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginBottom:3 }}>4-week average risk — {lstmResult.district}</div>
                          <div style={{ fontSize:40, fontWeight:700, color: RISK_COLOR[lstmResult.risk_level], lineHeight:1 }}>{lstmResult.avg_risk_score}</div>
                          <div style={{ fontSize:13, fontWeight:500, color: RISK_COLOR[lstmResult.risk_level], marginTop:3 }}>{lstmResult.risk_level}</div>
                        </div>
                        <div style={{ textAlign:"right" }}>
                          <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginBottom:4 }}>Trend</div>
                          <div style={{ fontSize:22, fontWeight:700, color: lstmResult.trend==="Rising" ? "#E24B4A" : lstmResult.trend==="Falling" ? "#1D9E75" : "#888" }}>
                            {lstmResult.trend === "Rising" ? "↑ Rising" : lstmResult.trend === "Falling" ? "↓ Falling" : "→ Stable"}
                          </div>
                          <div style={{ fontSize:10, color:"var(--color-text-tertiary)", marginTop:4 }}>Model: LSTM</div>
                        </div>
                      </div>

                      {/* 4 week cards */}
                      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:14 }}>
                        {(lstmResult.weekly_risks || []).map((risk, i) => {
                          const lvl = risk>=75?"Critical":risk>=50?"High":risk>=25?"Medium":"Low";
                          const col = RISK_COLOR[lvl] || "#888";
                          return (
                            <div key={i} style={{ background:"var(--color-background-secondary)", borderRadius:8, padding:"10px 8px", textAlign:"center", borderTop:`3px solid ${col}` }}>
                              <div style={{ fontSize:10, color:"var(--color-text-tertiary)", marginBottom:4 }}>{lstmResult.week_labels?.[i] || `Week +${i+1}`}</div>
                              <div style={{ fontSize:24, fontWeight:700, color:col }}>{risk}</div>
                              <div style={{ fontSize:9, color:col, marginTop:2 }}>{lvl}</div>
                              {/* mini bar */}
                              <div style={{ height:3, background:"var(--color-background-tertiary)", borderRadius:2, overflow:"hidden", marginTop:6 }}>
                                <div style={{ height:"100%", width:`${risk}%`, background:col }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Bar chart */}
                      <ResponsiveContainer width="100%" height={120}>
                        <BarChart data={(lstmResult.weekly_risks || []).map((r, i) => ({
                          week: lstmResult.week_labels?.[i] || `W+${i+1}`,
                          risk: r,
                          fill: r>=75?"#A32D2D":r>=50?"#E24B4A":r>=25?"#EF9F27":"#1D9E75"
                        }))} margin={{ top:4, right:4, bottom:0, left:-30 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#88878015" />
                          <XAxis dataKey="week" tick={{ fontSize:10, fill:"#888780" }} />
                          <YAxis domain={[0,100]} tick={{ fontSize:10, fill:"#888780" }} />
                          <Tooltip
                            contentStyle={{ fontSize:11, background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)" }}
                            formatter={v => [`${v}/100`, "Risk Score"]}
                          />
                          <Bar dataKey="risk" radius={[4,4,0,0]}>
                            {(lstmResult.weekly_risks || []).map((r, i) => (
                              <Cell key={i} fill={r>=75?"#A32D2D":r>=50?"#E24B4A":r>=25?"#EF9F27":"#1D9E75"} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>

                      <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginTop:12, lineHeight:1.6 }}>
                        <strong style={{color:"var(--color-text-primary)"}}>Interpretation: </strong>
                        {lstmResult.trend === "Rising"
                          ? `Risk is increasing over the next 4 weeks in ${lstmResult.district}. Deploy preventive measures immediately.`
                          : lstmResult.trend === "Falling"
                          ? `Risk is decreasing. Current interventions are effective. Continue monitoring.`
                          : `Risk remains stable. Maintain routine surveillance and water quality checks.`}
                      </div>
                    </div>

                    {/* XGBoost vs LSTM comparison */}
                    {xgbCurrent && (
                      <div style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:"var(--border-radius-lg)", padding:16 }}>
                        <div style={{ fontSize:13, fontWeight:500, color:"var(--color-text-primary)", marginBottom:12 }}>XGBoost vs LSTM — model comparison</div>
                        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                          <div style={{ background:"var(--color-background-secondary)", borderRadius:8, padding:12, borderLeft:"3px solid #E24B4A" }}>
                            <div style={{ fontSize:10, color:"var(--color-text-tertiary)", marginBottom:4 }}>XGBoost — RIGHT NOW</div>
                            <div style={{ fontSize:28, fontWeight:700, color: RISK_COLOR[xgbCurrent.risk_level] || "#888" }}>{xgbCurrent.risk_score}</div>
                            <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginTop:2 }}>{xgbCurrent.risk_level} — {xgbCurrent.predicted_disease}</div>
                            <div style={{ fontSize:10, color:"var(--color-text-tertiary)", marginTop:4 }}>Single week prediction</div>
                          </div>
                          <div style={{ background:"var(--color-background-secondary)", borderRadius:8, padding:12, borderLeft:"3px solid #185FA5" }}>
                            <div style={{ fontSize:10, color:"var(--color-text-tertiary)", marginBottom:4 }}>LSTM — NEXT 4 WEEKS</div>
                            <div style={{ fontSize:28, fontWeight:700, color: RISK_COLOR[lstmResult.risk_level] || "#888" }}>{lstmResult.avg_risk_score}</div>
                            <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginTop:2 }}>{lstmResult.risk_level} — {lstmResult.trend}</div>
                            <div style={{ fontSize:10, color:"var(--color-text-tertiary)", marginTop:4 }}>4-week average forecast</div>
                          </div>
                        </div>
                        <div style={{ fontSize:10, color:"var(--color-text-tertiary)", marginTop:10, fontStyle:"italic" }}>
                          XGBoost uses current week data only. LSTM uses 8 weeks of historical patterns to forecast ahead.
                        </div>
                      </div>
                    )}
                  </div>
                ) : !lstmLoading && !lstmError && (
                  <div style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:"var(--border-radius-lg)", padding:40, textAlign:"center" }}>
                    <div style={{ fontSize:40, marginBottom:12 }}>🔮</div>
                    <div style={{ fontSize:13, color:"var(--color-text-secondary)", maxWidth:260, margin:"0 auto", lineHeight:1.6 }}>
                      Select a district and click "Run 4-Week LSTM Forecast" to see the predicted outbreak risk trend
                    </div>
                    <div style={{ marginTop:16, display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
                      {["Week +1","Week +2","Week +3","Week +4"].map(w => (
                        <div key={w} style={{ background:"var(--color-background-secondary)", borderRadius:8, padding:"10px 8px", textAlign:"center", borderTop:"3px solid var(--color-border-tertiary)" }}>
                          <div style={{ fontSize:10, color:"var(--color-text-tertiary)", marginBottom:4 }}>{w}</div>
                          <div style={{ fontSize:24, fontWeight:700, color:"var(--color-text-tertiary)" }}>--</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ===== WATER QUALITY TAB ===== */}
        {tab === "water" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
              {[
                { label: "Current pH (Avg)", value: "6.5", status: "Acidic", color: "#EF9F27" },
                { label: "Turbidity (NTU)", value: "28.3", status: "Dangerous", color: "#E24B4A" },
                { label: "Fecal Coliform", value: "719", status: "14x WHO limit", color: "#A32D2D" },
                { label: "BOD (mg/L)", value: "8.2", status: "Elevated", color: "#EF9F27" },
              ].map(k => (
                <div key={k.label} style={{ background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", padding: "14px" }}>
                  <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 4 }}>{k.label}</div>
                  <div style={{ fontSize: 24, fontWeight: 500, color: k.color }}>{k.value}</div>
                  <div style={{ fontSize: 10, color: k.color, marginTop: 3, fontWeight: 500 }}>{k.status}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "16px" }}>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12, color: "var(--color-text-primary)" }}>Fecal coliform & disease risk score (monthly)</div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={WATER_QUALITY} margin={{ top: 0, right: 8, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#88878015" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#888780" }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "#888780" }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "#888780" }} />
                    <Tooltip contentStyle={{ fontSize: 11, background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)" }} />
                    <Bar yAxisId="left" dataKey="fecalColiform" fill="#E24B4A80" name="Fecal Coliform" />
                    <Line yAxisId="right" type="monotone" dataKey="risk" stroke="#EF9F27" strokeWidth={2} dot={false} name="Risk Score" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "16px" }}>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12, color: "var(--color-text-primary)" }}>pH & turbidity trends (monthly)</div>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={WATER_QUALITY} margin={{ top: 0, right: 8, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#88878015" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#888780" }} />
                    <YAxis tick={{ fontSize: 10, fill: "#888780" }} />
                    <Tooltip contentStyle={{ fontSize: 11, background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)" }} />
                    <Line type="monotone" dataKey="ph" stroke="#185FA5" strokeWidth={2} dot={false} name="pH" />
                    <Line type="monotone" dataKey="turbidity" stroke="#E24B4A" strokeWidth={2} dot={false} name="Turbidity" />
                    <Line type="monotone" dataKey="BOD" stroke="#1D9E75" strokeWidth={1.5} dot={false} name="BOD" strokeDasharray="4 2" />
                  </LineChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                  {[["pH", "#185FA5"], ["Turbidity", "#E24B4A"], ["BOD", "#1D9E75"]].map(([l, c]) => (
                    <span key={l} style={{ fontSize: 10, display: "flex", alignItems: "center", gap: 3, color: "var(--color-text-secondary)" }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: c, display: "inline-block" }} />{l}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* IoT Sensor Status */}
            <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "16px" }}>
              {/* <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12, color: "var(--color-text-primary)" }}>water sensor network status</div> */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
                {[
                  { id: "S-001", loc: "Jaintia Hills River", status: "Online", ph: "6.5", turbidity: "28", coliform: "719" },
                  { id: "S-002", loc: "Cachar Barak River", status: "Online", ph: "6.8", turbidity: "15", coliform: "310" },
                  { id: "S-003", loc: "Kamrup Brahmaputra", status: "Online", ph: "7.1", turbidity: "8.5", coliform: "125" },
                  { id: "S-004", loc: "Udalguri Well", status: "Offline", ph: "--", turbidity: "--", coliform: "--" },
                  { id: "S-005", loc: "Imphal River", status: "Online", ph: "7.3", turbidity: "4.2", coliform: "52" },
                  { id: "S-006", loc: "Lunglei Stream", status: "Online", ph: "7.6", turbidity: "2.1", coliform: "18" },
                ].map(s => (
                  <div key={s.id} style={{ background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", padding: "12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 500, color: "var(--color-text-primary)" }}>{s.id}</span>
                      <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 20, fontWeight: 500, background: s.status === "Online" ? "#1D9E7520" : "#E24B4A20", color: s.status === "Online" ? "#1D9E75" : "#E24B4A" }}>{s.status}</span>
                    </div>
                    <div style={{ fontSize: 10, color: "var(--color-text-secondary)", marginBottom: 6 }}>{s.loc}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, fontSize: 10 }}>
                      <div><span style={{ color: "var(--color-text-tertiary)" }}>pH</span><br /><strong>{s.ph}</strong></div>
                      <div><span style={{ color: "var(--color-text-tertiary)" }}>NTU</span><br /><strong>{s.turbidity}</strong></div>
                      <div><span style={{ color: "var(--color-text-tertiary)" }}>FC</span><br /><strong style={{ color: s.coliform !== "--" && parseInt(s.coliform) > 200 ? "#E24B4A" : "inherit" }}>{s.coliform}</strong></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ===== ALERTS TAB ===== */}
        {tab === "alerts" && (
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              {["all", "critical", "high", "medium", "OUTBREAK", "WATER", "WEATHER"].map(f => (
                <button key={f} onClick={() => setAlertFilter(f)} style={{
                  padding: "6px 14px", fontSize: 11, borderRadius: 20, cursor: "pointer", fontWeight: 500,
                  background: alertFilter === f ? "#E24B4A" : "var(--color-background-primary)",
                  color: alertFilter === f ? "white" : "var(--color-text-secondary)",
                  border: alertFilter === f ? "none" : "0.5px solid var(--color-border-tertiary)"
                }}>{f.charAt(0).toUpperCase() + f.slice(1).toLowerCase()}</button>
              ))}
            </div>

            <div style={{ display: "grid", gap: 10, marginBottom: 16 }}>
              {filteredAlerts.map(a => (
                <div key={a.id} style={{ background: "var(--color-background-primary)", border: `0.5px solid ${a.severity === "critical" ? "#E24B4A60" : a.severity === "high" ? "#EF9F2760" : "var(--color-border-tertiary)"}`, borderRadius: "var(--border-radius-lg)", padding: "14px 16px", display: "flex", gap: 14 }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: a.severity === "critical" ? "#E24B4A20" : a.severity === "high" ? "#EF9F2720" : "var(--color-background-secondary)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: 14 }}>{a.type === "OUTBREAK" ? "🦠" : a.type === "WATER" ? "💧" : a.type === "WEATHER" ? "🌧" : "📡"}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-primary)" }}>{a.district}</span>
                        <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 20, fontWeight: 500, background: a.severity === "critical" ? "#E24B4A20" : a.severity === "high" ? "#EF9F2720" : "#88878020", color: a.severity === "critical" ? "#E24B4A" : a.severity === "high" ? "#854F0B" : "#888780" }}>{a.severity.toUpperCase()}</span>
                        <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 20, background: "var(--color-background-secondary)", color: "var(--color-text-secondary)" }}>{a.type}</span>
                      </div>
                      <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>{a.time}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{a.msg}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Alert Channel Status */}
            <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "16px" }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12, color: "var(--color-text-primary)" }}>Alert delivery channels — 24h statistics</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                {[
                  { channel: "SMS (Twilio)", sent: 1247, delivered: 1198, rate: "96.1%" },
                  { channel: "Push Notification", sent: 892, delivered: 867, rate: "97.2%" },
                  { channel: "Govt Dashboard", sent: 45, delivered: 45, rate: "100%" },
                  { channel: "IVRS Calls", sent: 312, delivered: 298, rate: "95.5%" },
                ].map(c => (
                  <div key={c.channel} style={{ background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", padding: "12px" }}>
                    <div style={{ fontSize: 11, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 6 }}>{c.channel}</div>
                    <div style={{ fontSize: 18, fontWeight: 500, color: "#1D9E75" }}>{c.rate}</div>
                    <div style={{ fontSize: 10, color: "var(--color-text-tertiary)", marginTop: 2 }}>{c.delivered}/{c.sent} delivered</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ===== ARCHITECTURE TAB ===== */}
        {tab === "architecture" && (
          <div>
            {/* Architecture Diagram */}
            <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "20px", marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 16, color: "var(--color-text-primary)" }}>System architecture — 5-layer design</div>
              <div style={{ display: "grid", gap: 8 }}>
                {ARCH_LAYERS.map((layer, i) => (
                  <div key={i} style={{ border: `0.5px solid ${layer.color}40`, borderRadius: "var(--border-radius-md)", overflow: "hidden" }}>
                    <div style={{ background: layer.color + "15", padding: "8px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: layer.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, fontWeight: 500, color: layer.color }}>{layer.label}</span>
                    </div>
                    <div style={{ padding: "10px 14px", display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {layer.items.map((item, j) => (
                        <span key={j} style={{ fontSize: 11, padding: "4px 10px", background: layer.color + "12", border: `0.5px solid ${layer.color}30`, borderRadius: 20, color: "var(--color-text-secondary)" }}>{item}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 4px", fontSize: 11, color: "var(--color-text-tertiary)", gap: 6, alignItems: "center" }}>
                <span>Data flows: ASHA app → API → DB → ML Engine → Alert System</span>
              </div>
            </div>

            {/* Database Schema */}
            <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "20px" }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 16, color: "var(--color-text-primary)" }}>PostgreSQL database schema</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                {DB_SCHEMA.map(t => (
                  <div key={t.table} style={{ border: `0.5px solid ${t.color}50`, borderRadius: "var(--border-radius-md)", overflow: "hidden" }}>
                    <div style={{ background: t.color + "20", padding: "8px 12px", borderBottom: `0.5px solid ${t.color}30` }}>
                      <span style={{ fontSize: 12, fontWeight: 500, color: t.color, fontFamily: "monospace" }}>{t.table}</span>
                    </div>
                    {t.fields.map((f, i) => (
                      <div key={i} style={{ padding: "5px 12px", fontSize: 10, color: f.includes("PK") ? "var(--color-text-primary)" : f.includes("FK") ? t.color : "var(--color-text-secondary)", borderBottom: "0.5px solid var(--color-border-tertiary)", fontFamily: "monospace", fontWeight: f.includes("PK") ? 500 : 400 }}>
                        {f}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12, fontSize: 11, color: "var(--color-text-tertiary)" }}>
                PK = Primary Key • FK = Foreign Key • Arrows: users → disease_reports, locations → water_quality, ml_predictions → alerts
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
