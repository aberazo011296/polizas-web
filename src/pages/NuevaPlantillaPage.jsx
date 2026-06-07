import { useState, useCallback, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { inspeccionarPDF, crearPlantilla, actualizarPlantilla, obtenerPlantilla, subirTemplatePlantilla } from '../services/api'
import PdfViewer from '../components/editor/PdfViewer'
import CajaEditor from '../components/editor/CajaEditor'
import Button from '../components/ui/Button'
import { useToast } from '../components/ui/Toast'
import styles from './NuevaPlantillaPage.module.css'

const STEPS = ['Subir PDF', 'Dibujar campos', 'Datos', 'Template .docx']

export default function NuevaPlantillaPage() {
  const [step, setStep] = useState(0)
  const navigate = useNavigate()
  const location = useLocation()
  const { show } = useToast()

  // Modo edición: viene con plantillaId en el state del router
  const plantillaId = location.state?.plantillaId || null
  const modoEdicion = !!plantillaId

  // Step 0
  const [archivo, setArchivo] = useState(null)
  const [numPaginas, setNumPaginas] = useState(0)

  // Step 1
  const [paginaActual, setPaginaActual] = useState(0)
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 })
  const [cajasPorPagina, setCajasPorPagina] = useState({})

  const handlePageSize = useCallback((size) => {
    if (size.width > 0 && size.height > 0) setPageSize(size)
  }, [])

  // Step 2
  const [nombre, setNombre] = useState('')
  const [aseguradora, setAseguradora] = useState('generali')
  const [tipoPoliza, setTipoPoliza] = useState('desgravamen')
  const [guardando, setGuardando] = useState(false)

  // Step 3
  const [templateDocx, setTemplateDocx] = useState(null)

  // Cargar datos existentes en modo edición
  useEffect(() => {
    if (!plantillaId) return
    obtenerPlantilla(plantillaId)
      .then(p => {
        setNombre(p.nombre)
        setAseguradora(p.aseguradora)
        setTipoPoliza(p.tipo_poliza)
        // Agrupar cajas por página y asignarles id temporal
        const porPagina = {}
        p.cajas.forEach((c, i) => {
          const pagina = c.pagina ?? 0
          if (!porPagina[pagina]) porPagina[pagina] = []
          porPagina[pagina].push({ ...c, id: Date.now() + i })
        })
        setCajasPorPagina(porPagina)
      })
      .catch(e => show(`Error cargando plantilla: ${e.message}`, 'error'))
  }, [plantillaId])

  // ── Step 0: drop / select PDF ──────────────────────────────────────────
  function onDrop(e) {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f?.type === 'application/pdf') handleArchivo(f)
  }

  async function handleArchivo(f) {
    setArchivo(f)
    try {
      const info = await inspeccionarPDF(f)
      setNumPaginas(info.num_paginas)
      setStep(1)
    } catch (e) {
      show(`Error inspeccionando PDF: ${e.message}`, 'error')
    }
  }

  // ── Step 1: editor de cajas ────────────────────────────────────────────
  function getCajasActuales() {
    return cajasPorPagina[paginaActual] || []
  }

  function setCajasActuales(cajas) {
    // Marcar la página en cada caja
    const cajasConPagina = cajas.map(c => ({ ...c, pagina: paginaActual }))
    setCajasPorPagina(prev => ({ ...prev, [paginaActual]: cajasConPagina }))
  }

  function todasLasCajas() {
    return Object.values(cajasPorPagina).flat()
  }

  function eliminarCajaPorId(id, pagina) {
    setCajasPorPagina(prev => ({
      ...prev,
      [pagina]: (prev[pagina] || []).filter(c => c.id !== id)
    }))
  }

  function validarCajas() {
    const cajas = todasLasCajas()
    if (cajas.length === 0) return 'Dibuja al menos un campo'
    const sinNombre = cajas.filter(c => !c.nombre)
    if (sinNombre.length > 0) return 'Todos los campos deben tener nombre'
    const nombres = cajas.map(c => c.nombre)
    if (new Set(nombres).size !== nombres.length) return 'Los nombres de campo deben ser únicos'
    return null
  }

  function siguientePaso() {
    const err = validarCajas()
    if (err) { show(err, 'error'); return }
    setStep(2)
  }

  // ── Step 2: validar datos y continuar ─────────────────────────────────
  function continuarATemplate() {
    if (!nombre.trim()) { show('Ingresa un nombre para la plantilla', 'error'); return }
    if (!aseguradora.trim()) { show('Ingresa el nombre de la aseguradora', 'error'); return }
    if (!tipoPoliza.trim()) { show('Ingresa el tipo de póliza', 'error'); return }
    setStep(3)
  }

  // ── Step 3: guardar plantilla + subir template ─────────────────────────
  async function guardar() {
    if (!modoEdicion && !templateDocx) {
      show('Selecciona el archivo .docx del template', 'error'); return
    }

    const cajas = todasLasCajas().map(({ id, ...c }) => ({
      nombre: c.nombre,
      pagina: c.pagina,
      x: Math.round(c.x),
      y: Math.round(c.y),
      ancho: Math.round(c.ancho),
      alto: Math.round(c.alto),
    }))

    setGuardando(true)
    try {
      const body = { nombre: nombre.trim(), aseguradora, tipo_poliza: tipoPoliza, cajas }
      const plantilla = modoEdicion
        ? await actualizarPlantilla(plantillaId, body)
        : await crearPlantilla(body)

      if (templateDocx) {
        await subirTemplatePlantilla(plantilla.id, templateDocx)
      }

      show(modoEdicion ? 'Plantilla actualizada correctamente' : 'Plantilla guardada correctamente', 'success')
      navigate('/plantillas')
    } catch (e) {
      show(`Error guardando: ${e.message}`, 'error')
    } finally {
      setGuardando(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{modoEdicion ? 'Editar plantilla' : 'Nueva plantilla'}</h1>
          <p className={styles.sub}>
            {step === 0 && (modoEdicion ? 'Sube el PDF para ver y ajustar los campos' : 'Sube el PDF modelo de la póliza')}
            {step === 1 && 'Dibuja o ajusta los campos a extraer'}
            {step === 2 && 'Confirma los datos de la plantilla'}
            {step === 3 && (modoEdicion ? 'Sube un nuevo template .docx o deja en blanco para mantener el actual' : 'Sube el documento Word que se usará para generar certificados')}
          </p>
        </div>
        <StepIndicator current={step} steps={STEPS} />
      </header>

      {/* STEP 0 */}
      {step === 0 && (
        <DropZone onDrop={onDrop} onChange={e => handleArchivo(e.target.files[0])} />
      )}

      {/* STEP 1 */}
      {step === 1 && archivo && (
        <div className={styles.editorLayout}>
          {/* Controles izquierda */}
          <aside className={styles.editorSide}>
            <div className={styles.sideSection}>
              <span className={styles.sideLabel}>Página</span>
              <div className={styles.paginator}>
                <button
                  className={styles.pageBtn}
                  disabled={paginaActual === 0}
                  onClick={() => setPaginaActual(p => p - 1)}
                >‹</button>
                <span>{paginaActual + 1} / {numPaginas}</span>
                <button
                  className={styles.pageBtn}
                  disabled={paginaActual === numPaginas - 1}
                  onClick={() => setPaginaActual(p => p + 1)}
                >›</button>
              </div>
            </div>

            <div className={styles.sideSection}>
              <span className={styles.sideLabel}>Campos definidos</span>
              <div className={styles.cajaList}>
                {todasLasCajas().length === 0
                  ? <span className={styles.cajaEmpty}>Ninguno aún</span>
                  : todasLasCajas().map((c, i) => (
                    <div key={c.id} className={styles.cajaItem}>
                      <span className={styles.cajaNum}>{i + 1}</span>
                      <span className={styles.cajaNombre}>{c.nombre || '—'}</span>
                      <span className={styles.cajaPag}>p.{c.pagina + 1}</span>
                      <button
                        className={styles.cajaDeleteBtn}
                        title="Eliminar campo"
                        onClick={() => eliminarCajaPorId(c.id, c.pagina)}
                      >✕</button>
                    </div>
                  ))
                }
              </div>
            </div>

            <div className={styles.sideActions}>
              <Button variant="ghost" size="sm" onClick={() => setStep(0)}>‹ Atrás</Button>
              <Button size="sm" onClick={siguientePaso}>Continuar ›</Button>
            </div>
          </aside>

          {/* Canvas */}
          <div className={styles.canvasArea}>
            <div className={styles.pdfStack}>
              {/* PDF renderizado debajo */}
              <PdfViewer
                file={archivo}
                pageIndex={paginaActual}
                onPageCount={setNumPaginas}
                onPageSize={handlePageSize}
              />
              {/* Canvas de cajas encima, posición absoluta */}
              {pageSize.width > 0 && (
                <div className={styles.konvaOverlay}>
                  <CajaEditor
                    width={pageSize.width}
                    height={pageSize.height}
                    cajas={getCajasActuales()}
                    onChange={setCajasActuales}
                  />
                </div>
              )}
            </div>
            <p className={styles.hint}>
              Haz clic y arrastra para marcar un campo. Haz clic en una caja para nombrarla.
            </p>
          </div>
        </div>
      )}

      {/* STEP 2 */}
      {step === 2 && (
        <div className={styles.formStep}>
          <div className={styles.formCard}>
            <h2 className={styles.formTitle}>Datos de la plantilla</h2>

            <label className={styles.formLabel}>
              Nombre <span className={styles.required}>*</span>
              <input
                className={`${styles.formInput} ${!nombre.trim() ? styles.inputError : ''}`}
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="ej: Generali Desgravamen 2026"
                autoFocus
              />
              {!nombre.trim() && <span className={styles.fieldError}>Campo requerido</span>}
            </label>

            <label className={styles.formLabel}>
              Aseguradora <span className={styles.required}>*</span>
              <input
                className={`${styles.formInput} ${!aseguradora.trim() ? styles.inputError : ''}`}
                value={aseguradora}
                onChange={e => setAseguradora(e.target.value.toLowerCase())}
                placeholder="ej: generali"
              />
              {!aseguradora.trim() && <span className={styles.fieldError}>Campo requerido</span>}
            </label>

            <label className={styles.formLabel}>
              Tipo de póliza <span className={styles.required}>*</span>
              <input
                className={`${styles.formInput} ${!tipoPoliza.trim() ? styles.inputError : ''}`}
                value={tipoPoliza}
                onChange={e => setTipoPoliza(e.target.value.toLowerCase())}
                placeholder="ej: desgravamen"
              />
              {!tipoPoliza.trim() && <span className={styles.fieldError}>Campo requerido</span>}
            </label>

            <div className={styles.formSummary}>
              <span className={styles.summaryLabel}>Campos definidos</span>
              <span className={styles.summaryValue}>{todasLasCajas().length}</span>
              <div className={styles.cajaListSmall}>
                {todasLasCajas().map((c, i) => (
                  <div key={c.id} className={styles.cajaChip}>
                    <code>{c.nombre}</code>
                    <span>p.{c.pagina + 1}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.formActions}>
            <Button variant="ghost" onClick={() => setStep(1)}>‹ Atrás</Button>
            <Button onClick={continuarATemplate}>Continuar ›</Button>
          </div>
        </div>
      )}

      {/* STEP 3 */}
      {step === 3 && (
        <div className={styles.formStep}>
          <div className={styles.formCard}>
            <h2 className={styles.formTitle}>Template de certificado</h2>
            <p className={styles.templateHint}>
              Sube el archivo <strong>.docx</strong> con los marcadores{' '}
              <code className={styles.code}>{'{{nombre_variable}}'}</code> donde deben aparecer
              los datos extraídos. Se guardará como{' '}
              <code className={styles.code}>{aseguradora.trim()}_{tipoPoliza.trim()}.docx</code>.
            </p>

            <div
              className={`${styles.templateDropzone} ${templateDocx ? styles.templateDropzoneOk : ''}`}
              onDrop={e => {
                e.preventDefault()
                const f = e.dataTransfer.files[0]
                if (f?.name.endsWith('.docx')) setTemplateDocx(f)
                else show('El archivo debe ser un .docx', 'error')
              }}
              onDragOver={e => e.preventDefault()}
            >
              {templateDocx
                ? <><span className={styles.templateIcon}>✓</span><span className={styles.templateNombre}>{templateDocx.name}</span></>
                : <><span className={styles.templateIcon}>📄</span><span className={styles.templateTexto}>Arrastra el .docx aquí o haz clic para seleccionar</span></>
              }
              <input
                type="file"
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={e => { const f = e.target.files[0]; if (f) setTemplateDocx(f) }}
                style={{
                  position: 'absolute', inset: 0,
                  opacity: 0, cursor: 'pointer', width: '100%', height: '100%',
                }}
              />
            </div>
          </div>

          <div className={styles.formActions}>
            <Button variant="ghost" onClick={() => setStep(2)}>‹ Atrás</Button>
            <Button loading={guardando} disabled={!modoEdicion && !templateDocx} onClick={guardar}>
              {modoEdicion ? 'Guardar cambios' : 'Guardar plantilla'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-componentes ────────────────────────────────────────────────────────

function DropZone({ onDrop, onChange }) {
  const [over, setOver] = useState(false)
  return (
    <div
      className={`${styles.dropzone} ${over ? styles.dropzoneOver : ''}`}
      onDrop={onDrop}
      onDragOver={e => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
    >
      <div className={styles.dropIcon}>⬆</div>
      <span className={styles.dropText}>Arrastra el PDF aquí</span>
      <span className={styles.dropSub}>o haz clic para seleccionar</span>
      <input
        type="file"
        accept="application/pdf"
        onChange={onChange}
        style={{
          position: 'absolute', inset: 0,
          opacity: 0, cursor: 'pointer', width: '100%', height: '100%',
        }}
      />
    </div>
  )
}

function StepIndicator({ current, steps }) {
  return (
    <div className={styles.steps}>
      {steps.map((s, i) => (
        <div key={i} className={`${styles.step} ${i === current ? styles.stepActive : ''} ${i < current ? styles.stepDone : ''}`}>
          <span className={styles.stepNum}>{i < current ? '✓' : i + 1}</span>
          <span className={styles.stepLabel}>{s}</span>
        </div>
      ))}
    </div>
  )
}
