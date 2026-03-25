import { motion } from 'framer-motion'
import s from './PeripheralRow.module.css'

const ITEMS = [
  { key: 'presence', label: 'PRESENCE',      level: 'alert', on: 'DETECTED', off: 'CLEAR'    },
  { key: 'led',      label: 'INDICATOR LED', level: 'warn',  on: 'ACTIVE',   off: 'INACTIVE' },
  { key: 'buzzer',   label: 'BUZZER',        level: 'alert', on: 'SOUNDING', off: 'SILENT'   },
  { key: 'button',   label: 'PUSH BUTTON',   level: 'warn',  on: 'PRESSED',  off: 'OPEN'     },
]

export default function PeripheralRow({ presence, led, buzzer, button }) {
  const vals = { presence, led, buzzer, button }

  return (
    <section className={s.row} aria-label="Peripheral state">
      {ITEMS.map((item) => {
        const active = !!vals[item.key]
        return (
          <div key={item.key} className={s.item}>
            <span className={s.label}>{item.label}</span>
            <div className={s.dotWrap}>
              <span className={`${s.dot} ${active ? s['dot_' + item.level] : s.dot_off}`} />
              {active && (
                <motion.span
                  className={`${s.ring} ${s['ring_' + item.level]}`}
                  initial={{ scale: 1, opacity: 0.55 }}
                  animate={{ scale: 2.8, opacity: 0 }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
                />
              )}
            </div>
            <span className={`${s.val} ${active ? s['val_' + item.level] : ''}`}>
              {active ? item.on : item.off}
            </span>
          </div>
        )
      })}
    </section>
  )
}
