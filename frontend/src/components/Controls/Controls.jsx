import { useState } from 'react'
import { motion } from 'framer-motion'
import s from './Controls.module.css'

const ACTIONS = [
  { id: 'arm',    label: 'ARM' },
  { id: 'disarm', label: 'DISARM' },
  { id: 'reset',  label: 'RESET ALARM' },
]

export default function Controls({ onControl }) {
  const [last, setLast] = useState(null)

  async function handle(action) {
    await onControl(action)
    setLast(action)
    setTimeout(() => setLast(null), 2500)
  }

  return (
    <section className={s.controls} aria-label="System controls">
      <div className={s.group}>
        {ACTIONS.map(({ id, label }) => (
          <motion.button
            key={id}
            className={`${s.btn} ${s[id]}`}
            onClick={() => handle(id)}
            whileTap={{ scale: 0.94 }}
          >
            {label}
          </motion.button>
        ))}
      </div>
      {last && (
        <span className={s.feedback} aria-live="polite">
          ↳ {last} sent
        </span>
      )}
    </section>
  )
}
