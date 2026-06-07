import { NavLink } from 'react-router-dom'
import styles from './Layout.module.css'

const NAV = [
  { to: '/',           label: 'Inicio',      icon: '⌂' },
  { to: '/plantillas', label: 'Plantillas',  icon: '◫' },
  { to: '/procesar',   label: 'Procesar',    icon: '▶' },
]

export default function Layout({ children }) {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>⬡</span>
          <span className={styles.logoText}>Pólizas</span>
        </div>
        <nav className={styles.nav}>
          {NAV.map(n => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.active : ''}`
              }
            >
              <span className={styles.navIcon}>{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className={styles.sidebarFooter}>
          <span className={styles.version}>POC v0.1</span>
        </div>
      </aside>
      <main className={styles.main}>
        {children}
      </main>
    </div>
  )
}
