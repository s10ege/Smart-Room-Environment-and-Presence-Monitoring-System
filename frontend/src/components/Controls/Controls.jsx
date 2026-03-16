import { useState } from 'react'
import s from './Controls.module.css'

export default function Controls({ onControl }) {
  const [feedback, setFeedback] = useState({ text: '', ok: true })

  async function handleClick(action) {
    try {
      const res  = await fetch('/api/control', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action }),
      })
      const data = await res.json()
      setFeedback({ text: data.ok ? `Command accepted: ${action}` : `Error: ${data.error}`, ok: data.ok })
      setTimeout(() => setFeedback({ text: '', ok: true }), 3000)
      onControl?.()
    } catch (e) {
      setFeedback({ text: 'Request failed', ok: false })
      setTimeout(() => setFeedback({ text: '', ok: true }), 3000)
    }
  }

  return (
    <section className={s.controls} aria-label="System controls">
      <div className={s.group}>
        <button className={`${s.btn} ${s.arm}`}    onClick={() => handleClick('arm')}>ARM MONITORING</button>
        <button className={`${s.btn} ${s.disarm}`} onClick={() => handleClick('disarm')}>DISARM</button>
        <button className={`${s.btn} ${s.reset}`}  onClick={() => handleClick('reset')}>RESET ALARM</button>
      </div>
      {feedback.text && (
        <span className={`${s.feedback} ${feedback.ok ? s.ok : s.err}`} aria-live="polite">
          {feedback.text}
        </span>
      )}
    </section>
  )
}
