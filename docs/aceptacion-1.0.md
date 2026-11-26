# Prueba de aceptación de la 1.0.0 (WAY-30)

Guion repetible de la prueba de aceptación de una versión candidata y resultado de su última ejecución. Cada paso termina como **conforme**, **desviación** o **bloqueado**. Un paso bloqueado no se da por bueno: queda pendiente con su motivo.

## Cómo repetirla

Requisitos: Windows 11, Node.js 22 o posterior, git, la CLI `claude` (Claude Code 2.1.271 o posterior) y `npm ci` hecho en el repositorio. Para el paso Q6, Docker Desktop en marcha y la imagen `wayfinder:dev` construida (`docker build -t wayfinder:dev .`).

1. Calidad automática (pasos Q1 a Q7):

   ```powershell
   npm run typecheck
   npm test
   npm run check:dist
   npm run test:e2e
   npm run test:docker
   claude plugin validate .
   npm pack --dry-run
   ```

2. Recorrido de la versión (pasos 1 a 6): `npm run test:acceptance` (`scripts/acceptance.mjs`). Opciones: `--from-ref <ref>` es la versión anterior desde la que se actualiza (por defecto, `891a4657c`, el último `main` con 0.1.0) y `--keep` conserva la carpeta temporal.
   - **Aislamiento:** todo va a una carpeta nueva de `%TEMP%`: `CLAUDE_CONFIG_DIR`, las carpetas de datos (`WAYFINDER_HOME` u opción `home`), y el prefijo y la caché de npm. No escribe en `~/.claude`, `~/.wayfinder` ni en el npm global. El paso 6 lo comprueba (mismo HEAD de `~/.wayfinder` y mismo `installed_plugins.json`).
   - **Cómo simula la sesión:** los hooks se ejecutan con el mismo JSON que envía Claude Code, y las herramientas `wf_*` contra el servidor MCP real del plugin, con un cliente MCP. La web se prueba con su API, usando la clave, y con Chromium (Playwright).
   - El guion termina con código 1 si algún paso no es conforme, e imprime la tabla de resultados.

3. Pasos manuales (M1 a M3): no se pueden automatizar; ver la tabla.

## Resultado del 2026-11-26

Candidato `1.0.0` (rama `release/1.0.0`) en ChinorrisPC: Windows 11, Node 24.12.0, npm 11.17.0, Claude Code 2.1.332 y Chromium de Playwright 1.64.1.

### Calidad automática

| Paso | Comprobación | Resultado | Evidencia |
|---|---|---|---|
| Q1 | `npm run typecheck` | conforme | sin errores |
| Q2 | `npm test` | conforme | 230/230 |
| Q3 | `npm run check:dist` | conforme | «dist/ and plugin/dist/ match a fresh build» (incluye la versión única 1.0.0) |
| Q4 | `npm run test:e2e` | conforme | 68/68 |
| Q5 | `claude plugin validate .` | conforme | «Validation passed» (paso 1b del guion) |
| Q6 | `npm run test:docker` | **bloqueado** | Docker Desktop parado (`dockerDesktopLinuxEngine` no existe): 0/5. No se arrancó porque es configuración del equipo del usuario. Pendiente desde WAY-24. |
| Q7 | `npm pack --dry-run` y `npm publish --dry-run` | conforme | 10 archivos, 464,8 kB: `dist/` (bundle, web y avisos de terceros), los dos README, CHANGELOG, LICENSE y package.json. El paquete se llama `@chinorris/wayfinder` y `publish` va a registry.npmjs.org sin opciones extra (ver ERRORES.md, 2026-11-26). |

### Recorrido de la versión (`npm run test:acceptance`)

