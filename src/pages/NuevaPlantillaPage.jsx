import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import mammoth from 'mammoth'
import DOMPurify from 'dompurify'
import { crearPlantilla, actualizarPlantilla, obtenerPlantilla, sugerirVariables } from '../services/api'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
import Button from '../components/ui/Button'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { useToast } from '../components/ui/Toast'
import styles from './NuevaPlantillaPage.module.css'

const STEPS = ['Datos', 'Variables', 'Template .docx']

function normalizarNombre(texto) {
  return texto.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
}

export default function NuevaPlantillaPage() {
  const [step, setStep] = useState(0)
  const navigate = useNavigate()
  const location = useLocation()
  const { show } = useToast()

  // Modo edición: viene con plantillaId en el state del router
  const plantillaId = location.state?.plantillaId || null
  const modoEdicion = !!plantillaId

  // Step 0: datos
  const [nombre, setNombre] = useState('')
  const [aseguradora, setAseguradora] = useState('generali')
  const [tipoPoliza, setTipoPoliza] = useState('desgravamen')

  // Step 1: variables (nombre + descripción para la IA)
  const [variables, setVariables] = useState([]) // [{nombre, descripcion}]
  const [sugiriendo, setSugiriendo] = useState(false)
  // Sugerencias de la IA pendientes de decidir si reemplazan o se agregan
  const [sugerenciasPendientes, setSugerenciasPendientes] = useState(null)
  // Cajas antiguas (coordenadas): se conservan tal cual si la plantilla las tenía
  const [cajasOriginales, setCajasOriginales] = useState([])

  // Step 2: template Word
  const [templateArchivo, setTemplateArchivo] = useState(null)
  const [templatePreview, setTemplatePreview] = useState('')
  const [reemplazos, setReemplazos] = useState({})
  const [camposManuales, setCamposManuales] = useState([]) // [{nombre, valor_por_defecto}]
  const [guardando, setGuardando] = useState(false)

  // Cargar datos existentes en modo edición
  useEffect(() => {
    if (!plantillaId) return
    obtenerPlantilla(plantillaId)
      .then(p => {
        setNombre(p.nombre)
        setAseguradora(p.aseguradora)
        setTipoPoliza(p.tipo_poliza)
        setCajasOriginales(p.cajas || [])
        // Variables nuevas, o derivadas de las cajas en plantillas antiguas
        const vars = (p.variables?.length
          ? p.variables
          : (p.cajas || []).map(c => ({ nombre: c.nombre, descripcion: '' })))
        setVariables(vars)
        const r = {}
        vars.forEach(v => { r[v.nombre] = '' })
        setReemplazos(r)
        setCamposManuales(p.campos_manuales || [])
      })
      .catch(e => show(`Error cargando plantilla: ${e.message}`, 'error'))
  }, [plantillaId])

  // ── Step 0: datos ──────────────────────────────────────────────────────
  function continuarAVariables() {
    if (!nombre.trim()) { show('Ingresa un nombre para la plantilla', 'error'); return }
    if (!aseguradora.trim()) { show('Ingresa el nombre de la aseguradora', 'error'); return }
    if (!tipoPoliza.trim()) { show('Ingresa el tipo de póliza', 'error'); return }
    setStep(1)
  }

  // ── Step 1: variables ──────────────────────────────────────────────────
  async function sugerirDesdePDF(f) {
    if (!f) return
    setSugiriendo(true)
    try {
      const { variables: sugeridas } = await sugerirVariables(f)
      const conNombre = variables.filter(v => v.nombre.trim())
      if (conNombre.length > 0) {
        // Hay variables previas: preguntar si reemplazar o agregar
        setSugerenciasPendientes(sugeridas)
      } else {
        setVariables(sugeridas)
        show(`${sugeridas.length} variables sugeridas — revisa y ajusta la lista`, 'success')
      }
    } catch (e) {
      show(`Error sugiriendo variables: ${e.message}`, 'error')
    } finally {
      setSugiriendo(false)
    }
  }

  function aplicarSugerencias(reemplazar) {
    const sugeridas = sugerenciasPendientes
    if (reemplazar) {
      setVariables(sugeridas)
    } else {
      setVariables(prev => {
        const existentes = new Set(prev.map(v => v.nombre))
        return [...prev, ...sugeridas.filter(s => !existentes.has(s.nombre))]
      })
    }
    setSugerenciasPendientes(null)
    show(`${sugeridas.length} variables sugeridas — revisa y ajusta la lista`, 'success')
  }

  function setVariable(i, campo, valor) {
    setVariables(prev => prev.map((v, j) => j === i ? { ...v, [campo]: valor } : v))
  }

  function validarVariables() {
    const conNombre = variables.filter(v => v.nombre.trim())
    if (conNombre.length === 0) return 'Define al menos una variable'
    const nombres = conNombre.map(v => v.nombre)
    if (new Set(nombres).size !== nombres.length) return 'Los nombres deben ser únicos'
    return null
  }

  function continuarATemplate() {
    const err = validarVariables()
    if (err) { show(err, 'error'); return }
    // Inicializar reemplazos con las variables definidas
    setVariables(prev => prev.filter(v => v.nombre.trim()))
    const r = {}
    variables.filter(v => v.nombre.trim()).forEach(v => { r[v.nombre] = reemplazos[v.nombre] || '' })
    setReemplazos(r)
    setStep(2)
  }

  // ── Step 2: template Word ──────────────────────────────────────────────
  async function handleTemplateArchivo(f) {
    if (!f) return
    setTemplateArchivo(f)
    const buf = await f.arrayBuffer()
    const result = await mammoth.convertToHtml({ arrayBuffer: buf })
    setTemplatePreview(result.value)
  }

  function previewConResaltado() {
    let html = templatePreview
    // Resaltar extraídas (cada línea por separado si el texto es multilínea)
    Object.entries(reemplazos).forEach(([variable, texto]) => {
      if (!texto.trim()) return
      texto.split('\n').map(l => l.trim()).filter(Boolean).forEach(linea => {
        const escaped = linea.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        html = html.replace(new RegExp(escaped, 'g'),
          `<mark style="background:rgba(255,200,0,.45);border-radius:2px;padding:0 2px;" title="→ {{${variable}}}">${linea}</mark>`)
      })
    })
    // Resaltar posición de campos manuales (texto_reemplazar)
    camposManuales.forEach(({ nombre, texto_reemplazar }) => {
      if (!texto_reemplazar?.trim() || !nombre.trim()) return
      const escaped = texto_reemplazar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      html = html.replace(new RegExp(escaped, 'g'),
        `<mark style="background:rgba(192,34,15,.18);border-radius:2px;padding:0 2px;" title="→ {{${nombre}}}">${texto_reemplazar}</mark>`)
    })
    // El HTML viene de un .docx subido (mammoth): sanitizar antes de
    // inyectarlo con dangerouslySetInnerHTML para evitar XSS.
    return DOMPurify.sanitize(html)
  }

  async function guardar() {
    if (!modoEdicion && !templateArchivo) {
      show('Sube el documento Word original', 'error'); return
    }

    setGuardando(true)
    try {
      const body = {
        nombre: nombre.trim(),
        aseguradora,
        tipo_poliza: tipoPoliza,
        cajas: cajasOriginales,
        variables: variables.filter(v => v.nombre.trim()),
        campos_manuales: camposManuales.filter(c => c.nombre.trim()),
      }
      const plantilla = modoEdicion
        ? await actualizarPlantilla(plantillaId, body)
        : await crearPlantilla(body)

      if (templateArchivo) {
        const mapaReemplazos = { ...Object.fromEntries(Object.entries(reemplazos).filter(([, v]) => v.trim())) }
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
            {step === 0 && 'Datos básicos de la plantilla'}
            {step === 1 && 'Define qué datos extrae la IA de cada póliza'}
            {step === 2 && 'Sube el Word original y mapea cada variable al texto que debe reemplazar'}
          </p>
        </div>
        <StepIndicator current={step} steps={STEPS} />
      </header>

      {/* STEP 0: datos */}
      {step === 0 && (
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
            </label>

            <label className={styles.formLabel}>
              Tipo de póliza <span className={styles.required}>*</span>
              <input
                className={`${styles.formInput} ${!tipoPoliza.trim() ? styles.inputError : ''}`}
                value={tipoPoliza}
                onChange={e => setTipoPoliza(e.target.value.toLowerCase())}
                placeholder="ej: desgravamen"
              />
            </label>
          </div>

          <div className={styles.formActions}>
            <Button variant="ghost" onClick={() => navigate('/plantillas')}>‹ Cancelar</Button>
            <Button onClick={continuarAVariables}>Continuar ›</Button>
          </div>
        </div>
      )}

      {/* STEP 1: variables */}
      {step === 1 && (
        <div className={styles.varsStep}>
          <div className={styles.varsCard}>
            <div className={styles.varsHeader}>
              <div>
                <h2 className={styles.formTitle}>Variables a extraer</h2>
                <p className={styles.varsHint}>
                  La IA buscará cada una en el PDF usando su descripción.
                </p>
              </div>
              <div className={styles.varsTools}>
                <label className={`${styles.sugerirBtn} ${sugiriendo ? styles.sugerirBtnLoading : ''}`}>
                  {sugiriendo && <span className={styles.btnSpinner} aria-hidden="true" />}
                  {sugiriendo ? 'Analizando la póliza…' : '✨ Sugerir desde un PDF'}
                  <input
                    type="file" accept="application/pdf" style={{ display: 'none' }}
                    disabled={sugiriendo}
                    onChange={e => { sugerirDesdePDF(e.target.files[0]); e.target.value = '' }}
                  />
                </label>
                <Button
                  variant="secondary" size="sm"
                  onClick={() => setVariables(prev => [...prev, { nombre: '', descripcion: '' }])}
                >+ Agregar variable</Button>
              </div>
            </div>

            <div className={styles.listadoInfo}>
              <p className={styles.listadoInfoTitle}>
                El nombre decide cómo se escribe el valor en el certificado Word:
              </p>
              <div className={styles.listadoInfoCols}>
                <div className={styles.listadoInfoCol}>
                  <code>listado_exclusiones</code>
                  <span className={styles.listadoInfoDesc}>
                    Con el prefijo <code>listado_</code>, cada ítem queda en su
                    propio párrafo (renglón). Úsalo para enumeraciones: exclusiones,
                    documentos requeridos, límites de edad…
                  </span>
                  <span className={styles.listadoInfoEjemplo}>
                    a) Suicidio…<br />b) Guerra…<br />c) Actos delictivos…
                  </span>
                </div>
                <div className={styles.listadoInfoCol}>
                  <code>exclusiones</code>
                  <span className={styles.listadoInfoDesc}>
                    Sin el prefijo, todo el texto se une en un solo
                    párrafo corrido. Úsalo para descripciones, nombres, fechas
                    y montos.
                  </span>
                  <span className={styles.listadoInfoEjemplo}>
                    a) Suicidio… b) Guerra… c) Actos delictivos…
                  </span>
                </div>
              </div>
            </div>

            {variables.length === 0 && !sugiriendo && (
              <div className={styles.varsEmpty}>
                <p>
                  Sube una póliza de ejemplo y la IA te propondrá la lista de variables,
                  o agrégalas a mano una por una.
                </p>
              </div>
            )}

            {sugiriendo && (
              <div className={styles.analizando} role="status" aria-live="polite">
                <div className={styles.analizandoInfo}>
                  <span className={styles.analizandoSpinner} aria-hidden="true" />
                  <div>
                    <p className={styles.analizandoTitulo}>La IA está leyendo la póliza</p>
                    <p className={styles.analizandoSub}>
                      Identificando secciones y datos… suele tomar entre 10 y 20 segundos.
                    </p>
                  </div>
                </div>
                <div className={styles.skeletonList} aria-hidden="true">
                  {[0, 1, 2, 3].map(i => (
                    <div key={i} className={styles.skeletonRow} style={{ animationDelay: `${i * .12}s` }}>
                      <span className={styles.skeletonNombre} />
                      <span className={styles.skeletonDesc} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className={styles.varDefList}>
              {variables.map((v, i) => (
                <div key={i} className={styles.varDefRow}>
                  <span className={styles.varDefNum}>{i + 1}</span>
                  <div className={styles.varDefInputs}>
                    <input
                      className={styles.varDefNombre}
                      placeholder="nombre_variable"
                      value={v.nombre}
                      onChange={e => setVariable(i, 'nombre', normalizarNombre(e.target.value))}
                    />
                    {v.nombre.startsWith('listado_') && (
                      <span className={styles.varDefBadge} title="Por el prefijo listado_, cada ítem irá en su propio párrafo en el Word">
                        ↵ un párrafo por ítem
                      </span>
                    )}
                    <input
                      className={styles.varDefDesc}
                      placeholder="Qué es este dato y cómo reconocerlo en el PDF (opcional pero recomendado)"
                      value={v.descripcion}
                      onChange={e => setVariable(i, 'descripcion', e.target.value)}
                    />
                  </div>
                  <button
                    className={styles.varDefDelete}
                    title="Eliminar variable"
                    onClick={() => setVariables(prev => prev.filter((_, j) => j !== i))}
                  >✕</button>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.formActions}>
            <Button variant="ghost" onClick={() => setStep(0)}>‹ Atrás</Button>
            <Button onClick={continuarATemplate}>Continuar ›</Button>
          </div>
        </div>
      )}

      {/* STEP 2: template Word */}
      {step === 2 && (
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
              {variables.filter(v => v.nombre.trim()).map(v => {
                const valor = reemplazos[v.nombre] || ''
                const ok = valor.trim() !== ''
                return (
                  <div key={v.nombre} className={`${styles.varItem} ${ok ? styles.varItemOk : ''}`}>
                    <div className={styles.varLabel}>
                      <span className={styles.varIndicator}>{ok ? '✓' : '○'}</span>
                      <code className={styles.varNombre}>{`{{${v.nombre}}}`}</code>
                    </div>
                    <textarea
                      className={styles.varInput}
                      placeholder={'Texto en el documento...\n(si son varios párrafos, uno por línea)'}
                      value={valor}
                      rows={Math.max(1, valor.split('\n').length)}
                      onChange={e => setReemplazos(prev => ({ ...prev, [v.nombre]: e.target.value }))}
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
              <Button variant="ghost" size="sm" onClick={() => setStep(1)}>‹ Atrás</Button>
              <Button loading={guardando} disabled={!modoEdicion && !templateArchivo} onClick={guardar}>
                {modoEdicion ? 'Guardar cambios' : 'Guardar plantilla'}
              </Button>
            </div>
          </aside>
        </div>
      )}

      <ConfirmDialog
        open={!!sugerenciasPendientes}
        title="¿Reemplazar las variables actuales?"
        message={sugerenciasPendientes ? `Ya tienes ${variables.filter(v => v.nombre.trim()).length} variables en la lista y la IA sugirió ${sugerenciasPendientes.length}. Reemplazar evita variables duplicadas con otro nombre (recomendado); conservar agrega solo las de nombre nuevo.` : ''}
        confirmLabel="Reemplazar lista"
        cancelLabel="Conservar y agregar"
        danger={false}
        onConfirm={() => aplicarSugerencias(true)}
        onCancel={() => aplicarSugerencias(false)}
      />
    </div>
  )
}

// ── Sub-componentes ────────────────────────────────────────────────────────

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
