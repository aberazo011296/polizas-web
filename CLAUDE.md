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

## Seguridad (NO negociable — es para una aseguradora)

Este sistema maneja **PII de asegurados** y está sujeto a la **LOPDP** (Ley
Orgánica de Protección de Datos Personales, Ecuador). El detalle completo y la
cobertura OWASP Top 10 viven en **`SECURITY.md`** (presente en ambos repos) —
mantenlo actualizado en cualquier cambio que toque datos, auth, subidas o deps.

Controles ya implementados (no los rompas al editar):

- **Auth por token** (`polizas-api/app/core/security.py`): el host (WebView de
  la aseguradora) inyecta `Authorization: Bearer <API_TOKEN>`; el backend lo
  valida en cada request con `secrets.compare_digest`. Vacío en dev = sin auth.
  El WebView NO protege la API por sí solo — la validación server-side es la real.
- **CORS** por config (`CORS_ORIGINS`), nunca `*`.
- **Path traversal**: `aseguradora`/`tipo_poliza` se sanitizan vía
  `app/core/paths.py` (`slug()` + ruta contenida en `templates_dir`). Cualquier
  nombre de archivo derivado de input del usuario pasa por ahí.
- **SSTI**: docxtpl renderiza con `SandboxedEnvironment` (los `.docx` los sube
  el usuario → contenido no confiable).
- **XXE**: parser lxml endurecido (`resolve_entities=False, no_network=True, load_dtd=False`).
- **XSS**: el HTML de `mammoth` (preview de Word) se sanitiza con
  `DOMPurify.sanitize()` antes de `dangerouslySetInnerHTML`.
- **Límites de subida**: `max_pdf_size_bytes` / `max_docx_size_bytes` (413 si excede).
- **Dependencias (OWASP A06)**: correr `npm audit` (frontend) y
  `venv/bin/pip-audit` (backend) mensualmente y antes de cada deploy; tras
  actualizar, correr la suite de tests.

**Reglas para no introducir vulnerabilidades nuevas:**

1. Cualquier valor del usuario que termine en una **ruta de archivo** se
   sanitiza y se valida que quede dentro del directorio permitido.
2. Cualquier HTML de origen no confiable que se inyecte en el DOM pasa por
   **DOMPurify**. Evita `dangerouslySetInnerHTML`/`innerHTML` salvo necesidad real.
3. Contenido subido por el usuario (`.docx`, PDF) es **no confiable**: valida
   tamaño y trátalo en entornos endurecidos (sandbox Jinja, parser XML seguro).
4. **Nunca** loguear valores PII (nombres, cédulas, montos). Loguear solo
   nombres de variables / identificadores.
5. La validación y autorización **siempre** ocurre en el backend; el frontend no
   es una barrera de seguridad.

## Buenas prácticas para "vibe coding" en este proyecto

Trabajar rápido con un asistente está bien, pero en un sistema con PII conviene
mantener disciplina. Reglas que seguimos aquí:

- **Verifica, no asumas.** Cada cambio observable se prueba: frontend con el
  preview (revisar consola + snapshot), backend con `pytest tests/ -q`. No des
  algo por "hecho" sin evidencia.
- **Un cambio, un propósito.** Si al editar notas un problema aparte, anótalo y
  trátalo después en vez de mezclar arreglos no relacionados.
- **Reutiliza patrones existentes.** Antes de crear algo nuevo (ej. un modal,
  una validación), busca si ya existe el patrón (`src/components/ui/`,
  `app/core/`) y síguelo — consistencia > novedad.
- **Componentes reutilizables, no copy-paste.** Ej. `ConfirmDialog` reemplazó
  todos los `window.confirm`; un solo lugar para confirmar acciones.
- **Pregunta cuando la decisión es del negocio.** Tope de subidas, modelo de
  auth, etc. son decisiones del dueño — no inventes defaults silenciosos en algo
  que afecta seguridad o UX clave.
- **Seguridad en cada PR, no al final.** Al tocar subidas, rutas, render de HTML
  o auth, repasa la sección de Seguridad de arriba antes de cerrar.
- **El backend manda la verdad.** El frontend valida para UX; la API valida para
  seguridad. Nunca confíes en validaciones que solo viven en el cliente.
- **Mantén `SECURITY.md` y este archivo vivos.** Si cambia un control o una
  dependencia, actualiza la documentación en el mismo cambio.
- **No comitees secretos.** Los `.env` (con `API_TOKEN`, `ANTHROPIC_API_KEY`) y
  los templates Word con datos reales no van a git.
