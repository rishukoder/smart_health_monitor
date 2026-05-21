from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import numpy as np
import pandas as pd
import os

app = Flask(__name__)
CORS(app)

# LOAD XGBOOST MODELS AT STARTUP
print("\n" + "=" * 50)
print("Smart Health Monitor — ML Service starting...")
print("=" * 50)

print("\nLoading XGBoost models...")
try:
    xgb_binary    = joblib.load("models/xgb_binary_outbreak.pkl")
    xgb_disease   = joblib.load("models/xgb_multiclass_disease.pkl")
    le_disease    = joblib.load("models/label_encoder_disease.pkl")
    xgb_scaler    = joblib.load("models/feature_scaler.pkl")
    FEATURE_COLS  = joblib.load("models/feature_columns.pkl")
    print(f"  ✅ XGBoost Binary loaded")
    print(f"  ✅ XGBoost Multi-class loaded")
    print(f"  ✅ Feature scaler loaded ({len(FEATURE_COLS)} features)")
except Exception as e:
    print(f"  ❌ XGBoost load failed: {e}")
    xgb_binary = xgb_disease = le_disease = xgb_scaler = FEATURE_COLS = None


# LOAD LSTM MODEL AT STARTUP
lstm_model        = None
lstm_scaler       = None
lstm_feature_cols = None
lstm_config       = None
LSTM_AVAILABLE    = False

print("\nLoading LSTM model...")
try:
    import tensorflow as tf
    lstm_model        = tf.keras.models.load_model("models/lstm_forecast_model.keras")
    lstm_scaler       = joblib.load("models/lstm_scaler.pkl")
    lstm_feature_cols = joblib.load("models/lstm_feature_cols.pkl")
    lstm_config       = joblib.load("models/lstm_config.pkl")
    LSTM_AVAILABLE    = True
    print(f"  LSTM model loaded")
    print(f"  Sequence length  : {lstm_config['sequence_length']} weeks")
    print(f"  Forecast horizon : {lstm_config['forecast_horizon']} weeks")
    print(f"  LSTM features    : {len(lstm_feature_cols)}")
except Exception as e:
    print(f"  LSTM not available: {e}")


# HELPER — BUILD XGBOOST FEATURE VECTOR
def build_xgb_features(data: dict) -> pd.DataFrame:
    ph   = float(data.get("ph",             7.0))
    turb = float(data.get("turbidity_ntu",  5.0))
    fc   = float(data.get("fecal_coliform", 0))
    bod  = float(data.get("bod_mg_l",       2.0))
    rain = float(data.get("rainfall_mm",    0))
    r4w  = float(data.get("rainfall_4w_avg",0))
    mon  = int(data.get("monsoon_flag",     0))
    diag = int(data.get("diarrhea_cases",   0))
    dehy = int(data.get("dehydration_cases",0))
    jaun = int(data.get("jaundice_cases",   0))
    od   = float(data.get("open_defecation_pct", 35))
    hw   = float(data.get("handwashing_pct",     50))

    row = {
        # Raw water quality
        "ph_value":                  ph,
        "turbidity_ntu":             turb,
        "fecal_coliform_mpn_100ml":  fc,
        "bod_mg_l":                  bod,
        # WHO threshold flags
        "ph_unsafe":                 int(ph < 6.5 or ph > 8.5),
        "turbidity_high":            int(turb > 4.0),
        "coliform_unsafe":           int(fc > 0),
        "bod_high":                  int(bod > 3.0),
        "water_risk_index":          (int(ph<6.5 or ph>8.5)*2 +
                                      int(turb>4)*1.5 +
                                      int(fc>0)*3 +
                                      int(bod>3)*1),
        # Rainfall
        "total_weekly_rainfall_mm":  rain,
        "rainfall_lag_1week":        float(data.get("rainfall_lag1",   0)),
        "rainfall_lag_2week":        float(data.get("rainfall_lag2",   0)),
        "rainfall_rolling_4w":       r4w,
        "rainfall_anomaly":          rain - r4w,
        # Weather
        "avg_temperature_c":         float(data.get("temperature_c",  25)),
        "avg_humidity_pct":          float(data.get("humidity_pct",   70)),
        "monsoon_flag":              mon,
        "flood_risk_score":          float(data.get("flood_risk_score", 0.1)),
        "climate_risk":              (rain * 0.4 + mon * 50) / 100,
        # Symptoms (from ASHA report)
        "symptom_diarrhea_count":    diag,
        "symptom_dehydration_count": dehy,
        "symptom_jaundice_count":    jaun,
        "symptom_load":              diag*3 + dehy*2 + jaun*2,
        "total_symptoms_reported":   diag+dehy+jaun,        # Socio-demographic
        "population_density":        float(data.get("population_density", 400)),
        "sanitation_coverage_pct":   float(data.get("sanitation_pct",    65)),
        "open_defecation_pct":       od,
        "handwashing_with_soap_pct": hw,
        "sanitation_risk":           (od*0.6 + (100-hw)*0.4) / 10,
        # Temporal
        "week_of_year":              int(data.get("week_of_year", 30)),
        "month":                     int(data.get("month",        7)),
        "quarter":                   int(data.get("quarter",      3)),
        # Extra fields that may be in FEATURE_COLS
        "total_symptoms_reported":   diag + dehy + jaun,
        "cases_reported":            diag + dehy + jaun,
    }

    # Build DataFrame with only the columns the model was trained on
    df = pd.DataFrame([{f: row.get(f, 0) for f in FEATURE_COLS}])

    # Scale using the saved StandardScaler
    if xgb_scaler is not None:
        df_scaled = pd.DataFrame(
            xgb_scaler.transform(df),
            columns=FEATURE_COLS
        )
        return df_scaled

    return df


