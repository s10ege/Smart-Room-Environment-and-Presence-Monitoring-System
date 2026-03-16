import s from './AlertLog.module.css'

export default function AlertLog({ level, messages }) {
  if (level === 'SAFE' || !messages?.length) return null

  const stamp     = new Date().toLocaleTimeString()
  const rowClass  = level === 'ALERT' ? `${s.row} ${s.alert}` : `${s.row} ${s.warning}`

  return (
    <div className={s.log} aria-live="polite" role="status">
      {messages.map((msg, i) => (
        <div key={i} className={rowClass}>
          <span className={s.stamp}>{stamp}</span>
          <span className={s.levelBadge}>{level}</span>
          <span className={s.msg}>{msg}</span>
        </div>
      ))}
    </div>
  )
}
