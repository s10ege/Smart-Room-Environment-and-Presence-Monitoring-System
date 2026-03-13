"""
alert_logic.py
--------------
Contains all system-state decision rules for the Smart Room Monitor.

The AlertEngine evaluates the latest sensor snapshot and returns a
structured SystemStatus that the Flask app and actuator controller
can both use.

State machine
-------------
    SAFE     →  all readings within normal range, no presence (or disarmed)
    WARNING  →  temperature elevated OR presence detected (system armed)
    ALERT    →  critical temperature OR (presence + high temp) combined

Each state maps directly to a dashboard colour and buzzer/LED behaviour.
"""

import logging
from dataclasses import dataclass, field
from typing import List
from datetime import datetime

logger = logging.getLogger(__name__)

# ── Threshold constants ───────────────────────────────────────────────────────
TEMP_WARNING_C   = 28.0   # °C  → yellow warning
TEMP_ALERT_C     = 35.0   # °C  → red alert + buzzer

HUMIDITY_HIGH_PCT  = 70.0  # %  → warning (high humidity = discomfort / mould risk)
HUMIDITY_LOW_PCT   = 30.0  # %  → warning (too dry = health risk)

PRESENCE_DISTANCE_CM = 100.0  # cm  → object closer than this = presence detected

# ── Status levels ─────────────────────────────────────────────────────────────
STATUS_SAFE    = "SAFE"
STATUS_WARNING = "WARNING"
STATUS_ALERT   = "ALERT"


@dataclass
class SystemStatus:
    """
    Immutable snapshot of the evaluated system state.

    Attributes
    ----------
    level       : one of STATUS_SAFE / STATUS_WARNING / STATUS_ALERT
    messages    : human-readable list of active alert messages
    led_on      : whether the LED should be illuminated
    buzzer_on   : whether the buzzer should be sounding
    presence    : True if an object / person is within PRESENCE_DISTANCE_CM
    evaluated_at: ISO-8601 timestamp of evaluation
    """
    level:        str
    messages:     List[str] = field(default_factory=list)
    led_on:       bool = False
    buzzer_on:    bool = False
    presence:     bool = False
    evaluated_at: str  = field(default_factory=lambda: datetime.now().isoformat(timespec="seconds"))

    def to_dict(self) -> dict:
        return {
            "level":        self.level,
            "messages":     self.messages,
            "led_on":       self.led_on,
            "buzzer_on":    self.buzzer_on,
            "presence":     self.presence,
            "evaluated_at": self.evaluated_at,
        }


# ─────────────────────────────────────────────────────────────────────────────
class AlertEngine:
    """
    Stateless evaluator – call evaluate() with a readings dict each cycle.

    The 'armed' flag is stored in the Flask application layer and passed
    in on each call, keeping this module free of web-framework coupling.
    """

    # ── Rule evaluators ───────────────────────────────────────────────────────
    @staticmethod
    def _check_temperature(temp, messages: list) -> str:
        """Returns STATUS_ALERT, STATUS_WARNING, or STATUS_SAFE based on temp."""
        if temp is None:
            return STATUS_SAFE   # unknown – don't raise false alarm
        if temp >= TEMP_ALERT_C:
            messages.append(f"CRITICAL: Temperature {temp:.1f}°C exceeds {TEMP_ALERT_C}°C limit.")
            return STATUS_ALERT
        if temp >= TEMP_WARNING_C:
            messages.append(f"WARNING: Temperature {temp:.1f}°C above comfort threshold ({TEMP_WARNING_C}°C).")
            return STATUS_WARNING
        return STATUS_SAFE

    @staticmethod
    def _check_humidity(hum, messages: list) -> str:
        if hum is None:
            return STATUS_SAFE
        if hum > HUMIDITY_HIGH_PCT:
            messages.append(f"WARNING: Humidity {hum:.0f}% is too high (>{HUMIDITY_HIGH_PCT:.0f}%).")
            return STATUS_WARNING
        if hum < HUMIDITY_LOW_PCT:
            messages.append(f"WARNING: Humidity {hum:.0f}% is too low (<{HUMIDITY_LOW_PCT:.0f}%).")
            return STATUS_WARNING
        return STATUS_SAFE

    @staticmethod
    def _check_presence(distance, armed: bool, messages: list) -> tuple:
        """Returns (presence: bool, status_level: str)."""
        if distance is None:
            return False, STATUS_SAFE
        presence = distance < PRESENCE_DISTANCE_CM
        if presence and armed:
            messages.append(
                f"ALERT: Object detected at {distance:.1f} cm (threshold: {PRESENCE_DISTANCE_CM:.0f} cm)."
            )
            return True, STATUS_ALERT
        if presence:
            messages.append(f"NOTICE: Presence detected at {distance:.1f} cm (system disarmed).")
            return True, STATUS_WARNING
        return False, STATUS_SAFE

    # ── Combine rule into a single status level ───────────────────────────────
    @staticmethod
    def _worst_of(*levels: str) -> str:
        priority = {STATUS_SAFE: 0, STATUS_WARNING: 1, STATUS_ALERT: 2}
        return max(levels, key=lambda s: priority.get(s, 0))

    # ── Main evaluation entry point ───────────────────────────────────────────
    def evaluate(self, readings: dict, armed: bool) -> SystemStatus:
        """
        Evaluate all rules against the current sensor readings.

        Parameters
        ----------
        readings : dict  – output of SensorManager.get_readings()
        armed    : bool  – True when the system is in monitoring mode

        Returns
        -------
        SystemStatus dataclass instance
        """
        messages = []
        presence = False

        temp = readings.get("temperature")
        hum  = readings.get("humidity")
        dist = readings.get("distance")

        temp_level     = self._check_temperature(temp, messages)
        hum_level      = self._check_humidity(hum, messages)
        presence, pres_level = self._check_presence(dist, armed, messages)

        # ── Combined rule: presence AND elevated temperature ───────────────
        if presence and temp is not None and temp >= TEMP_WARNING_C and armed:
            messages.append(
                "COMBINED ALERT: Presence detected while temperature is elevated – "
                "possible emergency situation."
            )
            combined_level = STATUS_ALERT
        else:
            combined_level = STATUS_SAFE

        overall = self._worst_of(temp_level, hum_level, pres_level, combined_level)

        # ── Actuator mapping ───────────────────────────────────────────────
        led_on    = overall in (STATUS_WARNING, STATUS_ALERT)
        buzzer_on = overall == STATUS_ALERT

        if not messages:
            messages.append("All readings within normal range.")

        status = SystemStatus(
            level=overall,
            messages=messages,
            led_on=led_on,
            buzzer_on=buzzer_on,
            presence=presence,
        )

        logger.debug("AlertEngine → %s | presence=%s | msgs=%d", overall, presence, len(messages))
        return status
