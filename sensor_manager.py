"""
sensor_manager.py
-----------------
Handles all hardware sensor I/O for the Smart Room Monitor.

Sensors managed:
  - DHT11  : temperature + humidity  (GPIO 4)
  - HC-SR04: ultrasonic distance     (TRIG → GPIO 17, ECHO → GPIO 27)
  - Push button                      (GPIO 24)
  - LED                              (GPIO 22)
  - Buzzer                           (GPIO 23)

The module runs a background polling thread so Flask routes never
block waiting for slow GPIO reads.  All latest readings are stored
in a thread-safe dictionary that any part of the application can
query without delay.
"""

import time
import threading
import logging
from datetime import datetime

# ── Graceful simulation fallback ────────────────────────────────────────────
# On a development machine (non-Raspberry-Pi), RPi.GPIO and Adafruit_DHT are
# unavailable.  We import them with a try/except so the project still runs in
# "simulation mode" on any OS.
try:
    import RPi.GPIO as GPIO
    import board
    import adafruit_dht
    HARDWARE_AVAILABLE = True
except ImportError:
    HARDWARE_AVAILABLE = False
    import math, random          # used only in simulation mode

# ── GPIO pin definitions ─────────────────────────────────────────────────────
PIN_DHT11   = 4     # DHT11 data line
PIN_TRIG    = 17    # HC-SR04 trigger
PIN_ECHO    = 27    # HC-SR04 echo  (connected through voltage divider)
PIN_LED     = 22    # LED (active HIGH)
PIN_BUZZER  = 23    # Buzzer (active HIGH)
PIN_BUTTON  = 24    # Push button (pulled LOW when pressed)

# ── Sensor constants ─────────────────────────────────────────────────────────
SOUND_SPEED_CM_US = 0.0343  # cm per microsecond (speed of sound at ~20 °C)
MAX_DISTANCE_CM   = 400     # HC-SR04 rated maximum range