| Paso | Comprobación | Resultado | Evidencia |
|---|---|---|---|
| 1 | Instalación limpia del plugin con el comando del README, en un perfil vacío | conforme | `claude plugin install wayfinder --marketplace <repo>`: exit 0; `plugin list` y `--version` dan 1.0.0; desinstalación exit 0 |
| 1b | `claude plugin validate` | conforme | «Validation passed» |
| 2 | Actualización desde 0.1.0 con datos de prueba | conforme | «Plugin "wayfinder" updated from 0.1.0 to 1.0.0»; conserva `language` y `home`; la actualización no escribe en los datos; la 1.0.0 lee la tarea, el historial y el error de la 0.1.0 y escribe; `git status` limpio |
| 2b | Carpeta sin marca `FORMAT` (anterior a la marca) | conforme | sin aviso en SessionStart, `wf_list` ni `/api/projects`; mismo HEAD y `git status` limpio |
| 2c | Marca `FORMAT` a 2 | conforme | aviso en SessionStart, en `wf_list` y en `/api/projects`; `wf_create` rechazado; POST de la web 409; HEAD sin cambios |
| 2d | Tarea con un estado desconocido | conforme | `wf_get` muestra `waiting`; `wf_set_status` y `wf_log` rechazados; la web la lista; archivo sin cambios |
| 3.1 | Primer uso en un repositorio sin registrar | conforme | SessionStart: «este repositorio no está registrado…» |
| 3.2 | Registrar con «registra este proyecto» | conforme | sin la orden: «No se ha registrado nada…»; con ella: «Proyecto «demo» registrado con prefijo DEM.» |
| 3.3 | Crear tareas con etiquetas y filtrar | conforme | `wf_list` con `tag: datos` devuelve solo DEM-1 y DEM-3 |
| 3.4 | Aprobar por chat varios IDs en una orden | conforme | sin orden, rechazado; con «aprueba DEM-1, DEM-3 y DEM-4», las tres pasan a `todo` con `approvedVia: chat` |
| 3.5 | Aprobar desde la web | conforme | POST approve con la clave → 200 y `approvedVia: web`; sin la clave → 401 |
| 3.6 | Dependencias | conforme | «Aviso: DEM-3 depende de tareas que aún no están hechas: DEM-1 [todo].» |
| 3.7 | Hook Stop | conforme | sin avance del día, `decision: block`; tras `wf_log`, no bloquea |
| 3.8 | Bloqueo con motivo | conforme | `wf_get` muestra el motivo; SessionStart: `- DEM-3 [in-progress] (medium) [bloqueada] …` |
| 3.9 | Errores y aviso de PostToolUseFailure | conforme | crear, listar, resolver y descartar; el hook recuerda `wf_error` tras `npm test` con exit 1 |
| 3.10 | Historial y búsqueda | conforme | `wf_history` y `wf_search` encuentran el avance |
| 3.11 | Reabrir con conflicto | conforme | con versión antigua, 409 «La tarea DEM-4 cambió mientras la editabas…»; con la actual, 200 y `todo`. El 409 dentro del diálogo lo cubre `e2e/write.spec.ts` («a task changed meanwhile answers 409 inside the dialog») |
| 3.12 | `wf_web` en red con el 4747 ocupado (ERR-4) | conforme | se abre en otro puerto con el aviso que nombra los dos puertos (red simulada con `webHost` = 127.0.0.2) |
| 4 | Web en PC (1440 px) y en móvil emulado (390 px, táctil) | conforme | tablero visible, sin errores de consola y sin desbordamiento horizontal |
| 5 | Paquete npm | conforme | `check:dist` y `npm pack --ignore-scripts` (sin reconstruir el `plugin/dist/` versionado) → `chinorris-wayfinder-1.0.0.tgz`, instalado con `npm install -g` en un prefijo temporal: `wayfinder --version` 1.0.0, `init` crea la carpeta con `FORMAT`, la desinstalación quita el binario |
| 6 | Aislamiento | conforme | mismo HEAD de `~/.wayfinder` y mismo `installed_plugins.json` |

### Pasos manuales

| Paso | Comprobación | Resultado | Motivo |
|---|---|---|---|
| M1 | Sesión interactiva real de Claude Code con el plugin: que el modelo siga el contexto, registre avances y respete las órdenes | **bloqueado** | El perfil aislado no tiene credenciales y no se usó el perfil real del usuario. Los hooks y las herramientas sí se ejecutaron con el JSON real (pasos 3.x). |
| M2 | Web en un móvil real por la red (wifi o Tailscale) y regla del cortafuegos | **bloqueado** | Solo se probó la emulación de Chromium y la red simulada en 127.0.0.2. |
| M3 | Instalación y actualización desde GitHub con la etiqueta `v1.0.0` | **bloqueado** | Requiere publicar (fusionar en `main` y etiquetar). Pendiente de WAY-31, tras la orden del usuario. |

