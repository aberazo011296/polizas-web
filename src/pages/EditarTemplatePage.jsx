import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import mammoth from 'mammoth'
import DOMPurify from 'dompurify'
import { obtenerPlantilla, actualizarPlantilla } from '../services/api'
import Button from '../components/ui/Button'
import { useToast } from '../components/ui/Toast'
import styles from './EditarTemplatePage.module.css'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function EditarTemplatePage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { show } = useToast()

  const plantillaId = location.state?.plantillaId
  const [plantilla, setPlantilla] = useState(null)
  const [archivo, setArchivo] = useState(null)
  const [preview, setPreview] = useState('')
  const [reemplazos, setReemplazos] = useState({}) // { variable: texto_en_doc }
  const [generando, setGenerando] = useState(false)
  const [paso, setPaso] = useState(0) // 0=subir, 1=mapear
  const [nuevoManual, setNuevoManual] = useState('')
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (!plantillaId) { navigate('/plantillas'); return }
    obtenerPlantilla(plantillaId)
      .then(async p => {
        setPlantilla(p)
        const guardados = p.reemplazos_template || {}
        const inicial = {}
        const extraidas = p.variables?.length ? p.variables : (p.cajas || [])
        extraidas.forEach(c => { inicial[c.nombre] = guardados[c.nombre] || '' })
        ;(p.campos_manuales || []).forEach(c => { inicial[c.nombre] = guardados[c.nombre] || '' })
        setReemplazos(inicial)

        // Si ya se construyó un template antes, recuperar el Word de
        // referencia guardado y saltar directo al paso de mapeo.
        try {
          const res = await fetch(`${BASE_URL}/plantillas/${plantillaId}/template/doc-referencia`)
          if (res.ok) {
            const blob = await res.blob()
            const nombre = p.doc_referencia || 'documento.docx'
            await handleArchivo(new File([blob], nombre, { type: blob.type }))
            show('Se cargó el Word y el mapeo guardados — puedes ajustar y regenerar', 'success')
          }
        } catch { /* sin referencia guardada: flujo normal de subida */ }
      })
      .catch(e => show(`Error: ${e.message}`, 'error'))
  }, [plantillaId])

  async function agregarCampoManual() {
    const nombre = nuevoManual.trim().toLowerCase().replace(/\s+/g, '_')
    if (!nombre) return
    const existe = (plantilla.cajas || []).some(c => c.nombre === nombre)
      || (plantilla.variables || []).some(v => v.nombre === nombre)
      || (plantilla.campos_manuales || []).some(c => c.nombre === nombre)
    if (existe) { show(`Ya existe una variable "${nombre}"`, 'error'); return }

    const actualizada = {
      nombre: plantilla.nombre,
      aseguradora: plantilla.aseguradora,
      tipo_poliza: plantilla.tipo_poliza,
      cajas: plantilla.cajas || [],
      variables: plantilla.variables || [],
      campos_manuales: [...(plantilla.campos_manuales || []), { nombre, valor_por_defecto: '' }],
    }
    try {
      const p = await actualizarPlantilla(plantillaId, actualizada)
      setPlantilla(p)
      setReemplazos(prev => ({ ...prev, [nombre]: '' }))
      setNuevoManual('')
      show(`Campo manual "${nombre}" agregado`, 'success')
    } catch (e) {
      show(`Error: ${e.message}`, 'error')
    }
  }

  async function handleArchivo(f) {
    if (!f) return
    setArchivo(f)
    // Convertir a HTML para preview
    const buf = await f.arrayBuffer()
    const result = await mammoth.convertToHtml({ arrayBuffer: buf })
    setPreview(result.value)
    setPaso(1)
  }

  function setReemplazo(variable, texto) {
    setReemplazos(prev => ({ ...prev, [variable]: texto }))
  }

  // Resalta el texto buscado en el preview
  function previewConResaltado() {
    let html = preview
    Object.entries(reemplazos).forEach(([variable, texto]) => {
      if (!texto.trim()) return
      // Si el texto tiene varias líneas (párrafos separados en el Word),
      // resaltar cada línea por separado
      const lineas = texto.split('\n').map(l => l.trim()).filter(Boolean)
      lineas.forEach(linea => {
        const escaped = linea.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        html = html.replace(
          new RegExp(escaped, 'g'),
          `<mark class="${styles.highlight}" title="→ {{${variable}}}">${linea}</mark>`
        )
      })
    })
    // El HTML viene de un .docx subido (mammoth): sanitizar antes de
    // inyectarlo con dangerouslySetInnerHTML para evitar XSS.
    return DOMPurify.sanitize(html)
  }

  async function generarTemplate() {
    const conTexto = Object.entries(reemplazos).filter(([, v]) => v.trim())
    if (conTexto.length === 0) {
      show('Ingresa al menos un texto a reemplazar', 'error'); return
    }

    setGenerando(true)
    try {
      const form = new FormData()
      form.append('archivo', archivo)
      form.append('reemplazos', JSON.stringify(Object.fromEntries(conTexto)))

      const res = await fetch(`${BASE_URL}/plantillas/${plantillaId}/template/build`, {
        method: 'POST',
        body: form,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error(Array.isArray(err.detail)
          ? err.detail.map(e => e.msg).join('; ')
          : err.detail)
      }

      // Limpiar de la plantilla las variables que quedaron sin mapear:
      // sin marcador en el Word no se usan, y solo estorban en la extracción.
      const usadas = new Set(conTexto.map(([nombre]) => nombre))
      const sinUsar = variables.filter(v => !usadas.has(v))
      if (sinUsar.length > 0) {
        try {
          await actualizarPlantilla(plantillaId, {
            nombre: plantilla.nombre,
            aseguradora: plantilla.aseguradora,
            tipo_poliza: plantilla.tipo_poliza,
            cajas: (plantilla.cajas || []).filter(c => usadas.has(c.nombre)),
            variables: (plantilla.variables || []).filter(v => usadas.has(v.nombre)),
            campos_manuales: (plantilla.campos_manuales || []).filter(c => usadas.has(c.nombre)),
          })
          show(`Template generado. Se eliminaron ${sinUsar.length} variables sin usar: ${sinUsar.join(', ')}`, 'success')
        } catch {
          show('Template generado, pero no se pudieron eliminar las variables sin usar', 'error')
        }
      } else {
        show('Template generado correctamente', 'success')
      }
      navigate('/plantillas')
    } catch (e) {
      show(`Error: ${e.message}`, 'error')
    } finally {
      setGenerando(false)
    }
  }

  const variablesExtraccion = (plantilla?.variables?.length
    ? plantilla.variables.map(v => v.nombre)
    : plantilla?.cajas?.map(c => c.nombre)) ?? []
  const variablesManuales = plantilla?.campos_manuales?.map(c => c.nombre) ?? []
  const variables = [...variablesExtraccion, ...variablesManuales]
  const colocadas = variables.filter(v => reemplazos[v]?.trim())
  const faltantes = variables.filter(v => !reemplazos[v]?.trim())

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Template — {plantilla?.nombre}</h1>
          <p className={styles.sub}>
            {paso === 0
              ? 'Sube el documento Word original con los datos reales'
              : 'Para cada variable, escribe el texto exacto que aparece en el documento'}
          </p>
        </div>
        <div className={styles.headerActions}>
          <Button variant="ghost" onClick={() => navigate('/plantillas')}>‹ Volver</Button>
          {paso === 1 && (
            <Button loading={generando} onClick={generarTemplate}>
              Generar template
            </Button>
          )}
        </div>
      </header>

      {/* PASO 0: subir documento */}
      {paso === 0 && (
        <div className={styles.uploadZone} onClick={() => fileInputRef.current?.click()}>
          <span className={styles.uploadIcon}>📄</span>
          <span className={styles.uploadText}>Sube el Word original con los datos reales</span>
          <span className={styles.uploadSub}>
            Ej: el documento con "990664", "FONDO DE JUBILACION...", etc.
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            style={{ display: 'none' }}
            onChange={e => handleArchivo(e.target.files[0])}
          />
        </div>
      )}

      {/* PASO 1: mapear variables */}
      {paso === 1 && (
        <div className={styles.layout}>

          {/* Preview del documento */}
          <div className={styles.previewArea}>
            <div className={styles.previewHeader}>
              <span className={styles.previewTitle}>Vista previa — {archivo?.name}</span>
              <button className={styles.cambiarBtn} onClick={() => { setPaso(0); setArchivo(null); setPreview('') }}>
                Cambiar archivo
              </button>
            </div>
            <div
              className={styles.previewContent}
              dangerouslySetInnerHTML={{ __html: previewConResaltado() }}
            />
          </div>

          {/* Panel de variables */}
          <aside className={styles.panel}>
            <div className={styles.panelStats}>
              <span className={styles.statOk}>{colocadas.length} mapeadas</span>
              <span className={styles.statFalta}>{faltantes.length} faltantes</span>
            </div>

            <p className={styles.panelHint}>
              Escribe el texto exacto del documento que debe convertirse en cada variable.
              Se resaltará en el preview.
            </p>

            <div className={styles.varList}>
              {variables.map(nombre => {
                const valor = reemplazos[nombre] || ''
                const ok = valor.trim() !== ''
                const esManual = variablesManuales.includes(nombre)
                return (
                  <div key={nombre} className={`${styles.varItem} ${ok ? styles.varItemOk : ''}`}>
                    <div className={styles.varLabel}>
                      <span className={styles.varIndicator}>{ok ? '✓' : '○'}</span>
                      <code className={styles.varNombre}>{`{{${nombre}}}`}</code>
                      {esManual && <span className={styles.varBadge}>manual</span>}
                    </div>
                    <textarea
                      className={styles.varInput}
                      placeholder={'Texto en el documento...\n(si son varios párrafos, uno por línea)'}
                      value={valor}
                      rows={Math.max(1, valor.split('\n').length)}
                      onChange={e => setReemplazo(nombre, e.target.value)}
                    />
                  </div>
                )
              })}
            </div>

            {/* Agregar campo manual */}
            <div className={styles.manualAdd}>
              <p className={styles.panelHint}>
                ¿Falta una variable? Agrégala como campo de ingreso manual
                (se pedirá al procesar cada póliza).
              </p>
              <div className={styles.manualAddRow}>
                <input
                  className={styles.varInput}
                  placeholder="nombre_del_campo"
                  value={nuevoManual}
                  onChange={e => setNuevoManual(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') agregarCampoManual() }}
                />
                <Button variant="ghost" onClick={agregarCampoManual}>+ Agregar</Button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
