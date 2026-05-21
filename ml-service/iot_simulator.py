"""
IoT Sensor Simulator — Smart Health Monitor
Simulates 6 water quality sensors across NE India districts
Sends real-time data to your backend every 30 seconds
"""
import requests, time, random, math
from datetime import datetime

BACKEND_URL = "http://localhost:3001/api/water"

SENSORS = [
    {"sensor_id": "S-001", "district_id": 1, "district": "East Jaintia Hills",
     "base_ph": 6.5, "base_turbidity": 28.0, "base_fc": 700.0},
    {"sensor_id": "S-002", "district_id": 2, "district": "West Jaintia Hills",
     "base_ph": 6.8, "base_turbidity": 15.0, "base_fc": 310.0},
    {"sensor_id": "S-003", "district_id": 3, "district": "Kamrup",
     "base_ph": 7.1, "base_turbidity": 8.5,  "base_fc": 125.0},
    {"sensor_id": "S-004", "district_id": 4, "district": "Cachar",
     "base_ph": 6.9, "base_turbidity": 12.0, "base_fc": 250.0},
    {"sensor_id": "S-005", "district_id": 5, "district": "Imphal East",
     "base_ph": 7.3, "base_turbidity": 4.2,  "base_fc": 52.0},
    {"sensor_id": "S-006", "district_id": 6, "district": "Udalguri",
     "base_ph": 7.0, "base_turbidity": 9.8,  "base_fc": 180.0},
]

def add_noise(value, pct=0.08):
    """Add ±8% realistic sensor noise"""
    noise = value * pct * (random.random() * 2 - 1)
    return round(value + noise, 2)

def monsoon_factor():
    """Higher readings during monsoon months (June-September)"""
    month = datetime.now().month
    return 1.4 if month in [6, 7, 8, 9] else 1.0

def read_sensor(sensor):
    """Simulate a sensor reading with noise and monsoon effect"""
    factor = monsoon_factor()
    return {
        "sensor_id":     sensor["sensor_id"],
        "district_id":   sensor["district_id"],
        "ph":            add_noise(sensor["base_ph"]),
        "turbidity_ntu": add_noise(sensor["base_turbidity"] * factor),
        "fecal_coliform":add_noise(sensor["base_fc"] * factor),
        "bod_mg_l":      add_noise(sensor["base_turbidity"] * factor * 0.3),
        "temperature_c": add_noise(27.5),
    }

def send_to_backend(reading):
    """POST sensor data to Node.js backend"""
    try:
        res = requests.post(BACKEND_URL, json=reading, timeout=5)
        if res.status_code == 200:
            print(f"  ✅ {reading['sensor_id']} → pH:{reading['ph']} "
                  f"Turbidity:{reading['turbidity_ntu']} FC:{reading['fecal_coliform']}")
        else:
            print(f"  ❌ {reading['sensor_id']} — HTTP {res.status_code}")
    except Exception as e:
        print(f"  ⚠️  {reading['sensor_id']} — Connection error: {e}")

print("=" * 55)
print("  IoT Sensor Simulator — Smart Health Monitor")
print("  Sending data every 30 seconds to localhost:3001")
print("=" * 55)

cycle = 1
while True:
    print(f"\n[Cycle {cycle}] {datetime.now().strftime('%H:%M:%S')} — Reading all sensors...")
    for sensor in SENSORS:
        reading = read_sensor(sensor)
        send_to_backend(reading)
        time.sleep(1)
    print(f"  Next reading in 30 seconds...")
    cycle += 1
    time.sleep(30)