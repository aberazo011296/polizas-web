import { useRef, useState, useEffect } from 'react'
import { Stage, Layer, Rect, Text } from 'react-konva'
import styles from './CajaEditor.module.css'

const COLORS = [
  '#4f7cff', '#34c77b', '#f0a832', '#e8455a',
  '#b87fff', '#00c8d4', '#ff7b54', '#54d4ff',
]

function colorParaIndice(i) {
  return COLORS[i % COLORS.length]
}

export default function CajaEditor({ width, height, cajas, onChange }) {
  const [dibujando, setDibujando] = useState(null) // {x0, y0, x1, y1}
  const [seleccionado, setSeleccionado] = useState(null)
  const stageRef = useRef(null)

  function getPos(e) {
    const stage = stageRef.current
    const pos = stage.getPointerPosition()
    return pos
  }

  function onMouseDown(e) {
    if (e.target !== e.target.getStage()) return // click en rect existente
    const pos = getPos(e)
    setDibujando({ x0: pos.x, y0: pos.y, x1: pos.x, y1: pos.y })
    setSeleccionado(null)
  }

  function onMouseMove(e) {
    if (!dibujando) return
    const pos = getPos(e)
    setDibujando(d => ({ ...d, x1: pos.x, y1: pos.y }))
  }

  function onMouseUp() {
    if (!dibujando) return
    const { x0, y0, x1, y1 } = dibujando
    const w = Math.abs(x1 - x0)
    const h = Math.abs(y1 - y0)

    if (w > 10 && h > 10) {
      const nueva = {
        id: Date.now(),
        nombre: '',
        pagina: 0, // se actualiza desde la página padre
        x: Math.min(x0, x1),
        y: Math.min(y0, y1),
        ancho: w,
        alto: h,
      }
      onChange([...cajas, nueva])
      setSeleccionado(nueva.id)
    }
    setDibujando(null)
  }

  function eliminarCaja(id) {
    onChange(cajas.filter(c => c.id !== id))
    setSeleccionado(null)
  }

  // Rect de preview mientras se dibuja
  const preview = dibujando
    ? {
        x: Math.min(dibujando.x0, dibujando.x1),
        y: Math.min(dibujando.y0, dibujando.y1),
        w: Math.abs(dibujando.x1 - dibujando.x0),
        h: Math.abs(dibujando.y1 - dibujando.y0),
      }
    : null

  return (
    <div className={styles.wrapper}>
      <Stage
        ref={stageRef}
        width={width}
        height={height}
        className={styles.stage}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        style={{ cursor: dibujando ? 'crosshair' : 'crosshair' }}
      >
        <Layer>
          {/* Cajas guardadas */}
          {cajas.map((c, i) => {
            const color = colorParaIndice(i)
            const isSelected = seleccionado === c.id
            return (
              <React.Fragment key={c.id}>
                <Rect
                  x={c.x} y={c.y}
                  width={c.ancho} height={c.alto}
                  fill={`${color}22`}
                  stroke={color}
                  strokeWidth={isSelected ? 2 : 1.5}
                  onClick={() => setSeleccionado(c.id)}
                  dash={isSelected ? [] : []}
                />
                <Text
                  x={c.x + 4} y={c.y + 4}
                  text={c.nombre || `campo_${i + 1}`}
                  fontSize={10}
                  fill={color}
                  fontFamily="DM Mono, monospace"
                />
              </React.Fragment>
            )
          })}

          {/* Preview mientras dibuja */}
          {preview && (
            <Rect
              x={preview.x} y={preview.y}
              width={preview.w} height={preview.h}
              fill="rgba(79,124,255,.15)"
              stroke="#4f7cff"
              strokeWidth={1.5}
              dash={[4, 3]}
            />
          )}
        </Layer>
      </Stage>

      {/* Panel lateral de cajas */}
      {seleccionado && (
        <CajaSidePanel
          caja={cajas.find(c => c.id === seleccionado)}
          onUpdate={(campo, valor) => {
            onChange(cajas.map(c =>
              c.id === seleccionado ? { ...c, [campo]: valor } : c
            ))
          }}
          onDelete={() => eliminarCaja(seleccionado)}
        />
      )}
    </div>
  )
}

// Necesitamos importar React para Fragment
import React from 'react'

function CajaSidePanel({ caja, onUpdate, onDelete }) {
  return (
    <div className={styles.sidePanel}>
      <div className={styles.sidePanelHeader}>
        <span>Editar campo</span>
        <button className={styles.deleteBtn} onClick={onDelete} title="Eliminar caja">✕</button>
      </div>
      <label className={styles.label}>
        Nombre de variable
        <input
          className={styles.input}
          value={caja.nombre}
          onChange={e => onUpdate('nombre', e.target.value.trim().replace(/\s+/g, '_'))}
          placeholder="ej: numero_poliza"
          autoFocus
        />
        <span className={styles.hint}>Sin espacios. Se usará como <code>{'{{nombre}}'}</code> en el template.</span>
      </label>
      <div className={styles.coords}>
        <span>x: {Math.round(caja.x)}</span>
        <span>y: {Math.round(caja.y)}</span>
        <span>{Math.round(caja.ancho)} × {Math.round(caja.alto)} px</span>
      </div>
    </div>
  )
}
