import os
import warnings
import pandas as pd
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing   import LabelEncoder, StandardScaler, MinMaxScaler
from sklearn.metrics         import (
    classification_report, confusion_matrix,
    roc_auc_score, accuracy_score,
)
from sklearn.ensemble import RandomForestClassifier
from sklearn.inspection import permutation_importance
import xgboost as xgb
import joblib

warnings.filterwarnings("ignore")

# GLOBAL CONFIGURATION
DATASET_PATH     = "balanced_ml_training_dataset_clean.csv"
MODEL_DIR        = "models/"
SEQUENCE_LENGTH  = 8    # LSTM looks back 8 weeks per district
FORECAST_HORIZON = 4    # LSTM predicts next 4 weeks

os.makedirs(MODEL_DIR, exist_ok=True)

# FEATURE COLUMNS
FEATURE_COLS = [
    # Water quality — raw readings
    "ph_value", "turbidity_ntu", "fecal_coliform_mpn_100ml", "bod_mg_l",
    # Water quality — WHO threshold flags
    "ph_unsafe", "turbidity_high", "coliform_unsafe", "bod_high",
    "water_risk_index",
    # Rainfall and climate
    "total_weekly_rainfall_mm", "rainfall_lag_1week", "rainfall_lag_2week",
    "rainfall_rolling_4w", "rainfall_anomaly",
    "avg_temperature_c", "avg_humidity_pct", "monsoon_flag",
    "flood_risk_score", "climate_risk",
    # Symptoms (from ASHA reports)
    "symptom_diarrhea_count", "symptom_dehydration_count",
    "symptom_jaundice_count", "symptom_load",
    # Socio-demographic
    "population_density", "sanitation_coverage_pct", "open_defecation_pct",
    "handwashing_with_soap_pct", "sanitation_risk",
    # Temporal
    "week_of_year", "month", "quarter",
]

LSTM_FEATURE_COLS = [
    "ph_value", "turbidity_ntu", "fecal_coliform_mpn_100ml", "bod_mg_l",
    "total_weekly_rainfall_mm", "rainfall_lag_1week", "rainfall_lag_2week",
    "avg_temperature_c", "avg_humidity_pct", "monsoon_flag",
    "symptom_diarrhea_count", "symptom_dehydration_count",
    "symptom_jaundice_count", "open_defecation_pct",
    "handwashing_with_soap_pct", "population_density",
    "ph_unsafe", "turbidity_high", "coliform_unsafe",
    "water_risk_index", "symptom_load",
]

# STEP 1 — DATA LOADING AND EXPLORATION
def load_and_explore(filepath: str) -> pd.DataFrame:
    """Load NE India dataset and print key statistics."""
    print("=" * 70)
    print("STEP 1: DATA LOADING AND EXPLORATION")
    print("=" * 70)

    df = pd.read_csv(filepath)
    print(f"Shape          : {df.shape[0]:,} rows x {df.shape[1]} columns")
    print(f"\nColumns:")
    print(f"  {list(df.columns)}")

    if "district" in df.columns:
        print(f"\nDistricts      : {df['district'].nunique()} unique NE India districts")
    if "state" in df.columns:
        print(f"States         : {sorted(df['state'].unique())}")
        print("\nDistricts per state:")
        for state, grp in df.groupby("state"):
            print(f"  {state:<25} {grp['district'].nunique()} districts")
    if "date_start" in df.columns:
        print(f"\nDate range     : {df['date_start'].min()} to {df['date_start'].max()}")
    if "target_disease" in df.columns:
        print(f"\nTarget disease distribution:")
        print(df["target_disease"].value_counts().to_string())
    if "risk_level" in df.columns:
        print(f"\nRisk level distribution:")
        print(df["risk_level"].value_counts().to_string())
    print(f"\nOutbreak binary: {dict(df['outbreak_binary'].value_counts())}")
    print(f"Missing values : {df.isnull().sum().sum()} total")
    if "split" in df.columns:
        print(f"Split          : {dict(df['split'].value_counts())}")

    return df