Desviaciones abiertas: ninguna. Bloqueados: Q6, M1, M2 y M3. Durante la preparación apareció un único fallo, el registro del scope en el `~/.npmrc` de este PC, registrado en ERRORES.md (2026-11-26); no afecta al producto.
## Criterios de aceptación de los planes

Los planes de `Planes/` tienen marcados (`- [x]`, con una línea «Evidencia (WAY-30, 2026-11-26)») solo los criterios que demuestran estas pruebas: `npm test`, `npm run test:e2e`, el guion y la lectura del código y los README. Los que siguen sin marcar no se pudieron comprobar o no se cumplen tal como están escritos. En total, 148 de 245.

| Plan | Marcados |
|---|---|
| 2026-10-21-wayfinder-mvp | 22 de 52 |
| 2026-10-22-bitacora-enlazada-e-historial | 8 de 10 |
| 2026-10-23-registro-de-errores | 9 de 15 |
| 2026-11-11-instalacion-web-remota-y-alta-guiada | 10 de 16 |
| 2026-11-13-aviso-de-fallo-de-compilacion-o-pruebas | 5 de 6 |
| 2026-11-13-etiquetas-en-las-tareas | 8 de 8 |
| 2026-11-13-filtros-de-prioridad-y-texto-en-wf-list | 4 de 4 |
| 2026-11-13-listar-errores-con-filtros | 9 de 9 |
| 2026-11-13-reasignar-la-tarea-de-un-error | 6 de 6 |
| 2026-11-13-tipos-y-descarte-de-errores-y-reapertura-de-tareas | 15 de 19 |
| 2026-11-13-varios-ids-dependencias-y-varias-tareas | 8 de 9 |
| 2026-11-16-bloqueo-de-tareas-con-motivo | 12 de 14 |
| 2026-11-16-listados-sin-git-por-tarea | 4 de 7 |
| 2026-11-16-version-del-formato-de-datos | 11 de 12 |
| 2026-11-17-version-unica-y-changelog | 5 de 9 |
| 2026-11-25-documentacion-1-0-bilingue | 5 de 8 |
| 2026-11-25-ordenes-de-turnos-automaticos-y-clave-de-la-web | 3 de 9 |
| 2026-11-25-ordenes-de-turnos-automaticos-y-clave-de-la-web-v2 | 4 de 7 |

Motivos de los criterios sin marcar:

- **Necesitan lo que está bloqueado:** sesión real con el modelo (M1), Docker (Q6), un móvil o una red real (M2), publicar (M3), y lector de pantalla u otros navegadores.
- **Les falta una prueba que cubra el texto exacto:** por ejemplo, el aviso al 80 % del historial, el teclado en algunos diálogos, la mediana de tiempos de `wf_list` y del hook, o los tipos raros de `blocked`.
- **El texto ya no describe el producto, y hay que corregir el plan, no el código:**
  - «abre la web» pasó a ser «abre Wayfinder».
  - La herramienta `wf_web` devuelve el enlace con la clave para otros dispositivos.
  - El número de herramientas MCP ya no es 11 ni 12.
  - La ruta de reabrir responde 401 sin clave, no 403.
  - `npm pack` incluye ahora también `README.es.md` y `CHANGELOG.md`.
  - El plan v1 de órdenes queda sustituido por el v2.
- **No se cumplen hoy:**
  - Una tarea programada real todavía no se distingue de un mensaje de la persona; es un límite documentado en el README y en el CHANGELOG (plan v2 de órdenes).
  - «Ningún texto promete publicación en npm» (plan de documentación): la 1.0.0 cambia esa decisión, y el README dice que el paquete está en npm. Es cierto solo una vez publicado, así que `npm publish` debe ir justo después de fusionar.