# ── Polling intervals (seconds) ──────────────────────────────────────────────
DHT_POLL_INTERVAL      = 2.0   # DHT11 max sample rate ≈ 1 Hz; use 2 s for safety
ULTRASONIC_POLL_INTERVAL = 0.2  # 5 Hz – fast enough for presence detection

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
class SensorManager:
    """
    Encapsulates GPIO setup, sensor reading, actuator control, and a
    background polling thread.

    Usage
    -----
        mgr = SensorManager()
        mgr.start()                 # begins background polling
        data = mgr.get_readings()   # returns latest snapshot dict
        mgr.set_led(True)
        mgr.stop()
    """

    def __init__(self):
        self._lock = threading.Lock()
        self._running = False
        self._thread = None

        # Shared state – always accessed under self._lock
        self._readings = {
            "temperature":  None,   # °C
            "humidity":     None,   # %
            "distance":     None,   # cm
            "button":       False,  # True = pressed
            "led":          False,
            "buzzer":       False,
            "timestamp":    None,
            "dht_error":    False,
            "ultrasonic_error": False,
        }

        self._prev_button = False
        self.button_callback = None   # set by app.py to handle button presses

        self._setup_hardware()

    # ── Hardware initialisation ───────────────────────────────────────────────
    def _setup_hardware(self):
        if not HARDWARE_AVAILABLE:
            logger.warning("RPi.GPIO / adafruit_dht not found – running in simulation mode.")
            return

        self._dht_device = adafruit_dht.DHT11(board.D4)

        GPIO.setmode(GPIO.BCM)
        GPIO.setwarnings(False)

        GPIO.setup(PIN_TRIG,   GPIO.OUT, initial=GPIO.LOW)
        GPIO.setup(PIN_ECHO,   GPIO.IN)
        GPIO.setup(PIN_LED,    GPIO.OUT, initial=GPIO.LOW)
        GPIO.setup(PIN_BUZZER, GPIO.OUT, initial=GPIO.LOW)
        # Internal pull-down: button pulls line HIGH when pressed (external
        # pull-down resistor is also present on the breadboard as a safety net)
        GPIO.setup(PIN_BUTTON, GPIO.IN, pull_up_down=GPIO.PUD_DOWN)

        logger.info("GPIO initialised (BCM mode).")

    # ── DHT11 reading ─────────────────────────────────────────────────────────
    def _read_dht11(self):
        """
        Returns (temperature_C, humidity_%) or (None, None) on failure.

        Adafruit_DHT.read_retry() attempts up to 15 retries internally,
        waiting 2 s between each, so this call may block for several seconds
        on a noisy line.
        """
        if not HARDWARE_AVAILABLE:
            # Simulate realistic indoor values with slow drift
            t = time.time()
            temp = 22.0 + 3.0 * math.sin(t / 60)
            hum  = 55.0 + 10.0 * math.sin(t / 90 + 1)
            return round(temp, 1), round(hum, 1)

        try:
            temperature = self._dht_device.temperature
            humidity = self._dht_device.humidity
        except RuntimeError as e:
            logger.debug("DHT11 read failed: %s", e)
            return None, None
        if humidity is None or temperature is None:
            logger.debug("DHT11 read failed (None returned).")
            return None, None
        # Clamp to physically plausible range
        if not (0 <= temperature <= 60 and 0 <= humidity <= 100):
            logger.debug("DHT11 out-of-range: T=%.1f H=%.1f", temperature, humidity)
            return None, None
        return round(temperature, 1), round(humidity, 1)

    # ── HC-SR04 reading ───────────────────────────────────────────────────────
    def _read_ultrasonic(self):
        """
        Sends a 10 µs trigger pulse, then times the ECHO high period.
        Returns distance in cm, or None on timeout.

        Voltage divider note
        --------------------
        The HC-SR04 ECHO pin outputs 5 V logic.  A 1 kΩ / 2 kΩ voltage
        divider reduces this to 3.3 V before it reaches GPIO 27, protecting
        the Raspberry Pi from overvoltage damage.
        """
        if not HARDWARE_AVAILABLE:
            # Simulate a distance that oscillates to trigger presence detection
            t = time.time()
            dist = 150 + 120 * math.sin(t / 8)
            return round(dist, 1)

        # ── Trigger pulse ──────────────────────────────────────────────────
        GPIO.output(PIN_TRIG, GPIO.LOW)
        time.sleep(0.000002)          # 2 µs settle
        GPIO.output(PIN_TRIG, GPIO.HIGH)
        time.sleep(0.000010)          # 10 µs pulse
        GPIO.output(PIN_TRIG, GPIO.LOW)

        # ── Wait for ECHO to go HIGH ───────────────────────────────────────
        timeout_start = time.time()
        while GPIO.input(PIN_ECHO) == GPIO.LOW:
            if time.time() - timeout_start > 0.05:    # 50 ms timeout
                logger.debug("HC-SR04: timeout waiting for ECHO HIGH")
                return None

        pulse_start = time.time()

        # ── Wait for ECHO to go LOW ────────────────────────────────────────
        while GPIO.input(PIN_ECHO) == GPIO.HIGH:
            if time.time() - pulse_start > 0.05:
                logger.debug("HC-SR04: timeout waiting for ECHO LOW")
                return None

        pulse_duration = time.time() - pulse_start          # seconds
        distance = (pulse_duration * 1_000_000) * SOUND_SPEED_CM_US / 2
        # pulse_duration × 10^6 → µs;  ÷ 2 because sound travels there AND back

        if distance > MAX_DISTANCE_CM:
            return None   # out of range; treat as no obstacle

        return round(distance, 1)

    # ── Button reading ────────────────────────────────────────────────────────
    def _read_button(self):
        if not HARDWARE_AVAILABLE:
            return False
        return GPIO.input(PIN_BUTTON) == GPIO.HIGH

    # ── Actuator control ──────────────────────────────────────────────────────
    def set_led(self, state: bool):
        with self._lock:
            self._readings["led"] = state
        if HARDWARE_AVAILABLE:
            GPIO.output(PIN_LED, GPIO.HIGH if state else GPIO.LOW)

    def set_buzzer(self, state: bool):
        with self._lock:
            self._readings["buzzer"] = state
        if HARDWARE_AVAILABLE:
            GPIO.output(PIN_BUZZER, GPIO.HIGH if state else GPIO.LOW)

    # ── Background polling loop ───────────────────────────────────────────────
    def _poll_loop(self):
        """
        Separate thread that continuously updates self._readings.
        DHT11 and ultrasonic are polled at different intervals because:
          - DHT11 is slow (min 1 s between reads) and its data changes slowly.
          - HC-SR04 should be polled faster for responsive presence detection.
        """
        last_dht_time = 0

        while self._running:
            now = time.time()

            # ── Ultrasonic + button (every ULTRASONIC_POLL_INTERVAL) ───────
            distance = self._read_ultrasonic()
            button   = self._read_button()

            # ── Button edge detection (rising edge = press, with debounce) ──
            if button and not self._prev_button:
                time.sleep(0.05)  # 50 ms debounce
                if HARDWARE_AVAILABLE:
                    button = GPIO.input(PIN_BUTTON) == GPIO.HIGH
                if button:
                    logger.info("Button pressed.")
                    cb = self.button_callback
                    if cb:
                        try:
                            cb()
                        except Exception as e:
                            logger.error("Button callback error: %s", e)
            self._prev_button = button

            # ── DHT11 (every DHT_POLL_INTERVAL) ───────────────────────────
            temp, hum = None, None
            dht_error = False
            if (now - last_dht_time) >= DHT_POLL_INTERVAL:
                temp, hum = self._read_dht11()
                last_dht_time = now
                dht_error = (temp is None)

            with self._lock:
                if temp is not None:
                    self._readings["temperature"] = temp
                    self._readings["humidity"]    = hum
                self._readings["dht_error"]        = dht_error
                self._readings["distance"]         = distance
                self._readings["ultrasonic_error"] = (distance is None)
                self._readings["button"]           = button
                self._readings["timestamp"]        = datetime.now().isoformat(timespec="seconds")

            time.sleep(ULTRASONIC_POLL_INTERVAL)

    # ── Public API ────────────────────────────────────────────────────────────
    def start(self):
        """Start the background polling thread."""
        self._running = True
        self._thread = threading.Thread(target=self._poll_loop, daemon=True, name="sensor-poll")
        self._thread.start()
        logger.info("SensorManager polling thread started.")

    def stop(self):
        """Stop polling and release GPIO resources."""
        self._running = False
        if self._thread:
            self._thread.join(timeout=3)
        if HARDWARE_AVAILABLE:
            self._dht_device.exit()
            GPIO.cleanup()
        logger.info("SensorManager stopped, GPIO cleaned up.")

    def get_readings(self) -> dict:
        """Return a thread-safe snapshot of the latest sensor readings."""
        with self._lock:
            return dict(self._readings)
