import styles from './Badge.module.css'

const VARIANTS = { ok: 'ok', falta: 'falta', dudoso: 'dudoso' }

export default function Badge({ status, children }) {
  const v = VARIANTS[status] || 'neutral'
  return <span className={`${styles.badge} ${styles[v]}`}>{children}</span>
}
