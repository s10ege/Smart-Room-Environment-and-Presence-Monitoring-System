import { ResponsiveContainer, LineChart, Line, ReferenceLine, YAxis } from 'recharts'
import s from './SensorPanel.module.css'

export default function SensorPanel({
  label, icon, value, unit,
  history, barMin, barMax,
  thresholds = [],
  statusLevel, statusLabel, sensorId,
}) {
  const displayValue = value != null
    ? (unit === '%RH' ? value.toFixed(0) : value.toFixed(1))
    : '—'

  const barPct = value != null
    ? Math.min(100, Math.max(0, ((value - barMin) / (barMax - barMin)) * 100))
    : 0

  const lineColor = statusLevel === 'alert' ? 'var(--alert)'
                  : statusLevel === 'warn'  ? 'var(--warn)'
                  : 'var(--accent)'

  const unitSuffix = unit === '%RH' ? '%' : unit === 'cm' ? ' cm' : '°C'
  const unitShort  = unit === '%RH' ? '%' : unit === 'cm' ? ''    : '°'

  return (
    <div className={`${s.panel} ${statusLevel ? s[statusLevel] : ''}`}>
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
        <ResponsiveContainer width="100%" height={44}>
          <LineChart data={history.map((v, i) => ({ i, value: v }))}
                     margin={{ top: 4, right: 6, bottom: 4, left: 6 }}>
            <YAxis domain={[barMin, barMax]} hide />
            <Line type="monotone" dataKey="value" dot={false}
                  stroke={lineColor} strokeWidth={1.5}
                  strokeOpacity={0.7} isAnimationActive={false} />
            {thresholds.map((t, i) => (
              <ReferenceLine key={i} y={t.value}
                stroke={t.type === 'alert' ? 'var(--alert)' : 'var(--warn)'}
                strokeDasharray="3 3" strokeWidth={1} strokeOpacity={0.3} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className={s.barWrap}>
        <div className={s.barTrack}>
          <div className={s.barFill} style={{ width: `${barPct}%` }} />
          {thresholds.map((t, i) => (
            <span key={i}
              className={`${s.tick} ${t.type === 'alert' ? s.alertTick : s.warnTick}`}
              style={{ left: `${((t.value - barMin) / (barMax - barMin) * 100).toFixed(1)}%` }}
            />
          ))}
        </div>
        <div className={s.scale}>
          <span>{barMin}{unitSuffix}</span>
          {thresholds.map((t, i) => (
            <span key={i} className={t.type === 'alert' ? s.scaleAlert : s.scaleWarn}>
              {t.value}{unitShort}
            </span>
          ))}
          <span>{barMax}{unitSuffix}</span>
        </div>
      </div>

      <div className={s.footer}>
        <span className={s.statusLabel}>{statusLabel}</span>
        <span className={s.sensorId}>{sensorId}</span>
      </div>
    </div>
  )
}
