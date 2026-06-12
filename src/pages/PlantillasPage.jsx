import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listarPlantillas, eliminarPlantilla } from '../services/api'
import Button from '../components/ui/Button'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { useToast } from '../components/ui/Toast'
import styles from './PlantillasPage.module.css'

export default function PlantillasPage() {
  const [plantillas, setPlantillas] = useState([])
  const [loading, setLoading] = useState(true)
  const { show } = useToast()
  const navigate = useNavigate()

  async function cargar() {
    try {
      setPlantillas(await listarPlantillas())
    } catch (e) {
      show(`Error cargando plantillas: ${e.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [])

  const [porEliminar, setPorEliminar] = useState(null)
  const [eliminando, setEliminando] = useState(false)

  async function confirmarEliminar() {
    setEliminando(true)
    try {
      await eliminarPlantilla(porEliminar.id)
      show('Plantilla eliminada', 'success')
      setPorEliminar(null)
      cargar()
    } catch (e) {
      show(`Error: ${e.message}`, 'error')
    } finally {
      setEliminando(false)
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Plantillas</h1>
          <p className={styles.sub}>Configuraciones de extracción guardadas</p>
        </div>
        <Button onClick={() => navigate('/plantillas/nueva')}>+ Nueva plantilla</Button>
      </header>

      {loading && <p className={styles.empty}>Cargando…</p>}

      {!loading && plantillas.length === 0 && (
        <div className={styles.emptyState}>
          <p>No hay plantillas todavía.</p>
          <Button onClick={() => navigate('/plantillas/nueva')}>Crear la primera</Button>
        </div>
      )}

      {!loading && plantillas.length > 0 && (
        <div className={styles.list}>
          {plantillas.map(p => (
            <div key={p.id} className={styles.item}>
              <div className={styles.itemMain}>
                <span className={styles.nombre}>{p.nombre}</span>
                <span className={styles.meta}>
                  {p.aseguradora} · {p.tipo_poliza} · {p.num_variables} campos
                </span>
              </div>
              <div className={styles.itemActions}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate('/procesar', { state: { plantillaId: p.id } })}
                >
                  Usar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/plantillas/template', { state: { plantillaId: p.id } })}
                >
                  Template
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/plantillas/editar', { state: { plantillaId: p.id } })}
                >
                  Editar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPorEliminar(p)}
                >
                  Eliminar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!porEliminar}
        title="Eliminar plantilla"
        message={porEliminar ? `Se eliminará la plantilla "${porEliminar.nombre}" con sus ${porEliminar.num_variables} campos. Esta acción no se puede deshacer.` : ''}
        confirmLabel="Eliminar"
        loading={eliminando}
        onConfirm={confirmarEliminar}
        onCancel={() => setPorEliminar(null)}
      />
    </div>
  )
}
