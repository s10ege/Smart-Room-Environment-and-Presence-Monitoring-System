import { AnimatePresence, motion } from 'framer-motion'
import s from './AlertLog.module.css'

export default function AlertLog({ level, messages }) {
  const visible = level !== 'SAFE' && messages?.length > 0
  const stamp   = new Date().toLocaleTimeString()
  const isAlert = level === 'ALERT'

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className={s.log}
          aria-live="polite"
          role="status"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
        >
          {messages.map((msg, i) => (
            <div key={i} className={`${s.row} ${isAlert ? s.alert : s.warning}`}>
              <span className={s.stamp}>{stamp}</span>
              <span className={s.levelBadge}>{level}</span>
              <span className={s.msg}>{msg}</span>
            </div>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
