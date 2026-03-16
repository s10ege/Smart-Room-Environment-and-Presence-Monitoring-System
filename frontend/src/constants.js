export const THRESHOLDS = {
  TEMP_WARN:  28,
  TEMP_ALERT: 30,   // matches alert_logic.py TEMP_ALERT_C = 30.0
  TEMP_MIN:   0,
  TEMP_MAX:   50,

  HUM_LOW:    30,
  HUM_HIGH:   70,

  DIST_PRES:  100,
  DIST_MAX:   400,
}

export const POLL_MS  = 2000
export const HIST_MAX = 40
