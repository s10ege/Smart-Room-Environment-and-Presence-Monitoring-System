"""
app.py
------
Main Flask application for the Smart Room Environment and Presence Monitor.

Entry point – run on the Raspberry Pi with:
    python app.py

The server binds to 0.0.0.0:5000 so any device on the same WiFi network
can access the dashboard at  http://<pi-ip-address>:5000

Architecture overview
---------------------
 ┌──────────────────────────────────────────────────────────┐
 │                     Raspberry Pi                         │
 │                                                          │
 │  GPIO hardware                                           │
 │     ↕ (BCM pins)                                         │
 │  SensorManager (background thread)                       │
 │     ↕ (thread-safe dict snapshot)                        │
 │  AlertEngine (stateless rule evaluator)                  │
 │     ↕                                                    │
 │  Flask web server  ──→  /          (dashboard HTML)      │
 │                    ──→  /api/sensors  (JSON readings)    │
 │                    ──→  /api/status   (JSON system state)│
 │                    ──→  /api/control  (POST: arm/reset)  │
 └──────────────────────────────────────────────────────────┘
         ↕  WiFi / HTTP
 ┌──────────────────┐
 │   Browser / Phone │  http://<pi-ip>:5000
 └──────────────────┘
"""

import logging
import os
import json
import time
from datetime import datetime
from flask import Flask, render_template, jsonify, request

from sensor_manager import SensorManager
from alert_logic import AlertEngine, STATUS_SAFE, STATUS_WARNING, STATUS_ALERT

# ── Logging setup ─────────────────────────────────────────────────────────────
LOG_FILE = os.path.join(os.path.dirname(__file__), "logs", "monitor.log")
os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger(__name__)

# ── Flask app ─────────────────────────────────────────────────────────────────
app = Flask(__name__)

# ── Application state ─────────────────────────────────────────────────────────
sensor_mgr    = SensorManager()
alert_engine  = AlertEngine()

# These flags live here (application layer) rather than in the business-logic
# modules so that the Flask routes can mutate them via POST requests.
system_armed  = True    # True  = monitoring active; False = disarmed (silent)
alarm_reset   = False   # True  = user acknowledged last alert; cleared next cycle
buzzer_silenced_until = 0.0  # timestamp until which buzzer is suppressed

# ── Button callback: silences the buzzer for 5 seconds ────────────────────────
def _on_button_press():
    global buzzer_silenced_until
    buzzer_silenced_until = time.time() + 5
    sensor_mgr.set_buzzer(False)
    logger.info("Buzzer silenced for 5 seconds via button.")

sensor_mgr.button_callback = _on_button_press

# ── Startup: begin sensor polling ─────────────────────────────────────────────
sensor_mgr.start()
logger.info("Smart Room Monitor started.")


# ─────────────────────────────────────────────────────────────────────────────
# Helper
# ─────────────────────────────────────────────────────────────────────────────
def _current_status():
    """
    Read latest sensor data, evaluate alert rules, drive actuators,
    and return both the readings dict and a SystemStatus object.
    """
    readings = sensor_mgr.get_readings()
    status   = alert_engine.evaluate(readings, armed=system_armed)

    # ── Actuator control ───────────────────────────────────────────────────
    # Suppress buzzer if button was pressed within the last 5 seconds.
    buzzer_suppressed = time.time() < buzzer_silenced_until
    sensor_mgr.set_led(status.led_on)
    sensor_mgr.set_buzzer(status.buzzer_on and not buzzer_suppressed)

    # ── Log significant events ─────────────────────────────────────────────
    if status.level != STATUS_SAFE:
        logger.warning("STATUS %s | T=%.1f°C H=%.1f%% D=%s cm | %s",
                       status.level,
                       readings.get("temperature") or 0,
                       readings.get("humidity")    or 0,
                       readings.get("distance"),
                       "; ".join(status.messages))

    return readings, status


# ─────────────────────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/")
def dashboard():
    """
    Serve the main HTML dashboard.

    The page uses JavaScript fetch() to poll /api/sensors and /api/status
    every 2 seconds, so the template itself is rendered only once –
    subsequent data updates happen client-side without page reloads.
    """
    return render_template("index.html", armed=system_armed)


@app.route("/api/sensors")
def api_sensors():
    """
    GET /api/sensors
    ----------------
    Returns the latest raw sensor readings as JSON.

    Response schema
    ---------------
    {
        "temperature":  22.5,     // °C  (null if DHT11 error)
        "humidity":     58.0,     // %   (null if DHT11 error)
        "distance":     143.2,    // cm  (null if out-of-range)
        "button":       false,    // true when push button is pressed
        "led":          false,
        "buzzer":       false,
        "timestamp":    "2024-11-25T14:30:05",
        "dht_error":    false,
        "ultrasonic_error": false
    }
    """
    readings, _ = _current_status()
    return jsonify(readings)


@app.route("/api/status")
def api_status():
    """
    GET /api/status
    ---------------
    Returns the evaluated system state as JSON.

    Response schema
    ---------------
    {
        "level":        "SAFE",          // "SAFE" | "WARNING" | "ALERT"
        "messages":     ["All OK."],
        "led_on":       false,
        "buzzer_on":    false,
        "presence":     false,
        "evaluated_at": "2024-11-25T14:30:05",
        "armed":        true
    }
    """
    _, status = _current_status()
    payload = status.to_dict()
    payload["armed"] = system_armed
    return jsonify(payload)


@app.route("/api/control", methods=["POST"])
def api_control():
    """
    POST /api/control
    -----------------
    Accepts a JSON body to control system behaviour.

    Supported actions
    -----------------
    { "action": "arm"    }   → enable monitoring
    { "action": "disarm" }   → silence alerts, disable presence detection
    { "action": "reset"  }   → acknowledge current alarm (silences buzzer once)

    Response
    --------
    { "ok": true, "armed": true, "action": "arm" }
    """
    global system_armed, alarm_reset

    data   = request.get_json(force=True, silent=True) or {}
    action = data.get("action", "").lower()

    if action == "arm":
        system_armed = True
        logger.info("System ARMED via API.")
    elif action == "disarm":
        system_armed = False
        sensor_mgr.set_led(False)
        sensor_mgr.set_buzzer(False)
        logger.info("System DISARMED via API.")
    elif action == "reset":
        alarm_reset = True
        logger.info("Alarm RESET via API.")
    else:
        return jsonify({"ok": False, "error": f"Unknown action: {action!r}"}), 400

    return jsonify({"ok": True, "armed": system_armed, "action": action})


# ─────────────────────────────────────────────────────────────────────────────
# Application entry point
# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    try:
        # host="0.0.0.0" → accessible from any device on the local network
        # debug=False     → never use debug mode on physical hardware (GPIO safety)
        app.run(host="0.0.0.0", port=5000, debug=False, use_reloader=False)
    finally:
        sensor_mgr.stop()