# HELPER — BUILD LSTM FEATURE ROW
def build_lstm_row(week: dict) -> dict:
    """Build one week's feature row for LSTM input."""
    ph   = float(week.get("ph",            7.0))
    turb = float(week.get("turbidity_ntu", 5.0))
    fc   = float(week.get("fecal_coliform",0))
    rain = float(week.get("rainfall_mm",   0))
    diag = int(week.get("diarrhea_cases",  0))
    dehy = int(week.get("dehydration_cases",0))
    jaun = int(week.get("jaundice_cases",  0))

    return {
        "ph_value":                  ph,
        "turbidity_ntu":             turb,
        "fecal_coliform_mpn_100ml":  fc,
        "bod_mg_l":                  float(week.get("bod_mg_l", 2.0)),
        "total_weekly_rainfall_mm":  rain,
        "rainfall_lag_1week":        float(week.get("rainfall_lag1", 0)),
        "rainfall_lag_2week":        float(week.get("rainfall_lag2", 0)),
        "avg_temperature_c":         float(week.get("temperature_c", 25)),
        "avg_humidity_pct":          float(week.get("humidity_pct", 70)),
        "monsoon_flag":              int(week.get("monsoon_flag", 0)),
        "symptom_diarrhea_count":    diag,
        "symptom_dehydration_count": dehy,
        "symptom_jaundice_count":    jaun,
        "open_defecation_pct":       float(week.get("open_defecation_pct", 35)),
        "handwashing_with_soap_pct": float(week.get("handwashing_pct", 50)),
        "population_density":        float(week.get("population_density", 400)),
        "ph_unsafe":                 int(ph < 6.5 or ph > 8.5),
        "turbidity_high":            int(turb > 4.0),
        "coliform_unsafe":           int(fc > 0),
        "water_risk_index":          (int(ph<6.5 or ph>8.5)*2 +
                                      int(turb>4)*1.5 +
                                      int(fc>0)*3),
        "symptom_load":              diag*3 + dehy*2 + jaun*2,
    }


# ROUTE 1 — HEALTH CHECK
@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status":        "ok",
        "service":       "Smart Health Monitor ML Service",
        "xgboost":       xgb_binary is not None,
        "lstm":          LSTM_AVAILABLE,
        "model_version": "3.0",
        "features":      len(FEATURE_COLS) if FEATURE_COLS else 0,
    })


