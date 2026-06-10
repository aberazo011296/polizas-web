import { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import mammoth from 'mammoth'
import { inspeccionarPDF, crearPlantilla, actualizarPlantilla, obtenerPlantilla } from '../services/api'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
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
  const [templateArchivo, setTemplateArchivo] = useState(null)
  const [templatePreview, setTemplatePreview] = useState('')
  const [reemplazos, setReemplazos] = useState({})
  const [camposManuales, setCamposManuales] = useState([]) // [{nombre, valor_por_defecto}]
  const templateInputRef = useRef(null)

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
        const r = {}
        p.cajas.forEach(c => { r[c.nombre] = '' })
        setReemplazos(r)
        setCamposManuales(p.campos_manuales || [])
        // En modo edición saltar directo a Datos (step 2)
        setStep(2)
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
    // Inicializar reemplazos con las cajas definidas
    const r = {}
    todasLasCajas().forEach(c => { r[c.nombre] = reemplazos[c.nombre] || '' })
    setReemplazos(r)
    setStep(3)
  }

  async function handleTemplateArchivo(f) {
    if (!f) return
    setTemplateArchivo(f)
    const buf = await f.arrayBuffer()
    const result = await mammoth.convertToHtml({ arrayBuffer: buf })
    setTemplatePreview(result.value)
  }

  function previewConResaltado() {
    let html = templatePreview
    // Resaltar extraídas
    Object.entries(reemplazos).forEach(([variable, texto]) => {
      if (!texto.trim()) return
      const escaped = texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      html = html.replace(new RegExp(escaped, 'g'),
        `<mark style="background:rgba(255,200,0,.45);border-radius:2px;padding:0 2px;" title="→ {{${variable}}}">${texto}</mark>`)
    })
    // Resaltar posición de campos manuales (texto_reemplazar)
    camposManuales.forEach(({ nombre, texto_reemplazar }) => {
      if (!texto_reemplazar?.trim() || !nombre.trim()) return
      const escaped = texto_reemplazar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      html = html.replace(new RegExp(escaped, 'g'),
        `<mark style="background:rgba(79,124,255,.25);border-radius:2px;padding:0 2px;" title="→ {{${nombre}}}">${texto_reemplazar}</mark>`)
    })
    return html
  }

  // ── Step 3: guardar plantilla + construir template ─────────────────────
  async function guardar() {
    if (!modoEdicion && !templateArchivo) {
      show('Sube el documento Word original', 'error'); return
    }

    const cajas = todasLasCajas().map(({ id, ...c }) => ({
      nombre: c.nombre, pagina: c.pagina,
      x: Math.round(c.x), y: Math.round(c.y),
      ancho: Math.round(c.ancho), alto: Math.round(c.alto),
    }))

    setGuardando(true)
    try {
      const body = { nombre: nombre.trim(), aseguradora, tipo_poliza: tipoPoliza, cajas, campos_manuales: camposManuales }
      const plantilla = modoEdicion
        ? await actualizarPlantilla(plantillaId, body)
        : await crearPlantilla(body)

      if (templateArchivo) {
        const mapaReemplazos = { ...Object.fromEntries(Object.entries(reemplazos).filter(([, v]) => v.trim())) }
        // Incluir posiciones de campos manuales
        camposManuales.forEach(({ nombre, texto_reemplazar }) => {
          if (nombre.trim() && texto_reemplazar?.trim()) mapaReemplazos[nombre] = texto_reemplazar
        })
        const form = new FormData()
        form.append('archivo', templateArchivo)
        form.append('reemplazos', JSON.stringify(mapaReemplazos))
        const res = await fetch(`${BASE_URL}/plantillas/${plantilla.id}/template/build`, {
          method: 'POST', body: form,
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: res.statusText }))
          throw new Error(Array.isArray(err.detail) ? err.detail.map(e => e.msg).join('; ') : err.detail)
        }
      }

      show(modoEdicion ? 'Plantilla actualizada' : 'Plantilla guardada correctamente', 'success')
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
            {step === 3 && 'Sube el Word original y mapea cada variable al texto que debe reemplazar'}
          </p>
        </div>
        <StepIndicator current={step} steps={STEPS} />
      </header>

      {/* STEP 0 */}
      {step === 0 && (
        <>
          {modoEdicion && (
            <div className={styles.editNotice}>
              ℹ️ Para redibujar los campos necesitas subir el PDF original de nuevo. Si solo quieres editar los datos o el template, puedes continuar sin PDF.
              <Button variant="ghost" size="sm" onClick={() => setStep(2)} style={{ marginLeft: 12 }}>
                Ir a Datos →
              </Button>
            </div>
          )}
          <DropZone onDrop={onDrop} onChange={e => handleArchivo(e.target.files[0])} />
        </>
      )}

      {/* STEP 1 */}
      {step === 1 && (
        <div className={styles.editorLayout}>
          {/* Controles izquierda */}
          <aside className={styles.editorSide}>
            <div className={styles.sideSection}>
              {archivo && (
                <>
                  <span className={styles.sideLabel}>Página</span>
                  <div className={styles.paginator}>
                    <button className={styles.pageBtn} disabled={paginaActual === 0} onClick={() => setPaginaActual(p => p - 1)}>‹</button>
                    <span>{paginaActual + 1} / {numPaginas}</span>
                    <button className={styles.pageBtn} disabled={paginaActual === numPaginas - 1} onClick={() => setPaginaActual(p => p + 1)}>›</button>
                  </div>
                </>
              )}
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
                      <button className={styles.cajaDeleteBtn} title="Eliminar campo" onClick={() => eliminarCajaPorId(c.id, c.pagina)}>✕</button>
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

          {/* Canvas o zona de carga */}
          <div className={styles.canvasArea}>
            {!archivo ? (
              <div className={styles.uploadPdfZone}>
                <span className={styles.uploadPdfIcon}>🗺</span>
                <span className={styles.uploadPdfText}>Sube el PDF para dibujar o agregar campos</span>
                <span className={styles.uploadPdfSub}>Los campos existentes se mostrarán sobre el PDF</span>
                <label className={styles.uploadPdfBtn}>
                  Seleccionar PDF
                  <input
                    type="file" accept="application/pdf" style={{ display: 'none' }}
                    onChange={e => handleArchivo(e.target.files[0])}
                  />
                </label>
              </div>
            ) : (
              <>
                <div className={styles.pdfStack}>
                  <PdfViewer file={archivo} pageIndex={paginaActual} onPageCount={setNumPaginas} onPageSize={handlePageSize} />
                  {pageSize.width > 0 && (
                    <div className={styles.konvaOverlay}>
                      <CajaEditor width={pageSize.width} height={pageSize.height} cajas={getCajasActuales()} onChange={setCajasActuales} />
                    </div>
                  )}
                </div>
                <p className={styles.hint}>Haz clic y arrastra para marcar un campo. Haz clic en una caja para nombrarla.</p>
              </>
            )}
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
        <div className={styles.templateLayout}>
          {/* Columna izquierda: upload + preview */}
          <div className={styles.templateLeft}>
            {!templateArchivo ? (
              <div
                className={styles.templateDropzone}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.name.endsWith('.docx')) handleTemplateArchivo(f) }}
                onDragOver={e => e.preventDefault()}
              >
                <span className={styles.templateIcon}>📄</span>
                <span className={styles.templateTexto}>Sube el Word original con los datos reales</span>
                <span className={styles.templateSub}>Ej: el documento con "990664", "FONDO DE JUBILACION...", etc.</span>
                <input
                  type="file"
                  accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={e => { const f = e.target.files[0]; if (f) handleTemplateArchivo(f) }}
                  style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
                />
              </div>
            ) : (
              <>
                <div className={styles.previewHeader}>
                  <span className={styles.previewTitle}>📄 {templateArchivo.name}</span>
                  <button className={styles.cambiarBtn} onClick={() => { setTemplateArchivo(null); setTemplatePreview('') }}>
                    Cambiar archivo
                  </button>
                </div>
                <div
                  className={styles.previewContent}
                  dangerouslySetInnerHTML={{ __html: previewConResaltado() }}
                />
              </>
            )}
          </div>

          {/* Columna derecha: variables */}
          <aside className={styles.templatePanel}>
            <div className={styles.templatePanelTop}>
              <span className={styles.panelTitle}>Variables a reemplazar</span>
              <p className={styles.panelHint}>
                Escribe el texto exacto del documento que debe convertirse en cada variable.
                Se resaltará en amarillo en el preview.
              </p>
            </div>

            {/* Variables de extracción */}
            <span className={styles.varSectionLabel}>Extraídas del PDF</span>
            <div className={styles.varList}>
              {todasLasCajas().map(c => {
                const valor = reemplazos[c.nombre] || ''
                const ok = valor.trim() !== ''
                return (
                  <div key={c.nombre} className={`${styles.varItem} ${ok ? styles.varItemOk : ''}`}>
                    <div className={styles.varLabel}>
                      <span className={styles.varIndicator}>{ok ? '✓' : '○'}</span>
                      <code className={styles.varNombre}>{`{{${c.nombre}}}`}</code>
                    </div>
                    <input
                      className={styles.varInput}
                      placeholder="Texto en el documento..."
                      value={valor}
                      onChange={e => setReemplazos(prev => ({ ...prev, [c.nombre]: e.target.value }))}
                    />
                  </div>
                )
              })}
            </div>

            {/* Campos manuales */}
            <div className={styles.varSectionHeader}>
              <span className={styles.varSectionLabel}>Ingreso manual</span>
              <button
                className={styles.addManualBtn}
                onClick={() => setCamposManuales(prev => [...prev, { nombre: '', valor_por_defecto: '' }])}
              >+ Agregar</button>
            </div>
            <div className={styles.varList}>
              {camposManuales.length === 0 && (
                <p className={styles.varEmptyHint}>Campos que el usuario completa al procesar cada póliza (ej: nombre_asegurado)</p>
              )}
              {camposManuales.map((campo, i) => (
                <div key={i} className={`${styles.varItem} ${campo.nombre.trim() ? styles.varItemManual : ''}`}>
                  <div className={styles.varLabel}>
                    <span className={styles.varIndicatorManual}>M</span>
                    <input
                      className={styles.varNombreInput}
                      placeholder="nombre_variable"
                      value={campo.nombre}
                      onChange={e => {
                        const val = e.target.value.replace(/\s+/g, '_')
                        setCamposManuales(prev => prev.map((c, j) => j === i ? { ...c, nombre: val } : c))
                      }}
                    />
                    <button
                      className={styles.varDeleteBtn}
                      onClick={() => setCamposManuales(prev => prev.filter((_, j) => j !== i))}
                    >✕</button>
                  </div>
                  <input
                    className={styles.varInput}
                    placeholder="Valor por defecto (opcional)"
                    value={campo.valor_por_defecto}
                    onChange={e => setCamposManuales(prev => prev.map((c, j) => j === i ? { ...c, valor_por_defecto: e.target.value } : c))}
                  />
                  <input
                    className={`${styles.varInput} ${styles.varInputPos}`}
                    placeholder="Texto en el doc a reemplazar (ej: CEDULA_AQUI)"
                    value={campo.texto_reemplazar || ''}
                    onChange={e => setCamposManuales(prev => prev.map((c, j) => j === i ? { ...c, texto_reemplazar: e.target.value } : c))}
                  />
                  {!campo.texto_reemplazar?.trim() && campo.nombre.trim() && (
                    <p className={styles.varPosHint}>
                      ✏️ En el Word escribe un placeholder donde quieres que aparezca (ej: <code>CEDULA_AQUI</code>) y ponlo aquí
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className={styles.templateActions}>
              <Button variant="ghost" size="sm" onClick={() => setStep(2)}>‹ Atrás</Button>
              <Button loading={guardando} disabled={!modoEdicion && !templateArchivo} onClick={guardar}>
                {modoEdicion ? 'Guardar cambios' : 'Guardar plantilla'}
              </Button>
            </div>
          </aside>
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
