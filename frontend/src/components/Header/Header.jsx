import { motion } from 'framer-motion'
import s from './Header.module.css'

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="4"/>
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41
               M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  )
}

export default function Header({ level, armed, timestamp, dark, onToggleTheme }) {
  const lvl     = level?.toLowerCase() ?? 'initializing'
  const timeStr = timestamp ? new Date(timestamp).toLocaleTimeString() : '--:--:--'

  return (
    <header className={s.header}>
      <div className={s.brand}>
        <svg className={s.logo} viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <circle cx="12" cy="13" r="2.5"/>
          <path d="M12 10.5V9M12 15.5V17M9.5 13H8M16 13h-1.5"/>
        </svg>
        <div className={s.titleGroup}>
          <span className={s.title}>Soner Eroglu — 2166507</span>
          <span className={s.sub}>Smart Room Environment &amp; Presence Monitor</span>
        </div>
      </div>

      <div className={`${s.pill} ${s['pill_' + lvl]}`}>
        <span className={`${s.dot} ${s['dot_' + lvl]}`} />
        <span className={s.pillText}>{level ?? 'INITIALIZING'}</span>
      </div>

      <div className={s.meta}>
        <span className={`${s.armedBadge} ${armed ? s.armedOn : s.armedOff}`}>
          {armed ? 'ARMED' : 'DISARMED'}
        </span>
        <time className={s.time}>{timeStr}</time>
        <motion.button
          className={s.themeToggle}
          onClick={onToggleTheme}
          whileTap={{ scale: 0.88 }}
          aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={dark ? 'Light mode' : 'Dark mode'}
        >
          {dark ? <SunIcon /> : <MoonIcon />}
        </motion.button>
      </div>
    </header>
  )
}
