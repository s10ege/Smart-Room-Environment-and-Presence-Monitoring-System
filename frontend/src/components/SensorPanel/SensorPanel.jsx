import {
  ResponsiveContainer, LineChart, Line,
  ReferenceLine, YAxis,
} from 'recharts'
import s from './SensorPanel.module.css'

/**
 * Reusable sensor panel used for temperature, humidity, and distance.
 *
 * Props:
 *   label        – panel header text
 *   icon         – SVG path string for the header icon
 *   value        – current reading (number | null)
 *   unit         – unit label ("°C", "%RH", "cm")
 *   history      – rolling array of numbers for the sparkline
 *   barMin/Max   – range for the progress bar
 *   thresholds   – array of { value, type: 'warn' | 'alert' } for reference lines
 *   statusLevel  – null | 'warn' | 'alert' (controls panel color)
 *   statusLabel  – text shown in footer ("NOMINAL", "ELEVATED", etc.)
 *   sensorId     – hardware label ("DHT11 · GPIO4")
 */
export default function SensorPanel({
  label, icon, value, unit,
  history, barMin, barMax,
  thresholds = [],
  statusLevel,
  statusLabel,
  sensorId,
}) {
  const panelClass = statusLevel
    ? `${s.panel} ${s[statusLevel]}`
    : s.panel

  const displayValue = value != null
    ? (unit === '%RH' ? value.toFixed(0) : value.toFixed(1))
    : '—'

  const barPct = value != null
    ? Math.min(100, Math.max(0, ((value - barMin) / (barMax - barMin)) * 100)).toFixed(1)
    : 0

  const chartData = history.map((v, i) => ({ i, value: v }))

  const lineStroke = statusLevel === 'alert'
    ? 'var(--alert)'
    : statusLevel === 'warn'
    ? 'var(--warn)'
    : 'var(--accent)'

  return (
    <div className={panelClass}>
      <div className={s.panelHeader}>
        <span className={s.label}>{label}</span>
        <svg className={s.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d={icon} />
        </svg>
      </div>

      <div className={s.reading}>
        <span className={s.value}>{displayValue}</span>
        <span className={s.unit}>{unit}</span>
      </div>

      <div className={s.sparkWrap}>
        <ResponsiveContainer width="100%" height={40}>
          <LineChart data={chartData} margin={{ top: 2, right: 4, bottom: 2, left: 4 }}>
            <YAxis domain={[barMin, barMax]} hide />
            <Line
              type="monotone"
              dataKey="value"
              dot={false}
              stroke={lineStroke}
              strokeWidth={1.5}
              strokeOpacity={0.6}
              isAnimationActive={false}
            />
            {thresholds.map((t, i) => (
              <ReferenceLine
                key={i}
                y={t.value}
                stroke={t.type === 'alert' ? 'var(--alert)' : 'var(--warn)'}
                strokeDasharray="3 3"
                strokeWidth={1}
                strokeOpacity={0.5}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className={s.barWrap}>
        <div className={s.barTrack}>
          <div className={s.barFill} style={{ width: `${barPct}%` }} />
          {thresholds.map((t, i) => {
            const left = ((t.value - barMin) / (barMax - barMin) * 100).toFixed(1)
            return (
              <span
                key={i}
                className={t.type === 'alert' ? `${s.tick} ${s.alertTick}` : `${s.tick} ${s.warnTick}`}
                style={{ left: `${left}%` }}
              />
            )
          })}
        </div>
        <div className={s.scale}>
          <span>{barMin}{unit === '%RH' ? '%' : unit === 'cm' ? ' cm' : '°C'}</span>
          {thresholds.map((t, i) => (
            <span
              key={i}
              className={t.type === 'alert' ? s.scaleAlert : s.scaleWarn}
            >
              {t.value}{unit === '%RH' ? '%' : unit === 'cm' ? ' cm' : '°'}
            </span>
          ))}
          <span>{barMax}{unit === '%RH' ? '%' : unit === 'cm' ? ' cm' : '°C'}</span>
        </div>
      </div>

      <div className={s.footer}>
        <span className={s.rangeLabel}>{statusLabel}</span>
        <span className={s.sensorId}>{sensorId}</span>
      </div>
    </div>
  )
}
