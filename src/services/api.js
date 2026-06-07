const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, options)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    const detail = Array.isArray(err.detail)
      ? err.detail.map(e => `${e.loc?.join('.')}: ${e.msg}`).join('; ')
      : err.detail || 'Error desconocido'
    throw new Error(detail)
  }
  return res
}

// ── Plantillas ─────────────────────────────────────────────────────────────

export async function listarPlantillas() {
  const res = await request('/plantillas')
  return res.json()
}

export async function crearPlantilla(body) {
  const res = await request('/plantillas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

export async function obtenerPlantilla(id) {
  const res = await request(`/plantillas/${id}`)
  return res.json()
}

export async function actualizarPlantilla(id, body) {
  const res = await request(`/plantillas/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

export async function eliminarPlantilla(id) {
  await request(`/plantillas/${id}`, { method: 'DELETE' })
}

export async function subirTemplatePlantilla(id, archivo) {
  const form = new FormData()
  form.append('archivo', archivo)
  const res = await request(`/plantillas/${id}/template`, {
    method: 'POST',
    body: form,
  })
  return res.json()
}

// ── Pólizas ────────────────────────────────────────────────────────────────

export async function inspeccionarPDF(archivo) {
  const form = new FormData()
  form.append('archivo', archivo)
  const res = await request('/polizas/upload/sin-plantilla', {
    method: 'POST',
    body: form,
  })
  return res.json()
}

export async function extraerVariables(archivo, plantillaId) {
  const form = new FormData()
  form.append('archivo', archivo)
  form.append('plantilla_id', plantillaId)
  const res = await request('/polizas/upload', {
    method: 'POST',
    body: form,
  })
  return res.json()
}

// ── Certificados ───────────────────────────────────────────────────────────

export async function generarCertificado(plantillaId, variables) {
  const res = await request('/certificados/generar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plantilla_id: plantillaId, variables }),
  })
  const blob = await res.blob()
  const filename =
    res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] ||
    'certificado.docx'
  return { blob, filename }
}
