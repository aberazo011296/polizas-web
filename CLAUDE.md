# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es esto

Frontend React (Vite) de una POC para extraer datos de PDFs de pólizas de seguros (Generali) y generar certificados individuales en Word. Trabaja en pareja con el backend **`polizas-api`** (FastAPI), ubicado en `/Users/belen/Documents/GitHub/polizas-api` — muchos cambios de funcionalidad tocan ambos repos.

## Comandos

```bash
npm run dev        # servidor de desarrollo en http://localhost:5173
npm run build      # build de producción (vite build) — úsalo para verificar cambios
npm run lint       # eslint
```

No hay tests en el frontend. Los tests viven en el backend:

```bash
cd ../polizas-api && venv/bin/python -m pytest tests/ -q
```

**Backend:** siempre usar `venv/bin/python` de `polizas-api/venv` (Python 3.11) — el python3.9 del sistema tiene conflictos de numpy/pandas. El servidor uvicorn debe reiniciarse manualmente para tomar cambios de código. La URL del backend se configura con `VITE_API_URL` (default `http://localhost:8000`).

## Arquitectura del flujo completo (ambos repos)

El pipeline de punta a punta:

1. **Plantilla de extracción** (`polizas-api/data/plantillas.json`): define las variables a extraer. Cada plantilla tiene `variables` (nombre + descripción para la IA), `campos_manuales`, y opcionalmente `cajas` (coordenadas, modo antiguo — plantillas viejas las conservan). Se crea/edita en `NuevaPlantillaPage` (wizard de 3 pasos: Datos → Variables → Template .docx). El paso Variables tiene "Sugerir desde un PDF" (`POST /plantillas/sugerir-variables`): la IA propone la lista desde una póliza de ejemplo.
2. **Extracción** (`POST /polizas/upload`): el backend tiene tres estrategias, en este orden:
   - **IA** (`extractor_llm.py`): si hay `ANTHROPIC_API_KEY` en el `.env` del backend, envía el texto completo del PDF a Claude con las variables de la plantilla; las coordenadas de las cajas se ignoran. Tolera cualquier layout. Verifica que el texto devuelto exista en el PDF (si no → estado `dudoso`).
   - **Capa de texto directa** (`extractor.py`): recorta por coordenadas de caja.
   - **OCR Tesseract**: fallback para PDFs escaneados.
3. **Revisión** (`ProcesarPage`): la persona ve los valores extraídos (estados `ok`/`falta`/`dudoso`), corrige y completa manuales.
4. **Generación** (`POST /certificados/generar`): docxtpl rellena el template Word `polizas-api/templates/{aseguradora}_{tipo_poliza}.docx` (ej. `generali_desgravamen.docx`). Los `\n` en valores se convierten en párrafos Word reales (`_br_a_parrafos` en `generador.py`).
5. **Template builder** (`EditarTemplatePage` + `template_builder.py`): construye el template Word a partir de un Word de referencia con datos reales — la persona escribe el texto del Word que corresponde a cada variable y el backend lo sustituye por `{{variable}}`. Soporta bloques multilínea (un texto que abarca varios párrafos) y matching tolerante a espacios.

## Convenciones clave

- **Prefijo `listado_`** en el nombre de una variable: la limpieza separa el texto en un párrafo por ítem (líneas que empiezan con `a)`, `1.`, `-`, `•`, `Edad`...). Sin prefijo, todo se une en un solo párrafo (así está escrito el Word de referencia).
- **El texto del certificado Word NO es copia del PDF**: el Word de referencia redacta distinto. Al construir templates, los reemplazos siempre usan el texto del lado Word, no el extraído del PDF.
- Los nombres de variable conectan tres lugares y deben coincidir: caja en `plantillas.json` ↔ marcador `{{variable}}` en el template Word ↔ valor extraído.
- `Variable.origen` en el backend: `extraido` (OCR), `extraido_directo` (capa de texto), `extraido_ia` (Claude), `manual`.
- Los templates Word de salida (`polizas-api/templates/*.docx`) **no están en git** — haz backup antes de modificarlos.
- UI en español; CSS Modules por página/componente; llamadas API centralizadas en `src/services/api.js`.

## Datos de prueba

- PDFs de ejemplo: `/Users/belen/Downloads/990664.pdf` y `990633.pdf` (layouts distintos del mismo ramo).
- Word de referencia: `/Users/belen/Downloads/FONDO DE JUBILACION DE LA CONTRALORIA.docx` (corresponde a la póliza 990664).
- Plantilla principal: "Generali1", id `4fb14239-cb2a-443d-b4a8-cd0d78fb252b`.
