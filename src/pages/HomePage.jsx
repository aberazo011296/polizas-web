import { useNavigate } from 'react-router-dom'
import Button from '../components/ui/Button'
import styles from './HomePage.module.css'

export default function HomePage() {
  const navigate = useNavigate()
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <h1 className={styles.title}>Certificados de<br />Seguros</h1>
        <p className={styles.sub}>
          Convierte pólizas PDF en certificados individuales.<br />
          Define una vez, procesa todas.
        </p>
      </header>

      <div className={styles.cards}>
        <div className={styles.card} onClick={() => navigate('/plantillas/nueva')}>
          <div className={styles.cardIcon}>◫</div>
          <div>
            <h3>Nueva plantilla</h3>
            <p>Sube un PDF modelo y dibuja los campos a extraer</p>
          </div>
        </div>
        <div className={styles.card} onClick={() => navigate('/procesar')}>
          <div className={styles.cardIcon}>▶</div>
          <div>
            <h3>Procesar póliza</h3>
            <p>Sube una póliza y genera el certificado en segundos</p>
          </div>
        </div>
        <div className={styles.card} onClick={() => navigate('/plantillas')}>
          <div className={styles.cardIcon}>≡</div>
          <div>
            <h3>Ver plantillas</h3>
            <p>Gestiona las plantillas de extracción guardadas</p>
          </div>
        </div>
      </div>

      <div className={styles.note}>
        <span className={styles.noteTag}>POC</span>
        Aseguradora: <strong>Generali Ecuador</strong> · Ramo: <strong>Desgravamen</strong>
      </div>
    </div>
  )
}
