import s from './StatusBar.module.css'

export default function StatusBar({ connected, timestamp }) {
  return (
    <div className={s.bar}>
      <span className={`${s.dot} ${connected ? s.ok : s.err}`} />
      <span className={s.text}>
        {connected ? 'Live · 2 s poll' : 'Reconnecting…'}
      </span>
      {timestamp && (
        <>
          <span className={s.sep} aria-hidden />
          <span className={s.text}>
            Updated {timestamp.includes('T') ? timestamp.split('T')[1] : timestamp}
          </span>
        </>
      )}
    </div>
  )
}
