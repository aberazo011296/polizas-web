import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { listarPlantillas, extraerVariables, generarCertificado } from '../services/api'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import { useToast } from '../components/ui/Toast'
import styles from './ProcesarPage.module.css'

const STEPS = ['Seleccionar', 'Extraer', 'Revisar y descargar']

const ORIGEN_LABEL = {
  extraido_ia: 'leído por IA',
  extraido_directo: 'leído del PDF',
  extraido: 'leído con OCR',
  manual: 'ingreso manual',
}

const ESTADO_LABEL = { ok: 'verificado', falta: 'falta', dudoso: 'revisar' }

// Pendientes primero para que la persona vea de inmediato qué le toca hacer
const ORDEN_ESTADO = { falta: 0, dudoso: 1, ok: 2 }

// Los campos cortos van en dos columnas; los largos ocupan el ancho completo
function esCampoLargo(valor) {
  const texto = valor || ''
  return texto.includes('\n') || texto.length > 55
}

// Altura del textarea según los saltos de línea y el texto que se
// envuelve por ancho (~90 caracteres por línea a ancho completo)
function filasPara(valor) {
  const texto = valor || ''
  const filas = texto
    .split('\n')
    .reduce((n, linea) => n + Math.max(1, Math.ceil(linea.length / 90)), 0)
  return Math.min(10, Math.max(1, filas))
}

