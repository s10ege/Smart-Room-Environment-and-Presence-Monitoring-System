import s from './Header.module.css'

export default function Header({ level, armed, timestamp }) {
  const pillClass = level ? `${s.pill} ${s['pill_' + level.toLowerCase()]}` : s.pill
  const dotClass  = level ? `${s.dot} ${s['dot_' + level.toLowerCase()]}` : s.dot
  const armedClass = armed ? `${s.armedBadge} ${s.armedOn}` : `${s.armedBadge} ${s.armedOff}`

  const timeStr = timestamp
    ? new Date(timestamp).toLocaleTimeString()
    : '--:--:--'

  return (
    <header className={s.header}>
      <div className={s.brand}>
        <svg className={s.logo} viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="2" y="3" width="20" height="14" rx="2"/>
          <path d="M8 21h8M12 17v4"/>
          <circle cx="12" cy="10" r="3"/>
          <path d="M12 7V5M12 15v-2M15 10h2M7 10H5"/>
        </svg>
        <div className={s.titleGroup}>
          <span className={s.title}>SMART ROOM MONITOR</span>
          <span className={s.sub}>Raspberry Pi · GPIO Sensor Array · v1.0</span>
        </div>
      </div>

      <div className={pillClass}>
        <span className={dotClass}></span>
        <span className={s.pillText}>{level || 'INITIALIZING'}</span>
      </div>

      <div className={s.meta}>
        <span className={armedClass}>{armed ? 'ARMED' : 'DISARMED'}</span>
        <time className={s.time}>{timeStr}</time>
      </div>
    </header>
  )
}
