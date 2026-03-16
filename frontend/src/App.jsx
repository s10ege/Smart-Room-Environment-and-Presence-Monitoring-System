import { useRef, useEffect } from 'react'
import { useSensorData }  from './hooks/useSensorData'
import { THRESHOLDS, HIST_MAX } from './constants'

import Header       from './components/Header/Header'
import AlertLog     from './components/AlertLog/AlertLog'
import SensorPanel  from './components/SensorPanel/SensorPanel'
import PeripheralRow from './components/PeripheralRow/PeripheralRow'
import Controls     from './components/Controls/Controls'
import StatusBar    from './components/StatusBar/StatusBar'

import s from './App.module.css'

// SVG icon path data (d attribute only) for each sensor panel
const ICON_TEMP = "M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"
const ICON_HUM  = "M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"
const ICON_DIST = "M16.24 7.76a6 6 0 0 1 0 8.49M7.76 16.24a6 6 0 0 1 0-8.49M20.49 3.51a12 12 0 0 1 0 16.97M3.51 20.49a12 12 0 0 1 0-16.97 M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0"

function pushHistory(arr, value, max) {
  if (value == null) return arr
  const next = [...arr, value]
  return next.length > max ? next.slice(next.length - max) : next
}

function getTempStatus(temp) {
  if (temp == null) return { level: null, label: 'NOMINAL' }
  if (temp >= THRESHOLDS.TEMP_ALERT) return { level: 'alert', label: 'CRITICAL' }
  if (temp >= THRESHOLDS.TEMP_WARN)  return { level: 'warn',  label: 'ELEVATED' }
  return { level: null, label: 'NOMINAL' }
}

function getHumStatus(hum) {
  if (hum == null) return { level: null, label: 'NOMINAL' }
  if (hum > THRESHOLDS.HUM_HIGH || hum < THRESHOLDS.HUM_LOW)
    return { level: 'warn', label: 'OUT OF RANGE' }
  return { level: null, label: 'NOMINAL' }
}

function getDistStatus(dist) {
  if (dist == null) return { level: null, label: 'CLEAR' }
  if (dist < THRESHOLDS.DIST_PRES) return { level: 'alert', label: 'OBJECT DETECTED' }
  return { level: null, label: 'CLEAR' }
}

export default function App() {
  const { sensors, status, connected, sendControl } = useSensorData()

  // Rolling history refs (no re-render on update; only SensorPanel re-renders via parent)
  const histRef = useRef({ temp: [], hum: [], dist: [] })

  useEffect(() => {
    histRef.current.temp = pushHistory(histRef.current.temp, sensors.temperature, HIST_MAX)
    histRef.current.hum  = pushHistory(histRef.current.hum,  sensors.humidity,    HIST_MAX)
    histRef.current.dist = pushHistory(histRef.current.dist, sensors.distance,    HIST_MAX)
  }, [sensors])

  const tempStatus = getTempStatus(sensors.temperature)
  const humStatus  = getHumStatus(sensors.humidity)
  const distStatus = getDistStatus(sensors.distance)

  return (
    <>
      <Header
        level={status.level}
        armed={status.armed}
        timestamp={sensors.timestamp}
      />

      <main className={s.main}>
        <AlertLog level={status.level} messages={status.messages} />

        <section className={s.panels} aria-label="Sensor readings">
          <SensorPanel
            label="TEMPERATURE"
            icon={ICON_TEMP}
            value={sensors.temperature}
            unit="°C"
            history={histRef.current.temp}
            barMin={THRESHOLDS.TEMP_MIN}
            barMax={THRESHOLDS.TEMP_MAX}
            thresholds={[
              { value: THRESHOLDS.TEMP_WARN,  type: 'warn' },
              { value: THRESHOLDS.TEMP_ALERT, type: 'alert' },
            ]}
            statusLevel={tempStatus.level}
            statusLabel={tempStatus.label}
            sensorId="DHT11 · GPIO4"
          />
          <SensorPanel
            label="RELATIVE HUMIDITY"
            icon={ICON_HUM}
            value={sensors.humidity}
            unit="%RH"
            history={histRef.current.hum}
            barMin={0}
            barMax={100}
            thresholds={[
              { value: THRESHOLDS.HUM_LOW,  type: 'warn' },
              { value: THRESHOLDS.HUM_HIGH, type: 'warn' },
            ]}
            statusLevel={humStatus.level}
            statusLabel={humStatus.label}
            sensorId="DHT11 · GPIO4"
          />
          <SensorPanel
            label="PROXIMITY DISTANCE"
            icon={ICON_DIST}
            value={sensors.distance}
            unit="cm"
            history={histRef.current.dist}
            barMin={0}
            barMax={THRESHOLDS.DIST_MAX}
            thresholds={[
              { value: THRESHOLDS.DIST_PRES, type: 'alert' },
            ]}
            statusLevel={distStatus.level}
            statusLabel={distStatus.label}
            sensorId="HC-SR04 · GPIO17/27"
          />
        </section>

        <PeripheralRow
          presence={status.presence}
          led={sensors.led}
          buzzer={sensors.buzzer}
          button={sensors.button}
        />

        <Controls onControl={sendControl} />

        <StatusBar connected={connected} timestamp={sensors.timestamp} />
      </main>

      <footer className={s.footer}>
        Smart Room Environment &amp; Presence Monitor &nbsp;&middot;&nbsp;
        Raspberry Pi IoT &nbsp;&middot;&nbsp;
        DHT11 · HC-SR04 · GPIO
      </footer>
    </>
  )
}