# STEP 2 — DATA PREPROCESSING AND FEATURE ENGINEERING
def preprocess(df: pd.DataFrame) -> pd.DataFrame:
    """Engineer meaningful features from raw data."""
    print("\n" + "=" * 70)
    print("STEP 2: DATA PREPROCESSING AND FEATURE ENGINEERING")
    print("=" * 70)

    df = df.copy()

    # 2a. Parse dates and extract temporal features
    if "date_start" in df.columns:
        df["date_start"] = pd.to_datetime(df["date_start"])
        df["month"]      = df["date_start"].dt.month
        df["quarter"]    = df["date_start"].dt.quarter
    else:
        df["month"]   = ((df["week_of_year"] - 1) // 4 + 1).clip(1, 12).astype(int)
        df["quarter"] = ((df["month"] - 1) // 3 + 1).astype(int)

    # 2b. WHO water quality threshold flags
    # WHO guidelines: pH 6.5-8.5, turbidity < 4 NTU, fecal coliform = 0 MPN/100ml
    df["ph_unsafe"]       = ((df["ph_value"] < 6.5) | (df["ph_value"] > 8.5)).astype(int)
    df["turbidity_high"]  = (df["turbidity_ntu"]            > 4.0).astype(int)
    df["coliform_unsafe"] = (df["fecal_coliform_mpn_100ml"] > 0  ).astype(int)
    df["bod_high"]        = (df["bod_mg_l"]                 > 3.0).astype(int)

    # 2c. Composite water risk index (0-7.5 scale)
    df["water_risk_index"] = (
        df["ph_unsafe"]       * 2.0 +
        df["turbidity_high"]  * 1.5 +
        df["coliform_unsafe"] * 3.0 +
        df["bod_high"]        * 1.0
    )

    # 2d. Sanitation risk score (0-10 scale)
    if "open_defecation_pct" in df.columns:
        df["sanitation_risk"] = (
            df["open_defecation_pct"]                    * 0.6 +
            (100 - df["handwashing_with_soap_pct"])      * 0.4
        ) / 10
    else:
        df["sanitation_risk"] = 0

    # 2e. Symptom load (weighted by clinical severity)
    # Diarrhea x3 = primary waterborne symptom
    # Dehydration x2 + Jaundice x2 = secondary indicators
    if "symptom_diarrhea_count" in df.columns:
        df["symptom_load"] = (
            df["symptom_diarrhea_count"]    * 3 +
            df["symptom_dehydration_count"] * 2 +
            df["symptom_jaundice_count"]    * 2
        )
    else:
        df["symptom_load"] = 0

    # 2f. Climate risk (monsoon + rainfall combined score)
    lag1 = df["rainfall_lag_1week"] if "rainfall_lag_1week" in df.columns else 0
    lag2 = df["rainfall_lag_2week"] if "rainfall_lag_2week" in df.columns else 0
    df["climate_risk"] = (
        df["total_weekly_rainfall_mm"] * 0.4 +
        lag1                           * 0.3 +
        lag2                           * 0.2 +
        df["monsoon_flag"]             * 50
    ) / 100

    # 2g. Rainfall anomaly vs 4-week rolling average
    if "rainfall_rolling_4w" in df.columns:
        df["rainfall_anomaly"] = (
            df["total_weekly_rainfall_mm"] - df["rainfall_rolling_4w"]
        ).fillna(0)
    else:
        df["rainfall_anomaly"] = 0

    # 2h. Fill any remaining missing values with column median
    num_cols = df.select_dtypes(include=[np.number]).columns
    df[num_cols] = df[num_cols].fillna(df[num_cols].median())

    print("Engineered features:")
    print("  WHO flags      : ph_unsafe, turbidity_high, coliform_unsafe, bod_high")
    print("  Composites     : water_risk_index, sanitation_risk, symptom_load")
    print("  Climate        : climate_risk, rainfall_anomaly")
    print("  Temporal       : month, quarter")
    print(f"Final shape    : {df.shape}")

    return df


# STEP 3 — FEATURE SELECTION AND ENCODING
def prepare_features(df: pd.DataFrame):
    """Encode targets and create train/test split."""
    global FEATURE_COLS

    print("\n" + "=" * 70)
    print("STEP 3: FEATURE SELECTION AND ENCODING")
    print("=" * 70)

    # Only use features present in this dataset
    available    = [f for f in FEATURE_COLS if f in df.columns]
    FEATURE_COLS = available
    X            = df[available].copy()

    # Binary outbreak target
    y_binary = df["outbreak_binary"].astype(int)

    # Multi-class disease target
    le_disease = LabelEncoder()
    if "target_disease" in df.columns:
        y_disease = le_disease.fit_transform(df["target_disease"])
        classes_dict = dict(zip(le_disease.classes_, le_disease.transform(le_disease.classes_)))
        print(f"Disease classes : {classes_dict}")
    else:
        le_disease.fit([0, 1])
        y_disease = y_binary.values.copy()

    # Use the pre-built train/test split column from dataset
    if "split" in df.columns:
        train_mask = df["split"] == "train"
        X_train  = X[train_mask].reset_index(drop=True)
        X_test   = X[~train_mask].reset_index(drop=True)
        yb_train = y_binary[train_mask].reset_index(drop=True)
        yb_test  = y_binary[~train_mask].reset_index(drop=True)
        yd_arr   = np.array(y_disease)
        yd_train = yd_arr[train_mask.values]
        yd_test  = yd_arr[~train_mask.values]
    else:
        X_train, X_test, yb_train, yb_test, yd_train, yd_test = train_test_split(
            X, y_binary, y_disease,
            test_size=0.2, random_state=42, stratify=y_binary
        )

    # StandardScaler: z = (x - mean) / std
    scaler      = StandardScaler()
    X_train_sc  = pd.DataFrame(scaler.fit_transform(X_train), columns=available)
    X_test_sc   = pd.DataFrame(scaler.transform(X_test),      columns=available)

    print(f"\nTraining set   : {len(X_train):,} samples (80%)")
    print(f"Test set       : {len(X_test):,} samples (20%)")
    print(f"Features used  : {len(available)}")
    print(f"Outbreak dist  : {dict(pd.Series(yb_train).value_counts())}")

    return (X_train_sc, X_test_sc,
            yb_train, yb_test,
            yd_train, yd_test,
            scaler, le_disease, X)


# STEP 4A — XGBOOST BINARY CLASSIFIER
def train_xgboost_binary(X_train, X_test, y_train, y_test):
    print("\n" + "=" * 70)
    print("STEP 4A: XGBOOST — BINARY OUTBREAK PREDICTION")
    print("=" * 70)

    neg_pos = (y_train == 0).sum() / max((y_train == 1).sum(), 1)
    print(f"Class imbalance ratio (neg:pos) = {neg_pos:.2f}")

    # Main model — early_stopping_rounds in constructor (new XGBoost API)
    model = xgb.XGBClassifier(
        n_estimators=500,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        reg_alpha=0.1,
        reg_lambda=1.0,
        scale_pos_weight=neg_pos,
        eval_metric="auc",
        early_stopping_rounds=30,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(
        X_train, y_train,
        eval_set=[(X_test, y_test)],
        verbose=100,
    )

    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]
    acc    = accuracy_score(y_test, y_pred)
    auc    = roc_auc_score(y_test, y_prob)

    print(f"\n{'─' * 40}")
    print(f"Accuracy   : {acc * 100:.2f}%")
    print(f"AUC-ROC    : {auc:.4f}")
    print(f"\nClassification Report:")
    print(classification_report(
        y_test, y_pred,
        target_names=["No Outbreak", "Outbreak"]
    ))

    # 5-fold cross-validation (separate model without early stopping)
    cv_model = xgb.XGBClassifier(
        n_estimators=100,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        scale_pos_weight=neg_pos,
        eval_metric="auc",
        random_state=42,
        n_jobs=-1,
    )
    cv_scores = cross_val_score(cv_model, X_train, y_train, cv=5, scoring="roc_auc")
    print(f"5-Fold CV AUC  : {cv_scores.mean():.4f} +/- {cv_scores.std():.4f}")

    return model, y_prob


# STEP 4B — XGBOOST MULTI-CLASS CLASSIFIER
def train_xgboost_multiclass(X_train, X_test, y_train, y_test, classes):

    print("\n" + "=" * 70)
    print("STEP 4B: XGBOOST — MULTI-CLASS DISEASE PREDICTION")
    print("=" * 70)

    n_classes = len(set(list(y_train) + list(y_test)))

    if n_classes > 2:
        model = xgb.XGBClassifier(
            n_estimators=400,
            max_depth=5,
            learning_rate=0.08,
            subsample=0.8,
            colsample_bytree=0.8,
            objective="multi:softprob",
            num_class=n_classes,
            eval_metric="mlogloss",
            early_stopping_rounds=30,
            random_state=42,
            n_jobs=-1,
        )
    else:
        # Binary fallback (dataset has no multi-class target)
        model = xgb.XGBClassifier(
            n_estimators=400,
            max_depth=5,
            learning_rate=0.08,
            subsample=0.8,
            colsample_bytree=0.8,
            eval_metric="logloss",
            early_stopping_rounds=30,
            random_state=42,
            n_jobs=-1,
        )

    # Give Cholera class more weight so model pays attention to it
    from sklearn.utils.class_weight import compute_sample_weight
    sample_weights = compute_sample_weight(
        class_weight='balanced',
        y=y_train
    )

    model.fit(
        X_train, y_train,
        eval_set=[(X_test, y_test)],
        sample_weight=sample_weights,
        verbose=100,
    )

    y_pred = model.predict(X_test)
    acc    = accuracy_score(y_test, y_pred)

    print(f"\nMulti-class Accuracy : {acc * 100:.2f}%")
    print(f"\nClassification Report:")
    print(classification_report(
        y_test, y_pred,
        target_names=[str(c) for c in classes]
    ))

    return model

# STEP 5 — FEATURE IMPORTANCE ANALYSIS
def analyze_feature_importance(model, feature_names: list, top_n: int = 15):
    """Rank features by XGBoost importance scores."""
    print("\n" + "=" * 70)
    print(f"STEP 5: TOP {top_n} FEATURE IMPORTANCES")
    print("=" * 70)

    importance = pd.Series(
        model.feature_importances_,
        index=feature_names
    ).sort_values(ascending=False)

    print(f"\n{'Feature':<35} {'Importance':>12}")
    print("─" * 50)
    for feat, imp in importance.head(top_n).items():
        bar = "█" * int(imp * 300)
        print(f"{feat:<35} {imp:>8.4f}  {bar}")

    return importance

# STEP 6 — SAMPLE PREDICTION (PRODUCTION INFERENCE)
def predict_outbreak_risk(model_binary, model_multiclass,
                           scaler, le_disease, input_data: dict) -> dict:
 
    ph   = input_data.get("ph",            7.0)
    turb = input_data.get("turbidity_ntu", 5.0)
    fc   = input_data.get("fecal_coliform", 0)
    bod  = input_data.get("bod_mg_l",      2.0)
    rain = input_data.get("rainfall_mm",   0)
    r4w  = input_data.get("rainfall_4w_avg", 0)
    diag = input_data.get("diarrhea_cases",   0)
    dehy = input_data.get("dehydration_cases", 0)
    jaun = input_data.get("jaundice_cases",    0)
    od   = input_data.get("open_defecation_pct", 35)
    hw   = input_data.get("handwashing_pct",     50)
    mon  = input_data.get("monsoon_flag", 0)

    row = {
        "ph_value":                  ph,
        "turbidity_ntu":             turb,
        "fecal_coliform_mpn_100ml":  fc,
        "bod_mg_l":                  bod,
        "ph_unsafe":                 int(ph < 6.5 or ph > 8.5),
        "turbidity_high":            int(turb > 4.0),
        "coliform_unsafe":           int(fc > 0),
        "bod_high":                  int(bod > 3.0),
        "water_risk_index":          (int(ph<6.5 or ph>8.5)*2 + int(turb>4)*1.5 +
                                      int(fc>0)*3 + int(bod>3)*1),
        "total_weekly_rainfall_mm":  rain,
        "rainfall_lag_1week":        input_data.get("rainfall_lag1", 0),
        "rainfall_lag_2week":        input_data.get("rainfall_lag2", 0),
        "rainfall_rolling_4w":       r4w,
        "rainfall_anomaly":          rain - r4w,
        "avg_temperature_c":         input_data.get("temperature_c", 25),
        "avg_humidity_pct":          input_data.get("humidity_pct", 70),
        "monsoon_flag":              mon,
        "flood_risk_score":          input_data.get("flood_risk_score", 0.1),
        "climate_risk":              (rain * 0.4 + mon * 50) / 100,
        "symptom_diarrhea_count":    diag,
        "symptom_dehydration_count": dehy,
        "symptom_jaundice_count":    jaun,
        "total_symptoms_reported":   diag + dehy + jaun,
        "symptom_load":              diag*3 + dehy*2 + jaun*2,
        "population_density":        input_data.get("population_density", 400),
        "sanitation_coverage_pct":   input_data.get("sanitation_pct", 65),
        "open_defecation_pct":       od,
        "handwashing_with_soap_pct": hw,
        "sanitation_risk":           (od*0.6 + (100-hw)*0.4) / 10,
        "week_of_year":              input_data.get("week_of_year", 30),
        "month":                     input_data.get("month", 7),
        "quarter":                   input_data.get("quarter", 3),
    }

    df_in = pd.DataFrame([{f: row.get(f, 0) for f in FEATURE_COLS}])
    df_sc = pd.DataFrame(scaler.transform(df_in), columns=FEATURE_COLS)

    outbreak_prob = float(model_binary.predict_proba(df_sc)[0, 1])
    disease_probs = model_multiclass.predict_proba(df_sc)[0]
    disease_idx   = int(np.argmax(disease_probs))

    try:
        disease_pred = le_disease.inverse_transform([disease_idx])[0]
    except Exception:
        disease_pred = "ADD" if outbreak_prob > 0.5 else "No_Outbreak"

    confidence = float(np.max(disease_probs)) * 100
    risk_score = int(outbreak_prob * 100)
    risk_level = (
        "Critical" if risk_score >= 75 else
        "High"     if risk_score >= 50 else
        "Medium"   if risk_score >= 25 else
        "Low"
    )

    actions = []
    if outbreak_prob > 0.5:
        actions.append("Immediate community alert via SMS")
    if fc > 100:
        actions.append("Emergency water chlorination treatment")
    if diag > 20:
        actions.append("Deploy ORS kits to affected villages")
    if rain > 300:
        actions.append("Inspect open wells for flood contamination")
    if not actions:
        actions = ["Continue routine surveillance",
                   "Monitor water quality weekly"]

    return {
        "district":            input_data.get("district", "Unknown"),
        "risk_score":          risk_score,
        "risk_level":          risk_level,
        "outbreak_prob_pct":   round(outbreak_prob * 100, 1),
        "predicted_disease":   disease_pred,
        "confidence_pct":      round(confidence, 1),
        "recommended_actions": actions,
        "timestamp":           pd.Timestamp.now().isoformat(),
    }

# STEP 7 — LSTM TIME-SERIES FORECASTING
def create_lstm_sequences(df: pd.DataFrame, feature_cols: list):
  
    print(f"\nCreating LSTM sequences...")
    print(f"  Sequence length  : {SEQUENCE_LENGTH} weeks lookback")
    print(f"  Forecast horizon : {FORECAST_HORIZON} weeks ahead")

    df_sorted = df.sort_values(["district", "date_start"]).reset_index(drop=True)
    X_list, y_list = [], []
    districts_used = 0

    for district in df_sorted["district"].unique():
        ddf = df_sorted[df_sorted["district"] == district].reset_index(drop=True)

        if len(ddf) < SEQUENCE_LENGTH + FORECAST_HORIZON:
            continue

        feats   = ddf[feature_cols].values.astype(np.float32)
        targets = ddf["outbreak_binary"].values.astype(np.float32)

        for i in range(len(ddf) - SEQUENCE_LENGTH - FORECAST_HORIZON + 1):
            X_seq = feats[i : i + SEQUENCE_LENGTH]
            y_avg = float(np.mean(
                targets[i + SEQUENCE_LENGTH : i + SEQUENCE_LENGTH + FORECAST_HORIZON]
            ))
            X_list.append(X_seq)
            y_list.append(y_avg)

        districts_used += 1

    X = np.array(X_list, dtype=np.float32)
    y = np.array(y_list, dtype=np.float32)

    print(f"  Districts used              : {districts_used} / {df['district'].nunique()}")
    print(f"  Total sequences created     : {X.shape[0]:,}")
    print(f"  X shape (samples,weeks,feat): {X.shape}")

    return X, y


def train_lstm_model(df: pd.DataFrame, output_dir: str = MODEL_DIR):

    print("\n" + "=" * 70)
    print("STEP 7: LSTM — 4-WEEK OUTBREAK FORECASTING (NE INDIA)")
    print("=" * 70)

    # Import TensorFlow
    try:
        import tensorflow as tf
        from tensorflow.keras.models import Sequential
        from tensorflow.keras.layers import (
            LSTM, Dense, Dropout, BatchNormalization
        )
        print(f"TensorFlow version : {tf.__version__}")
    except ImportError:
        print("TensorFlow not installed.")
        print("Activate venv_tf:  venv_tf\\Scripts\\activate")
        print("Then install:      pip install tensorflow")
        print("Skipping LSTM — XGBoost models are already saved.")
        return None, None, None

    # Prepare LSTM feature columns
    lstm_features = [f for f in LSTM_FEATURE_COLS if f in df.columns]
    print(f"LSTM features      : {len(lstm_features)}")

    # Create sequences
    X, y = create_lstm_sequences(df, lstm_features)

    if len(X) == 0:
        print("Not enough sequential data per district.")
        print("Each district needs at least 12 weekly records.")
        return None, None, None

    # Train/test split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    print(f"\nLSTM Train : {X_train.shape[0]:,} sequences")
    print(f"LSTM Test  : {X_test.shape[0]:,} sequences")

    # MinMaxScaler — scale all features to 0-1 range
    n_features  = X_train.shape[2]
    lstm_scaler = MinMaxScaler()
    X_tr_sc     = lstm_scaler.fit_transform(
        X_train.reshape(-1, n_features)
    ).reshape(X_train.shape)
    X_te_sc     = lstm_scaler.transform(
        X_test.reshape(-1, n_features)
    ).reshape(X_test.shape)

    # Build LSTM architecture
    print("\nLSTM Architecture:")
    print("  Input  --> LSTM(64, return_sequences=True)")
    print("         --> BatchNormalization --> Dropout(0.2)")
    print("         --> LSTM(32, return_sequences=False)")
    print("         --> Dropout(0.15)")
    print("         --> Dense(16, relu) --> Dropout(0.1)")
    print("         --> Dense(1, sigmoid)  output: probability 0.0-1.0")

    lstm_model = Sequential([
        LSTM(64, return_sequences=True,
             input_shape=(SEQUENCE_LENGTH, n_features),
             name="lstm_layer_1"),
        BatchNormalization(),
        Dropout(0.2),

        LSTM(32, return_sequences=False,
             name="lstm_layer_2"),
        Dropout(0.15),

        Dense(16, activation="relu", name="dense_hidden"),
        Dropout(0.1),
        Dense(1, activation="sigmoid", name="output"),
    ])

    lstm_model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
        loss="binary_crossentropy",
        metrics=["accuracy", tf.keras.metrics.AUC(name="auc")],
    )
    lstm_model.summary()

    # Callbacks
    callbacks = [
        tf.keras.callbacks.EarlyStopping(
            patience=15,
            restore_best_weights=True,
            monitor="val_auc",
            mode="max",
            verbose=1,
        ),
        tf.keras.callbacks.ReduceLROnPlateau(
            factor=0.5, patience=7, min_lr=1e-6, verbose=1,
        ),
    ]

    # Train
    print("\nTraining LSTM (max 100 epochs, early stopping on val_auc)...")
    lstm_model.fit(
        X_tr_sc, y_train,
        validation_data=(X_te_sc, y_test),
        epochs=100,
        batch_size=32,
        callbacks=callbacks,
        verbose=1,
    )

    # Evaluate
    print("\n" + "─" * 40)
    y_prob   = lstm_model.predict(X_te_sc, verbose=0).flatten()
    y_pred   = (y_prob >= 0.5).astype(int)
    y_true   = (y_test >= 0.5).astype(int)
    acc_lstm = accuracy_score(y_true, y_pred)
    auc_lstm = roc_auc_score(y_true, y_prob)

    print(f"LSTM Accuracy : {acc_lstm * 100:.2f}%")
    print(f"LSTM AUC-ROC  : {auc_lstm:.4f}")
    print(classification_report(
        y_true, y_pred,
        target_names=["No Outbreak", "Outbreak"]
    ))

    # Save LSTM artifacts
    os.makedirs(output_dir, exist_ok=True)
    lstm_model.save(f"{output_dir}/lstm_forecast_model.keras")
    joblib.dump(lstm_scaler,   f"{output_dir}/lstm_scaler.pkl")
    joblib.dump(lstm_features, f"{output_dir}/lstm_feature_cols.pkl")
    joblib.dump({
        "sequence_length":  SEQUENCE_LENGTH,
        "forecast_horizon": FORECAST_HORIZON,
        "n_features":       n_features,
    }, f"{output_dir}/lstm_config.pkl")

    print(f"\nLSTM artifacts saved to {output_dir}/")
    print("  lstm_forecast_model.keras  -- trained LSTM weights")
    print("  lstm_scaler.pkl            -- MinMaxScaler (0-1)")
    print("  lstm_feature_cols.pkl      -- LSTM feature list")
    print("  lstm_config.pkl            -- sequence configuration")

    return lstm_model, acc_lstm, auc_lstm


# STEP 8 — SAVE XGBOOST ARTIFACTS
def save_xgboost_artifacts(model_binary, model_multiclass,
                            scaler, le_disease,
                            output_dir: str = MODEL_DIR):
    """Save all XGBoost files for Flask /predict endpoint."""
    os.makedirs(output_dir, exist_ok=True)

    joblib.dump(model_binary,     f"{output_dir}/xgb_binary_outbreak.pkl")
    joblib.dump(model_multiclass, f"{output_dir}/xgb_multiclass_disease.pkl")
    joblib.dump(scaler,           f"{output_dir}/feature_scaler.pkl")
    joblib.dump(le_disease,       f"{output_dir}/label_encoder_disease.pkl")
    joblib.dump(FEATURE_COLS,     f"{output_dir}/feature_columns.pkl")

    print(f"\nXGBoost artifacts saved to {output_dir}/")
    print("  xgb_binary_outbreak.pkl    -- Binary outbreak predictor")
    print("  xgb_multiclass_disease.pkl -- Disease type predictor")
    print("  feature_scaler.pkl         -- StandardScaler")
    print("  label_encoder_disease.pkl  -- LabelEncoder")
    print("  feature_columns.pkl        -- Feature column list")


# MAIN — RUN COMPLETE PIPELINE
if __name__ == "__main__":

    # Step 1: Load NE India dataset
    df_raw = load_and_explore(DATASET_PATH)

    # Step 2: Feature engineering
    df = preprocess(df_raw)

    # Step 3: Prepare features and split
    (X_tr, X_te,
     yb_tr, yb_te,
     yd_tr, yd_te,
     scaler, le_disease, X_all) = prepare_features(df)

    # Step 4A: XGBoost binary classifier (outbreak yes/no)
    model_binary, y_probs = train_xgboost_binary(X_tr, X_te, yb_tr, yb_te)

    # Step 4B: XGBoost multi-class disease classifier
    classes = (le_disease.classes_
               if hasattr(le_disease, "classes_") and len(le_disease.classes_) > 2
               else ["No Outbreak", "Outbreak"])
    model_disease = train_xgboost_multiclass(
        X_tr, X_te, yd_tr, yd_te, classes
    )

    # Step 5: Feature importance ranking
    importance = analyze_feature_importance(model_binary, FEATURE_COLS, top_n=15)

    # Step 6: Sample prediction — East Jaintia Hills, monsoon week 25
    print("\n" + "=" * 70)
    print("STEP 6: SAMPLE PREDICTION — East Jaintia Hills, Week 25 (Monsoon)")
    print("=" * 70)
    sample = {
        "district":            "East Jaintia Hills",
        "ph":                  6.5,
        "turbidity_ntu":       28.3,
        "fecal_coliform":      719,
        "bod_mg_l":            8.2,
        "rainfall_mm":         700,
        "rainfall_lag1":       24.1,
        "rainfall_lag2":       42.4,
        "rainfall_4w_avg":     30.7,
        "temperature_c":       27.2,
        "humidity_pct":        90.8,
        "monsoon_flag":        1,
        "flood_risk_score":    0.22,
        "diarrhea_cases":      31,
        "dehydration_cases":   20,
        "jaundice_cases":      1,
        "population_density":  450,
        "sanitation_pct":      73,
        "open_defecation_pct": 27,
        "handwashing_pct":     52,
        "week_of_year":        25,
        "month":               6,
        "quarter":             2,
    }
    result = predict_outbreak_risk(
        model_binary, model_disease, scaler, le_disease, sample
    )
    print("\nPrediction Result:")
    for k, v in result.items():
        print(f"  {k:<25} : {v}")

    # Step 7: LSTM 4-week forecaster
    lstm_model, acc_lstm, auc_lstm = train_lstm_model(df)

    # Step 8: Save XGBoost artifacts
    save_xgboost_artifacts(model_binary, model_disease, scaler, le_disease)

    # Final summary
    print("\n" + "=" * 70)
    print("  PIPELINE COMPLETE — ALL MODELS TRAINED AND SAVED")
    print("=" * 70)
    print(f"\n  {'Model':<28} {'Result'}")
    print("  " + "─" * 50)
    print(f"  {'XGBoost Binary':<28} Trained and saved")
    print(f"  {'XGBoost Multi-class':<28} Trained and saved")
    if acc_lstm:
        print(f"  {'LSTM Forecaster':<28} Accuracy {acc_lstm*100:.2f}%  AUC {auc_lstm:.4f}")
    else:
        print(f"  {'LSTM Forecaster':<28} Skipped (TensorFlow not found)")

    print(f"\n  Saved files in {MODEL_DIR}:")
    for f in sorted(os.listdir(MODEL_DIR)):
        print(f"    {f}")
    print()
