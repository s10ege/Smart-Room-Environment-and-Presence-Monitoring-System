import s from './PeripheralRow.module.css'

function PeriphItem({ label, dotLevel, valueText }) {
  const dotClass = `${s.dot} ${s['dot_' + dotLevel]}`
  return (
    <div className={s.item}>
      <span className={s.label}>{label}</span>
      <span className={dotClass}></span>
      <span className={s.val}>{valueText}</span>
    </div>
  )
}

export default function PeripheralRow({ presence, led, buzzer, button }) {
  return (
    <section className={s.row} aria-label="Peripheral state">
      <PeriphItem label="PRESENCE"      dotLevel={presence ? 'alert' : 'off'} valueText={presence ? 'DETECTED'  : 'CLEAR'}    />
      <span className={s.divider} aria-hidden />
      <PeriphItem label="INDICATOR LED" dotLevel={led     ? 'warn'  : 'off'} valueText={led      ? 'ACTIVE'    : 'INACTIVE'} />
      <span className={s.divider} aria-hidden />
      <PeriphItem label="BUZZER"        dotLevel={buzzer  ? 'alert' : 'off'} valueText={buzzer   ? 'SOUNDING'  : 'SILENT'}   />
      <span className={s.divider} aria-hidden />
      <PeriphItem label="PUSH BUTTON"   dotLevel={button  ? 'warn'  : 'off'} valueText={button   ? 'PRESSED'   : 'OPEN'}     />
    </section>
  )
}
