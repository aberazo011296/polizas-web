# polizas-web

Frontend React para la POC de generación de certificados individuales de pólizas de seguros.

## Estado POC

- ✅ Wizard de creación de plantillas (PDF + campos + datos + template .docx)
- ✅ Procesamiento de pólizas con extracción OCR
- ✅ Revisión y descarga de certificados .docx
- ⏸️ Autenticación (pendiente MVP)
- ⏸️ Gestión de múltiples usuarios (pendiente MVP)

## Requisitos previos

- Node.js 18+
- Backend `polizas-api` corriendo en `http://localhost:8000`

## Setup local

```bash
cd polizas-web
npm install
npm run dev
```

La app queda disponible en http://localhost:5173

## Variables de entorno

Crea un archivo `.env.local` si el backend corre en una URL distinta:

```env
VITE_API_URL=http://localhost:8000
```

Por defecto apunta a `http://localhost:8000`.

## Flujo de uso

### Crear una plantilla nueva

1. Ir a **Plantillas → Nueva plantilla**
2. **Paso 1 — Subir PDF:** sube el PDF modelo de la póliza (el que usarás de referencia para marcar los campos)
3. **Paso 2 — Dibujar campos:** dibuja un rectángulo sobre cada dato a extraer y ponle nombre (ej: `numero_poliza`, `contratante`). Puedes navegar entre páginas del PDF
4. **Paso 3 — Datos:** completa nombre, aseguradora y tipo de póliza
5. **Paso 4 — Template .docx:** sube el archivo Word con los marcadores `{{nombre_variable}}`. El nombre del archivo guardado será `{aseguradora}_{tipo_poliza}.docx`

### Procesar una póliza

1. Ir a **Procesar póliza**
2. Seleccionar la plantilla correspondiente
3. Subir el PDF de la póliza a procesar
4. Revisar los campos extraídos y completar los que falten
5. Descargar el certificado `.docx` generado

## Estructura del proyecto

```
polizas-web/
├── src/
│   ├── pages/
│   │   ├── HomePage.jsx
│   │   ├── PlantillasPage.jsx       # Lista y gestión de plantillas
│   │   ├── NuevaPlantillaPage.jsx   # Wizard de 4 pasos para crear plantilla
│   │   └── ProcesarPage.jsx         # Flujo de extracción y generación
│   ├── components/
│   │   ├── editor/
│   │   │   ├── PdfViewer.jsx        # Renderiza el PDF con PDF.js
│   │   │   └── CajaEditor.jsx       # Canvas Konva para dibujar campos
│   │   └── ui/                      # Button, Toast, Badge, Layout
│   └── services/
│       └── api.js                   # Llamadas al backend
└── public/
```

## Conexión con el backend

Todos los endpoints están en `src/services/api.js`. Las operaciones principales son:

| Función | Endpoint |
|---|---|
| `listarPlantillas` | `GET /plantillas` |
| `crearPlantilla` | `POST /plantillas` |
| `subirTemplatePlantilla` | `POST /plantillas/{id}/template` |
| `eliminarPlantilla` | `DELETE /plantillas/{id}` |
| `inspeccionarPDF` | `POST /polizas/upload/sin-plantilla` |
| `extraerVariables` | `POST /polizas/upload` |
| `generarCertificado` | `POST /certificados/generar` |