export default function ProcesarPage() {
  const location = useLocation()
  const { show } = useToast()

  const [step, setStep] = useState(0)
  const [plantillas, setPlantillas] = useState([])
  const [plantillaId, setPlantillaId] = useState(location.state?.plantillaId || '')
  const [archivo, setArchivo] = useState(null)
  const [extrayendo, setExtrayendo] = useState(false)
  const [variables, setVariables] = useState([]) // [{nombre, valor, estado, origen}]
  const [advertencias, setAdvertencias] = useState([])
  const [generando, setGenerando] = useState(false)

  useEffect(() => {
    listarPlantillas()
      .then(setPlantillas)
      .catch(e => show(`Error: ${e.message}`, 'error'))
  }, [])

  // Si viene con plantillaId pre-seleccionado, ir al step 1
  useEffect(() => {
    if (plantillaId && step === 0) setStep(1)
  }, [plantillaId])

  async function extraer() {
    if (!archivo) { show('Selecciona un PDF', 'error'); return }
    if (!plantillaId) { show('Selecciona una plantilla', 'error'); return }
    setExtrayendo(true)
    try {
      const res = await extraerVariables(archivo, plantillaId)
      setVariables(res.variables)
      setAdvertencias(res.advertencias)
      setStep(2)
    } catch (e) {
      show(`Error extrayendo: ${e.message}`, 'error')
    } finally {
      setExtrayendo(false)
    }
  }

  async function descargar() {
    const mapa = Object.fromEntries(
      variables.map(v => [v.nombre, v.valor || ''])
    )
    setGenerando(true)
    try {
      const { blob, filename } = await generarCertificado(plantillaId, mapa)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
      show('Certificado descargado', 'success')
    } catch (e) {
      show(`Error generando: ${e.message}`, 'error')
    } finally {
      setGenerando(false)
    }
  }

  function updateVariable(nombre, valor) {
    setVariables(vs => vs.map(v =>
      v.nombre === nombre
        ? { ...v, valor, estado: valor ? 'ok' : 'falta', origen: 'manual' }
        : v
    ))
  }

  const plantillaSeleccionada = plantillas.find(p => p.id === plantillaId)

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Procesar póliza</h1>
          <p className={styles.sub}>Extrae campos y genera el certificado individual</p>
        </div>
        <StepIndicator current={step} steps={STEPS} />
      </header>

      {/* STEP 0: Seleccionar plantilla */}
      {step === 0 && (
        <div className={styles.stepCard}>
          <h2 className={styles.cardTitle}>¿Qué tipo de póliza vas a procesar?</h2>
          {plantillas.length === 0
            ? <p className={styles.empty}>No hay plantillas. <a href="/plantillas/nueva">Crea una primero.</a></p>
            : (
              <div className={styles.plantillaGrid}>
                {plantillas.map(p => (
                  <div
                    key={p.id}
                    className={`${styles.plantillaCard} ${plantillaId === p.id ? styles.selected : ''}`}
                    onClick={() => { setPlantillaId(p.id); setStep(1) }}
                  >
                    <span className={styles.pNombre}>{p.nombre}</span>
                    <span className={styles.pMeta}>{p.aseguradora} · {p.tipo_poliza} · {p.num_variables} campos</span>
                  </div>
                ))}
              </div>
            )
          }
        </div>
      )}

      {/* STEP 1: Subir PDF */}
      {step === 1 && (
        <div className={styles.stepCard}>
          {plantillaSeleccionada && (
            <div className={styles.plantillaBadge}>
              <span>Plantilla:</span>
              <strong>{plantillaSeleccionada.nombre}</strong>
              <button className={styles.cambiarBtn} onClick={() => { setStep(0); setPlantillaId('') }}>cambiar</button>
            </div>
          )}

          <h2 className={styles.cardTitle}>Sube la póliza PDF</h2>

          <div
            className={styles.dropzone}
            onDrop={e => {
              e.preventDefault()
              const f = e.dataTransfer.files[0]
              if (f?.type === 'application/pdf') setArchivo(f)
            }}
            onDragOver={e => e.preventDefault()}
          >
            {archivo
              ? <span className={styles.archivoNombre}>📄 {archivo.name}</span>
              : <>
                  <div className={styles.dropIcon}>⬆</div>
                  <span className={styles.dropText}>Arrastra el PDF aquí</span>
                  <span className={styles.dropSub}>o haz clic para seleccionar</span>
                </>
            }
            <input
              type="file"
              accept="application/pdf"
              onChange={e => { const f = e.target.files[0]; if (f) setArchivo(f) }}
              style={{
                position: 'absolute', inset: 0,
                opacity: 0, cursor: 'pointer', width: '100%', height: '100%',
              }}
            />
          </div>

          <div className={styles.stepActions}>
            <Button variant="ghost" onClick={() => setStep(0)}>‹ Atrás</Button>
            <Button loading={extrayendo} disabled={!archivo} onClick={extraer}>
              {extrayendo ? 'Leyendo la póliza…' : 'Leer póliza ›'}
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2: Revisar variables */}
      {step === 2 && (
        <div className={styles.reviewLayout}>
          <div className={styles.variablesPanel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.cardTitle}>Campos extraídos</h2>
              <div className={styles.stats}>
                <span className={styles.statOk}>{variables.filter(v => v.estado === 'ok').length} verificados</span>
                {variables.some(v => v.estado === 'dudoso') && (
                  <span className={styles.statDudoso}>{variables.filter(v => v.estado === 'dudoso').length} por revisar</span>
                )}
                <span className={styles.statFalta}>{variables.filter(v => v.estado === 'falta').length} faltantes</span>
              </div>
            </div>

            {advertencias.length > 0 && (
              <div className={styles.advertencias}>
                {advertencias.map((a, i) => <div key={i} className={styles.advertencia}>⚠ {a}</div>)}
              </div>
            )}

            <p className={styles.leyenda}>
              Revisa cada campo antes de descargar: los <strong>verificados</strong> se
              comprobaron contra el texto del PDF, los marcados <strong>revisar</strong> o{' '}
              <strong>falta</strong> necesitan tu atención.
            </p>

            <div className={styles.varList}>
              {[...variables]
                .sort((a, b) => (ORDEN_ESTADO[a.estado] ?? 3) - (ORDEN_ESTADO[b.estado] ?? 3))
                .map(v => (
                <div
                  key={v.nombre}
                  className={`${styles.varItem} ${esCampoLargo(v.valor) ? styles.varItemFull : ''}`}
                >
                  <div className={styles.varHeader}>
                    <code className={styles.varNombre}>{v.nombre}</code>
                    <div className={styles.varMeta}>
                      <Badge status={v.estado}>{ESTADO_LABEL[v.estado] || v.estado}</Badge>
                      <span className={styles.origen}>{ORIGEN_LABEL[v.origen] || v.origen}</span>
                    </div>
                  </div>
                  <textarea
                    className={`${styles.varInput} ${v.estado === 'falta' ? styles.varInputFalta : ''}`}
                    value={v.valor || ''}
                    rows={filasPara(v.valor)}
                    onChange={e => updateVariable(v.nombre, e.target.value)}
                    placeholder={v.estado === 'falta' ? 'Campo vacío — ingresa el valor' : ''}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className={styles.reviewActions}>
            <Button variant="ghost" onClick={() => setStep(1)}>‹ Volver</Button>
            <Button loading={generando} onClick={descargar} size="lg">
              ⬇ Descargar certificado .docx
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function StepIndicator({ current, steps }) {
  return (
    <div className={styles.steps}>
      {steps.map((s, i) => (
        <div key={i} className={`${styles.step} ${i === current ? styles.stepActive : ''} ${i < current ? styles.stepDone : ''}`}>
          <span className={styles.stepNum}>{i < current ? '✓' : i + 1}</span>
          <span>{s}</span>
        </div>
      ))}
    </div>
  )
}
