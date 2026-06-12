import { useNavigate } from 'react-router-dom'
import { IconPlay, IconLayers, IconPlus } from '../components/ui/icons'
import styles from './HomePage.module.css'

export default function HomePage() {
  const navigate = useNavigate()
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <h1 className={styles.title}>Certificados de seguros</h1>
        <p className={styles.sub}>
          Convierte pólizas PDF en certificados individuales. Define una vez, procesa todas.
        </p>
      </header>

      <div className={styles.cards}>
        <div className={`${styles.card} ${styles.cardPrimary}`} onClick={() => navigate('/procesar')}>
          <div className={styles.cardIcon}><IconPlay width={22} height={22} /></div>
          <h3>Procesar póliza</h3>
          <p>Sube la póliza PDF, revisa los datos extraídos y descarga el certificado.</p>
        </div>
        <div className={styles.card} onClick={() => navigate('/plantillas')}>
          <div className={styles.cardIcon}><IconLayers width={22} height={22} /></div>
          <h3>Plantillas</h3>
          <p>Configura qué datos se extraen y cómo se arma el certificado.</p>
        </div>
        <div className={styles.card} onClick={() => navigate('/plantillas/nueva')}>
          <div className={styles.cardIcon}><IconPlus width={22} height={22} /></div>
          <h3>Nueva plantilla</h3>
          <p>Para un nuevo tipo de póliza o de certificado.</p>
        </div>
      </div>

      <div className={styles.note}>
        <span className={styles.noteTag}>POC</span>
        Aseguradora: <strong>Generali Ecuador</strong> · Ramo: <strong>Desgravamen</strong>
      </div>
    </div>
  )
}
