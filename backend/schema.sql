\c healthmonitor

CREATE TABLE locations (
  location_id SERIAL PRIMARY KEY,
  district    VARCHAR(100) NOT NULL,
  state       VARCHAR(100) NOT NULL,
  latitude    DECIMAL(9,6),
  longitude   DECIMAL(9,6),
  population  INT,
  density     DECIMAL(8,2)
);

CREATE TABLE users (
  user_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(120) NOT NULL,
  phone         VARCHAR(15) UNIQUE NOT NULL,
  role          VARCHAR(20) CHECK (role IN ('ASHA','PHC_OFFICER','STATE_ADMIN')),
  district_id   INT REFERENCES locations(location_id),
  language_pref VARCHAR(10) DEFAULT 'en',
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE disease_reports (
  report_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(user_id),
  district_id     INT REFERENCES locations(location_id),
  disease_type    VARCHAR(50),
  cases           INT DEFAULT 0,
  deaths          INT DEFAULT 0,
  diarrhea_cnt    INT DEFAULT 0,
  dehydration_cnt INT DEFAULT 0,
  jaundice_cnt    INT DEFAULT 0,
  week_number     INT NOT NULL,
  year            INT NOT NULL,
  source          VARCHAR(20) DEFAULT 'APP',
  submitted_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE water_quality (
  id             BIGSERIAL PRIMARY KEY,
  sensor_id      VARCHAR(20),
  district_id    INT REFERENCES locations(location_id),
  ph             DECIMAL(4,2),
  turbidity_ntu  DECIMAL(7,3),
  fecal_coliform DECIMAL(10,2),
  bod_mg_l       DECIMAL(6,2),
  temperature_c  DECIMAL(4,1),
  recorded_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ml_predictions (
  pred_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id       INT REFERENCES locations(location_id),
  risk_score        DECIMAL(5,2),
  risk_level        VARCHAR(20),
  predicted_disease VARCHAR(50),
  confidence        DECIMAL(5,2),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE alerts (
  alert_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id INT REFERENCES locations(location_id),
  alert_type  VARCHAR(30),
  severity    VARCHAR(20),
  message     TEXT,
  sent_at     TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

INSERT INTO locations (district, state, latitude, longitude, population, density) VALUES
  ('East Jaintia Hills','Meghalaya',25.25,92.48,122436,31.5),
  ('West Jaintia Hills','Meghalaya',25.45,92.15,132806,47.6),
  ('Kamrup','Assam',26.19,91.74,1517956,512.8),
  ('Cachar','Assam',24.83,92.78,1736617,285.5),
  ('Imphal East','Manipur',24.82,93.94,456113,329.7),
  ('Udalguri','Assam',26.76,92.09,832769,291.4);