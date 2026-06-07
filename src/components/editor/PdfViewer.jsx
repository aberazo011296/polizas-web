import { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import styles from './PdfViewer.module.css'

// Configurar worker — Vite copia el archivo al build
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

export default function PdfViewer({ file, pageIndex = 0, onPageCount, onPageSize }) {
  const canvasRef = useRef(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!file) return
    let cancelled = false
    let renderTask = null

    async function render() {
      setError(null)
      try {
        const arrayBuffer = await file.arrayBuffer()
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

        if (cancelled) return
        onPageCount?.(pdf.numPages)

        const page = await pdf.getPage(pageIndex + 1) // PDF.js es 1-based
        if (cancelled) return

        const viewport = page.getViewport({ scale: 1.0 })

        const canvas = canvasRef.current
        if (!canvas || cancelled) return

        canvas.width  = viewport.width
        canvas.height = viewport.height

        renderTask = page.render({
          canvasContext: canvas.getContext('2d'),
          viewport,
        })
        await renderTask.promise

        // Solo actualizar pageSize después de renderizar exitosamente
        if (!cancelled) {
          onPageSize?.({ width: viewport.width, height: viewport.height })
        }
      } catch (e) {
        if (!cancelled && e?.name !== 'RenderingCancelledException') {
          setError(e.message)
        }
      }
    }

    render()
    return () => {
      cancelled = true
      if (renderTask) {
        renderTask.cancel()
      }
    }
  }, [file, pageIndex])

  if (error) return <div className={styles.error}>Error al renderizar el PDF: {error}</div>

  return (
    <div className={styles.wrapper}>
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  )
}
