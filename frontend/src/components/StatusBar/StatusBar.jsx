import s from './StatusBar.module.css'

export default function StatusBar({ connected, timestamp }) {
  return (
    <div className={s.bar}>
      <span className={`${s.dot} ${connected ? s.ok : s.err}`}></span>
      <span className={s.text}>
        {connected ? 'Connected · live data' : 'Connection lost – retrying…'}
      </span>
      <span className={s.sep} aria-hidden />
      <span className={s.text}>Poll interval: 2 s</span>
      <span className={s.sep} aria-hidden />
      <span className={s.text}>
        {timestamp ? `Last update: ${timestamp}` : 'Awaiting data'}
      </span>
    </div>
  )
}
