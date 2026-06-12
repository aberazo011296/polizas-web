import { NavLink } from 'react-router-dom'
import { IconHome, IconLayers, IconPlay, IconShield } from './icons'
import styles from './Layout.module.css'

const NAV = [
  { to: '/',           label: 'Inicio',          Icon: IconHome },
  { to: '/plantillas', label: 'Plantillas',      Icon: IconLayers },
  { to: '/procesar',   label: 'Procesar póliza', Icon: IconPlay },
]

export default function Layout({ children }) {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}><IconShield width={20} height={20} /></span>
          <span className={styles.logoText}>Pólizas</span>
        </div>
        <nav className={styles.nav}>
          {NAV.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.active : ''}`
              }
            >
              <span className={styles.navIcon}><Icon /></span>
              {label}
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
