import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import mammoth from 'mammoth'
import { obtenerPlantilla } from '../services/api'
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
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (!plantillaId) { navigate('/plantillas'); return }
    obtenerPlantilla(plantillaId)
      .then(p => {
        setPlantilla(p)
        const inicial = {}
        p.cajas.forEach(c => { inicial[c.nombre] = '' })
        setReemplazos(inicial)
      })
      .catch(e => show(`Error: ${e.message}`, 'error'))
  }, [plantillaId])

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
      const escaped = texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      html = html.replace(
        new RegExp(escaped, 'g'),
        `<mark class="${styles.highlight}" title="→ {{${variable}}}">${texto}</mark>`
      )
    })
    return html
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

      show('Template generado correctamente', 'success')
      navigate('/plantillas')
    } catch (e) {
      show(`Error: ${e.message}`, 'error')
    } finally {
      setGenerando(false)
    }
  }

  const variables = plantilla?.cajas?.map(c => c.nombre) ?? []
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
                return (
                  <div key={nombre} className={`${styles.varItem} ${ok ? styles.varItemOk : ''}`}>
                    <div className={styles.varLabel}>
                      <span className={styles.varIndicator}>{ok ? '✓' : '○'}</span>
                      <code className={styles.varNombre}>{`{{${nombre}}}`}</code>
                    </div>
                    <input
                      className={styles.varInput}
                      placeholder="Texto en el documento..."
                      value={valor}
                      onChange={e => setReemplazo(nombre, e.target.value)}
                    />
                  </div>
                )
              })}
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