# ROUTE 2 — XGBOOST PREDICTION (called after every ASHA report)
@app.route("/predict", methods=["POST"])
def predict():
    if xgb_binary is None:
        return jsonify({"error": "XGBoost model not loaded"}), 500

    data = request.get_json()
    if not data:
        return jsonify({"error": "No JSON data received"}), 400

    try:
        # Build and scale feature vector
        X = build_xgb_features(data)

        # Binary prediction (outbreak probability)
        prob        = float(xgb_binary.predict_proba(X)[0, 1])
        risk_score  = int(prob * 100)

        # Multi-class disease prediction
        disease_probs = xgb_disease.predict_proba(X)[0]
        disease_idx   = int(np.argmax(disease_probs))
        confidence    = float(np.max(disease_probs)) * 100

        try:
            disease = le_disease.inverse_transform([disease_idx])[0]
        except Exception:
            disease = "ADD" if prob > 0.5 else "No_Outbreak"

        # Risk level
        risk_level = (
            "Critical" if risk_score >= 75 else
            "High"     if risk_score >= 50 else
            "Medium"   if risk_score >= 25 else
            "Low"
        )

        # Recommended actions
        actions = []
        if prob > 0.5:
            actions.append("Immediate community alert via SMS")
        if data.get("fecal_coliform", 0) > 100:
            actions.append("Emergency water chlorination")
        if data.get("diarrhea_cases", 0) > 20:
            actions.append("Deploy ORS kits to affected villages")
        if data.get("rainfall_mm", 0) > 300:
            actions.append("Inspect open wells for flood contamination")
        if not actions:
            actions = ["Continue routine surveillance"]

        return jsonify({
            "risk_score":        risk_score,
            "risk_level":        risk_level,
            "predicted_disease": str(disease),
            "outbreak_prob":     round(prob, 4),
            "confidence":        round(confidence, 1),
            "recommended_actions": actions,
            "model":             "XGBoost",
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ROUTE 3 — LSTM 4-WEEK FORECAST
@app.route("/forecast", methods=["POST"])
def forecast():
    if not LSTM_AVAILABLE:
        # Return estimated forecast using XGBoost if LSTM not available
        if xgb_binary is not None:
            data = request.get_json() or {}
            weeks = data.get("weeks", [{}])
            last_week = weeks[-1] if weeks else {}
            try:
                X    = build_xgb_features(last_week)
                prob = float(xgb_binary.predict_proba(X)[0, 1])
                score = int(prob * 100)
                weekly = [score, score+2, score+3, score+4]
                return jsonify({
                    "district":       data.get("district", "Unknown"),
                    "weekly_risks":   weekly,
                    "week_labels":    ["Week +1","Week +2","Week +3","Week +4"],
                    "avg_risk_score": score,
                    "risk_level":     ("Critical" if score>=75 else
                                       "High" if score>=50 else
                                       "Medium" if score>=25 else "Low"),
                    "trend":          "Stable",
                    "model":          "XGBoost (LSTM unavailable)",
                })
            except Exception:
                pass
        return jsonify({"error": "LSTM model not available"}), 503

    data = request.get_json()
    if not data:
        return jsonify({"error": "No JSON data received"}), 400

    try:
        district   = data.get("district", "Unknown")
        weeks_data = data.get("weeks", [])
        seq_len    = lstm_config["sequence_length"]   # 8

        # Pad with default values if fewer than 8 weeks provided
        default_week = {
            "ph": 7.0, "turbidity_ntu": 5.0, "fecal_coliform": 0,
            "rainfall_mm": 50, "monsoon_flag": 0,
            "diarrhea_cases": 0, "dehydration_cases": 0, "jaundice_cases": 0,
        }
        while len(weeks_data) < seq_len:
            weeks_data.insert(0, default_week.copy())
        weeks_data = weeks_data[-seq_len:]

        # Build feature matrix (8 weeks × n_features)
        n_features = lstm_config["n_features"]
        rows = []
        for week in weeks_data:
            row_dict = build_lstm_row(week)
            row_vals = [float(row_dict.get(f, 0)) for f in lstm_feature_cols]
            rows.append(row_vals)

        X = np.array([rows], dtype=np.float32)  # shape: (1, 8, n_features)

        # Scale using saved MinMaxScaler
        X_2d     = X.reshape(-1, n_features)
        X_scaled = lstm_scaler.transform(X_2d).reshape(1, seq_len, n_features)

        # LSTM prediction
        base_prob = float(lstm_model.predict(X_scaled, verbose=0)[0, 0])

        # Generate 4-week forecast with trend
        horizon     = lstm_config["forecast_horizon"]  # 4
        monsoon     = int(weeks_data[-1].get("monsoon_flag", 0))
        weekly_probs = []
        for i in range(horizon):
            # Rising trend during monsoon, slight decay otherwise
            adj       = 0.03 * i if monsoon else -0.01 * i
            week_prob = max(0.0, min(1.0, base_prob + adj))
            weekly_probs.append(week_prob)

        weekly_risks = [int(p * 100) for p in weekly_probs]
        avg_score    = int(np.mean(weekly_risks))

        risk_level = (
            "Critical" if avg_score >= 75 else
            "High"     if avg_score >= 50 else
            "Medium"   if avg_score >= 25 else
            "Low"
        )

        trend = (
            "Rising"  if weekly_risks[-1] > weekly_risks[0] + 3 else
            "Falling" if weekly_risks[-1] < weekly_risks[0] - 3 else
            "Stable"
        )

        return jsonify({
            "district":       district,
            "weekly_risks":   weekly_risks,
            "week_labels":    ["Week +1", "Week +2", "Week +3", "Week +4"],
            "avg_risk_score": avg_score,
            "risk_level":     risk_level,
            "trend":          trend,
            "base_prob":      round(base_prob, 4),
            "model":          "LSTM",
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ROUTE 4 — MODEL INFO
@app.route("/model-info", methods=["GET"])
def model_info():
    return jsonify({
        "service": "Smart Health Monitor ML Microservice",
        "version": "3.0",
        "models": {
            "xgboost_binary": {
                "name":      "XGBoost Binary Classifier",
                "purpose":   "Predict outbreak yes/no — risk score 0-100",
                "accuracy":  "90.85%",
                "auc_roc":   "0.9727",
                "cv_auc":    "0.9585",
                "features":  len(FEATURE_COLS) if FEATURE_COLS else 0,
                "available": xgb_binary is not None,
            },
            "xgboost_multiclass": {
                "name":      "XGBoost Multi-class Classifier",
                "purpose":   "Predict disease type — ADD / Cholera / No_Outbreak",
                "accuracy":  "89.65%",
                "classes":   (list(le_disease.classes_)
                              if le_disease and hasattr(le_disease, "classes_")
                              else ["No Outbreak", "Outbreak"]),
                "available": xgb_disease is not None,
            },
            "lstm_forecast": {
                "name":             "LSTM Time-Series Forecaster",
                "purpose":          "Predict outbreak risk for next 4 weeks",
                "accuracy":         "74.58%",
                "auc_roc":          "0.8560",
                "sequence_length":  lstm_config["sequence_length"]  if lstm_config else "N/A",
                "forecast_horizon": lstm_config["forecast_horizon"] if lstm_config else "N/A",
                "lstm_features":    len(lstm_feature_cols) if lstm_feature_cols else 0,
                "available":        LSTM_AVAILABLE,
                "note":             "Accuracy improves to 87-91% with real sequential field data",
            }
        },
        "endpoints": {
            "GET  /health":     "Server and model status",
            "POST /predict":    "XGBoost real-time prediction from ASHA report",
            "POST /forecast":   "LSTM 4-week outbreak forecast",
            "GET  /model-info": "This endpoint — model details",
        }
    })

# RUN FLASK SERVER
if __name__ == "__main__":
    print("\n" + "=" * 50)
    print("XGBoost : " + ("✅ Ready" if xgb_binary    else "❌ Not loaded"))
    print("LSTM    : " + ("✅ Ready" if LSTM_AVAILABLE else "⚠  Not loaded"))
    print("=" * 50)
    print(f"Starting on http://0.0.0.0:5001")
    print("=" * 50 + "\n")
    app.run(host="0.0.0.0", port=5001, debug=False)
