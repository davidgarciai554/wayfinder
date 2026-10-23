# Plan: Registro de errores en el almacén de Wayfinder (consulta antes de investigar)

> Estado: Aprobado por el usuario el 2026-10-23 («1 a / apruebo la tarea y el plan», en respuesta a la presentación de este archivo v1). Pregunta de datos personales resuelta: opción (a).
> Versión: v1 (2026-10-23)
> Complementa a: `Planes/2026-10-21-wayfinder-mvp.md` v3 y `Planes/2026-10-22-bitacora-enlazada-e-historial.md` v2 (ambos aprobados). Los contratos afectados están en «Contratos que se modifican». Aprobar este plan no reescribe esos planes: los complementa con una desviación material identificada.
> Tarea Wayfinder: WAY-4 (proposed).
> Origen: mesa redonda de solo lectura (analista, idealista, negador, representante funcional, técnico de solución mínima, calidad, seguridad y datos, accesibilidad, mediador). Las aportaciones están en el historial de esta sesión.

## Contexto y objetivo

- **Problema u oportunidad:** `AGENTS.md` pide consultar `ERRORES.md` antes de investigar un fallo y registrar cada error relevante. Hoy ese registro es un archivo de texto del repositorio. No se enlaza con las tareas de Wayfinder ni se busca desde las herramientas de Claude. Una sesión nueva no se entera de qué falló antes, ni de en qué tarea, ni de si sigue abierto.
- **Petición del usuario (2026-10-23):** un registro de errores equivalente al de `AGENTS.md`, guardado en el almacén de Wayfinder.
  1. Un archivo por error, con ID propio. Campos: fecha y contexto, reproducción, salida observada (sin secretos), causa confirmada o hipótesis etiquetada, solución o investigación, archivos modificados, validación y resultado. Estado abierto o resuelto.
  2. El error indica su tarea. La tarea muestra la lista de sus errores. El error enlaza a la tarea.
  3. Herramienta MCP para crear y actualizar errores. Las recurrencias son una nota en el error existente. `wf_search` incluye errores y la skill pide buscarlos antes de investigar. SessionStart lista los errores abiertos.
  4. Web: página «Errores» con lista de abiertos y resueltos y detalle, enlaces tarea ↔ error, solo lectura.
- **Resultado esperado:**
  1. `wf_error` crea, actualiza, anota y resuelve errores en `projects/<slug>/errors/ERR-n-<slug>.md`, en un solo commit por escritura.
  2. `wf_search` devuelve errores marcados (`kind: 'error'`) con cupo propio. `wf_get` muestra un error por su ID y, en una tarea, la lista de sus errores.
  3. SessionStart añade, si cabe, un bloque breve de errores abiertos.
  4. La web tiene la pestaña «Errores» y el detalle de cada error. Desde la tarea se llega al error. Atrás vuelve a la tarea. Cerrar la tarea abierta desde un error devuelve al error.
- **Evidencia del sistema actual (hechos comprobados por el analista, con referencia):**
  - Cada proyecto es `projects/<slug>/{PROJECT.md, tasks/, log/, assets/}` (`src/store/project.ts:79`). `writeFileAtomic` crea los directorios (`src/store/sync.ts:15`), así que `errors/` puede crearse perezosamente, sin migración.
  - `ID_RE = /^[A-Z]{2,6}-[1-9]\d{0,8}$/` (`src/store/paths.ts:6-8`). El prefijo de un proyecto es libre (2 a 6 mayúsculas) y solo único entre proyectos (`project.ts:65-72`). Un prefijo fijo de errores puede chocar con el de un proyecto. En el almacén real (`~/.wayfinder`) los proyectos usan WAY y DEM; ninguno usa ERR.
  - El contador de tareas es max+1 sobre los nombres de `tasks/`, bajo lock (`tasks.ts:171-181`). El nombre es `<ID>-<slug>.md` y `readTask` busca `${id}.md` o `${id}-` (`tasks.ts:118,218`).
  - El frontmatter conserva claves desconocidas (`tasks.ts:46-52,153-169`). `parseFrontmatter` y `serializeFrontmatter` son reutilizables (`frontmatter.ts:9-33`).
  - `history.ts` reserva `## Historial`, escapa `#` como `\#`, limita a `MAX_HISTORY = 100_000` y avisa al 80 % (`history.ts:8-13,78-99`). `splitBody`, `joinBody`, `parseEntries`, `formatEntry` y `appendEntry` no dependen de `Task`.
  - Límites actuales: `MAX_TITLE` 200, `MAX_BODY` 20 000, `MAX_LOG_ENTRY` 4000 (`tasks.ts:60-62`, `log.ts:10`).
  - `findSecrets` es heurístico, con 8 patrones (`secrets.ts:2-16`). `assertNoSecrets` rechaza (`log.ts:12-15`). `commitPaths` re-escanea y, si detecta un secreto, deja el archivo escrito sin commit y avisa (`git.ts:77-94`).
  - Hay un commit por escritura, con mensaje `wf: <acción> <ID>` (`git.ts:12`, `check-dist.mjs:44-56`). `withLock` es un mkdir atómico y en Windows EPERM, EBUSY y EACCES cuentan como contención (`sync.ts:33-74`). `safeJoin` es obligatorio (`paths.ts:51-68`).
  - MCP: 11 herramientas (`src/mcp.ts:97-367`), con un test de lista exacta (`test/mcp.integration.test.ts:75-76`). Hay bloques `UNTRUSTED` y `neutralize` (`mcp.ts:32-38,284-289`, `text.ts:12-15`). `wf_get` devuelve metadatos, la descripción en `UNTRUSTED` y las 3 últimas entradas (800 c cada una).
  - `wf_search` es literal, de 2 a 100 caracteres, con `limit` ≤ 20, bitácora primero y tareas después, presupuesto de 2 MB y salida `UNTRUSTED` ≤ 4000. `SearchHit.kind` es `'history'|'task'|'log'` (`memory.ts:14,86-128`, `mcp.ts:327-349`).
  - `sessionContext(lang, slug, tasks)` limita a `MAX_CONTEXT` 4000 y emite metadatos más un bloque de historial «solo si cabe» (1200 c, 2 tareas) (`hook.ts:22-25,67-92,185-186`). Tests en `test/hook.test.ts:32,45,174,195-205`.
  - Los estados de tarea (`transitions.ts:3-32`) no encajan con abierto y resuelto. Reutilizar `tasks/` obligaría a filtrar en todos los lectores (`mcp.ts:144`, `hook.ts:185,199`, `server.ts:149,164,200`, `memory.ts:114`).
  - Web: `PAGES = ['board','task','log','assets','project']` y pestañas fijas (`web/app.js:127-134,153-157`). El detalle de tarea es un `<dialog>` modal (`app.js:455-503`). Los datos van con `textContent` y `innerHTML` solo para HTML saneado por el servidor. La API de lectura es GET por proyecto (`server.ts:139-204`). Las escrituras web son solo POST de tareas con clave y CSRF. SSE con `fs.watch` recursivo sobre `projects/` da refresco gratis (`server.ts:336-375`). `markdown-it` va con `html:false` y `SAFE_LINK` admite `#…` (`markdown.ts:3-45`). `NOT_FOUND_KEYS` produce 404 (`server.ts:71-73`).
  - i18n es/en con las mismas claves (`test/i18n.test.ts`). La web filtra `web.` y `status.` (`server.ts:142`).
  - `docs/design/DESIGN.md` (aprobado) fija las pestañas Tablero · Bitácora · Capturas · Proyecto (l.44), las rutas en inglés (l.45) y la exclusión de la búsqueda web (l.15). Define estados por flujo (l.121-134) y accesibilidad (l.136-154).
  - Comandos reales: `npm run typecheck`, `npm test` (con `pretest` de build), `npm run build`, `npm run check:dist`, `npm run test:e2e` (Playwright, 1 worker, fixtures es/en con reloj fijo en `e2e/fixture-server.ts`). `plugin/dist/` está versionado.
  - `ERRORES.md` documenta: reloj fijo en TODA escritura de fixtures; el tope 4000 de SessionStart ya falló una vez; EPERM intermitente en el lock; `replaceChildren(null)` pintaba «null»; los hooks deben usar `hookEnv`.

## Decisiones del usuario

Ronda 1 (2026-10-23):
1. Un archivo por error, con ID propio y los campos indicados. Estado abierto o resuelto.
2. El error indica su tarea; la tarea lista sus errores; el error enlaza a la tarea.
3. Herramienta MCP para crear y actualizar. La recurrencia es una nota en el error existente. `wf_search` incluye errores, la skill pide buscarlos antes de investigar y SessionStart lista los abiertos.
4. Página web «Errores» (abiertos y resueltos, detalle, enlaces tarea ↔ error), solo lectura.

Ronda 2 (2026-10-23):
- **ID:** `ERR-n` con validador propio. El prefijo `ERR` se reserva para proyectos nuevos.
- **`task_id`:** obligatorio y existente.
- **Secretos:** rechazar. Si el escaneo del commit detecta algo en un error recién creado, se borra el archivo.
- **Web:** pestaña «Errores»; detalle en página propia `#/<slug>/errors/<ID>`. Desde la tarea se va al error y Atrás vuelve a la tarea. Cerrar la tarea abierta desde un error devuelve al error.

## Alcance

- **Incluido:**
  - Módulo de almacén `src/store/error-records.ts`, carpeta `errors/` perezosa por proyecto, sin tocar `tasks/` ni el archivo de la tarea.
  - Herramienta MCP `wf_error` (`create|update|note|resolve`). `wf_get` acepta IDs `ERR-n` y, en una tarea, añade sus errores.
  - `wf_search` con `kind: 'error'` y cupo propio.
  - Bloque «Errores abiertos» en SessionStart, línea en la skill, i18n es/en.
  - Dos GET nuevos en la API (lista y detalle) y el campo `errors` en la respuesta de tarea.
  - Pestaña y páginas web, sección «Errores» en el modal de tarea, `DESIGN.md`, README, `plugin/dist/`.
  - Tests unitarios, MCP, hook, servidor y e2e.
- **Excluido:**
  - Migrar el `ERRORES.md` actual del repositorio y cambiar `AGENTS.md`. El registro de Wayfinder empieza vacío.
  - Edición, creación o cambio de estado desde la web. Sin POST ni CSRF nuevos.
  - Búsqueda en la web (`DESIGN.md:15` la excluye).
  - Detección automática de errores por hooks. Cambios en el hook Stop o en `pre-tool`.
  - Coincidencia difusa, hash o deduplicación automática. Severidades, etiquetas, adjuntos, notificaciones.
  - Índice persistente. Una acción `list` (ver la decisión de `wf_error`).
  - Commit o push del repositorio fuente y operaciones sensibles (autorización aparte).
- **Supuestos y restricciones:**
  - Un commit por escritura; sin dependencias nuevas; Windows como objetivo verificado.
  - `npm run build` y `npm run check:dist` tras tocar `src/` o `web/`.
  - Tests con reloj fijo en TODA escritura de fixtures y `WAYFINDER_HOME` temporal; nunca el `~/.wayfinder` real sin acuerdo previo.
  - `findSecrets` es heurístico, no garantía.
  - El texto de los errores es dato no confiable.

## Diseño

### Formato del archivo `projects/<slug>/errors/ERR-n-<slug-título>.md`

```
---
id: ERR-3
title: <≤200>
status: open            # open | resolved
task: WAY-4             # obligatorio; la tarea existe al crear
cause_kind: hypothesis  # hypothesis | confirmed
files: [src/store/sync.ts, test/concurrency.test.ts]
created: 2026-10-23 10:02
updated: 2026-10-23 10:40
---

## Contexto
## Reproducción
## Salida observada
## Causa
## Solución
## Validación
## Resultado

## Historial
### 2026-10-23 10:40
Recurrencia: …
```

- **Etiquetas fijas en español**, como el marcador `## Historial` ya vigente. La web las traduce al mostrar (clave i18n `web.error.field.*`). Se descartó guardarlas según el idioma de sesión, porque el parseo dependería del idioma.
- **IDs:** validador propio `ERROR_ID_RE = /^ERR-[1-9]\d{0,8}$/`, fuera de `ID_RE` y de los lectores de tareas. Contador max+1 sobre `errors/` bajo `withLock`. La búsqueda por ID usa `${id}.md` o `${id}-`, para que `ERR-1` no coincida con `ERR-10`.
- **Texto de los campos:** toda línea que empiece por `#` se escribe escapada (`\#`), con el mecanismo de `history.ts`. Ningún campo puede fabricar una cabecera.
- **Campos editables:** Causa (con `cause_kind`), Solución, Validación, Resultado y `files`. **Inmutables:** `id`, `task`, `created`, título, Contexto, Reproducción y Salida observada. Para corregir algo inmutable se usa `note`. Cada `update` deja una entrada de Historial con los nombres de los campos cambiados, para que haya traza.
- **Estado:** solo cambia con una acción explícita, nunca por efecto lateral.
  - `resolve` exige que Solución y Validación existan y no estén vacías, en el error o en la propia llamada. Resolver un error ya resuelto no escribe y devuelve un aviso.
  - **Reabrir está permitido** con `update` y `reopen: true`, que exige `note` (motivo). Deja entrada de Historial.
  - El estado de la tarea (`done`, `discarded`) no influye: el error sigue visible.
- **`files`:** lista de rutas relativas, normalizadas, sin `..`, sin ruta absoluta, sin letra de unidad ni UNC. Máximo 20 rutas de 200 caracteres. Se muestran siempre como texto.
- **Topes** (rechazar, nunca truncar): título 200; cada campo 4000; Salida observada 8000; suma de campos 20 000; Historial 100 000 con aviso al 80 %; cada nota ≤ 4000 (`MAX_LOG_ENTRY`).
- **Secretos:**
  1. `assertNoSecrets` sobre cada campo y cada nota.
  2. Escaneo del documento final completo, incluido el frontmatter, antes de `writeFileAtomic`.
  3. Si `commitPaths` detecta un secreto pese a todo, en `create` se borra el archivo recién creado y en `update` o `note` se restaura el contenido previo, que se tiene en memoria. Se informa con tipo de patrón, sin reproducir el valor.

### Herramienta MCP `wf_error` (11 → 12)

```ts
z.object({
  action: z.enum(['create','update','note','resolve']),
  id: z.string().optional(),            // ERR-n; obligatorio salvo en create
  title: z.string().max(200).optional(),
  task_id: z.string().optional(),       // obligatorio en create
  context, reproduction, output, cause, solution, validation, result,  // z.string().max(4000) (output 8000)
  cause_kind: z.enum(['hypothesis','confirmed']).optional(),  // por defecto hypothesis en create
  files: z.array(z.string()).max(20).optional(),
  note: z.string().max(4000).optional(),
  reopen: z.boolean().optional(),
  project,
})
```

- `create`: exige `title`, `task_id` existente (`readTask`) y `context`. Error claro y sin escribir si falta algo o la tarea no existe. Commit `wf: error create ERR-n`.
- **Posibles duplicados:** la respuesta de `create` lista hasta 3 errores abiertos cuyo título o salida contengan, de forma literal y sin distinguir mayúsculas, el título nuevo o la primera línea de la salida nueva (≥ 8 caracteres). Es solo un aviso con ID y título y nunca bloquea la creación. Así la recurrencia se dirige a `note`.
- `note`: añade una entrada fechada al Historial del error existente (recurrencia, contexto nuevo, corrección de un campo inmutable). No cambia el estado.
- `update`: edita campos editables y registra la entrada de Historial. `resolve`: ver arriba.
- Salidas con texto libre dentro de `UNTRUSTED` con `neutralize`; la confirmación solo lleva ID y estado.
- Sin acción `get` ni `list`: ver la tabla de decisiones.

### Lectura

- **`wf_get <ERR-n>`:** el servidor enruta por el prefijo reservado `ERR`. Devuelve metadatos y los campos en un bloque `UNTRUSTED`, con las 3 últimas entradas del Historial (≤ 800 c cada una). La tarea enlazada va como ID.
- **`wf_get <tarea>`:** añade un bloque `UNTRUSTED ERRORS` con hasta 10 líneas `ERR-n (open|resolved) título≤80`, calculadas al leer, y «+N más» si sobran. Sin errores no añade nada.
- **`wf_search`:**
  - Los errores se escanean primero, con tope de 5 resultados, que cuentan dentro de `limit`. El resto del cupo y el orden actual (bitácora, tareas) no cambian.
  - Se busca en título, campos y notas. Cada resultado indica `error`, ID, estado y un fragmento aplanado de ≤ 200 caracteres, nunca la salida completa.
  - Comparten el presupuesto de 2 MB y la salida `UNTRUSTED` ≤ 4000.
  - Un proyecto sin `errors/` se comporta exactamente como hoy.

### SessionStart

- Tras los metadatos y el bloque de historial, solo si cabe en 4000 sin recortar nada anterior: cabecera fija (i18n `hook.session.errors`) y hasta 5 errores abiertos, de más a menos recientemente actualizado, uno por línea `- ERR-2 (WAY-4) título≤80`. Se añade «+N más» si sobran.
- El bloque tiene un tope propio de 600 caracteres. Pasa por `flatten()` y `neutralize()`. Nunca incluye salida, causa ni ningún campo de texto libre, solo ID, tarea y título.
- Sin errores abiertos, el contexto es byte a byte igual que hoy. Un fallo de lectura se omite sin romper el hook.
- `sessionContext` gana un parámetro opcional para los errores. Stop y `pre-tool` no cambian.

### Web (solo lectura)

- **API:** `GET /api/projects/:slug/errors` (lista) y `GET /api/projects/:slug/errors/:id` (detalle, con los campos renderizados con el `md` saneado existente). El detalle valida el ID con `ERROR_ID_RE`; un ID malformado o inexistente da 404 mediante `NOT_FOUND_KEYS`. La respuesta de tarea añade `errors: [{ id, title, status }]`. No hay endpoints de escritura. (El prefijo exacto de las rutas se confirma contra `server.ts:139-204` en el incremento 4.)
- **Pestaña «Errores»:** quinta pestaña, ruta `#/<slug>/errors`. Contiene `h1` «Errores», `h2` «Abiertos (n)» y `h2` «Resueltos (n)». Cada ítem es un `<li>` con el ID en monoespaciada, el título como único enlace, la fecha en `<time>` y la tarea. Los resueltos muestran 10 y un botón «Ver todos» que devuelve el foco con `data-focus`.
- **Estado en texto:** `.pill` más `warningIcon` con `aria-hidden` en abiertos. Tokens existentes `--wf-flag-risk-*` (abierto) y `--wf-status-done-*` (resuelto); sin colores nuevos.
- **Detalle:** ruta `#/<slug>/errors/<ID>`. `h1` con el título y foco en él (`tabindex=-1`). Enlace «Volver a Errores». Metadatos en `dl`. Un `h2` por campo con la etiqueta traducida y «Sin dato» si está vacío. La salida observada va en `<pre>` con `overflow-x:auto` y `tabindex=0`. Las notas del Historial se muestran como `article` con `h3` y `<time>`. Todo texto del servidor va por `textContent` o por HTML saneado.
- **Retorno:**
  - Modal de tarea: nueva sección `h2` «Errores (n)» tras el Historial. Cada fila lleva ID, título y estado en texto. Sin errores muestra «Esta tarea no tiene errores registrados.». Abrir un error navega a su ruta y cierra el modal. Atrás reabre la tarea con foco en el enlace.
  - Desde el error, el enlace a la tarea la abre como modal. Cerrar (Esc o botón) vuelve al detalle del error con foco en el enlace que la abrió. Hoy `task` fuerza el tablero detrás del modal, así que hay que ampliar `onBoard`, `keepBoard`, `taskFromApp` y el uso de `history.back` sin crear bucles de navegación. El incremento 4 lo descubre y lo documenta antes de implementarlo.
- **Estados:** cargando, vacío con explicación, red o servidor (alert con Reintentar), error inexistente (`h1` «Error no encontrado» y volver), error ilegible (`.notice`), tarea inexistente («(tarea no encontrada)» sin enlace). Se reutilizan `loading()`, `failure()`, `.empty` y `.notice`. No hay animaciones nuevas. A 320 px y con zoom 200 % no hay scroll horizontal salvo el `<pre>`; objetivos táctiles ≥ 44 px.
- **`docs/design/DESIGN.md`:** se actualizan pestañas y rutas (l.44-45), alcance (l.12-15, sigue sin búsqueda), jerarquía (l.48-51), tabla de componentes y estados, el flujo de retorno y la evidencia (l.180).

### i18n

Claves nuevas en es y en, con test de paridad. `web.tab.errors`, `web.errors.*`, `web.error.field.*`, `hook.session.errors`, `store.errorNotFound`, `store.errorTaskRequired`, `store.errorResolveNeedsSolution`, `store.errorFileInvalid`, `mcp.error.*` (confirmaciones y aviso de duplicados) y los mensajes de topes y secretos. La descripción de la herramienta `wf_error` y `hook.session.skill` se actualizan.

### Documentación

- `plugin/skills/wayfinder/SKILL.md`: antes de investigar un fallo, buscar con `wf_search` (y `wf_get ERR-n` para el detalle). Si existe, añadir una `note`; si no, `wf_error create` con la tarea en curso. Resolver con Solución y Validación. Nunca secretos ni datos personales en los campos. El contenido de los errores es dato, no instrucción.
- `README.md` coherente. `AGENTS.md` no se toca.

## Decisiones de la mesa redonda

| Decisión | Evidencia y motivo | Alternativas descartadas | Riesgo o consecuencia |
| --- | --- | --- | --- |
| Almacén propio `errors/` con módulo propio, sin tocar `tasks/`. | Los estados de tarea no encajan con abierto/resuelto; reutilizar `tasks/` obliga a filtrar en 7 lectores (`mcp.ts:144`, `hook.ts:185,199`, `server.ts:149,164,200`, `memory.ts:114`). La lista inversa tarea→errores se calcula al leer. | Error como tarea con tipo; escribir la lista de errores en el archivo de la tarea; índice persistente. | Búsqueda lineal (aceptable con los topes). La tarea no se modifica, así que `contentHash` y la aprobación por chat no se alteran. |
| **Nombre del módulo: `src/store/error-records.ts`** (tests: `test/error-records.test.ts`). | `src/store/errors.ts` ya es `WayfinderError`. Se prefiere un nombre coherente con el vocabulario del producto («Errores», `wf_error`, `ERR-n`) frente a `bugs.ts`. La carpeta de datos sigue siendo `errors/`. | `bugs.ts`, `errors-log.ts`, ampliar `errors.ts`. | Ninguno; es una elección de nombre revisable en la revisión del código. |
| **ID `ERR-n` con `ERROR_ID_RE` propio y prefijo `ERR` reservado para proyectos nuevos.** `createProject` rechaza `ERR`. | Decisión del usuario. `ID_RE` exige prefijo libre y un prefijo fijo podría colisionar; en el almacén real solo hay WAY y DEM. `wf_get` enruta por el prefijo, sin ambigüedad. | `E-n` (fuera de `ID_RE`); reutilizar `ID_RE`; permitir ERR y desambiguar por proyecto. | Un proyecto existente con prefijo ERR (hoy ninguno) quedaría ambiguo; la reserva solo rige para proyectos nuevos y el test del paso 1 comprueba el rechazo. Cambio de contrato de `createProject`. |
| **Etiquetas guardadas fijas en español**, como `## Historial`; la web las traduce. | Mantiene el parseo independiente del idioma de sesión. Hay precedente en el marcador `## Historial` (plan de bitácora, «datos sin traducir»). | Etiquetas por idioma de sesión; claves en inglés guardadas. | El archivo crudo se lee en español aunque la sesión sea en inglés; la web y las herramientas muestran etiquetas traducidas. |
| **`wf_error` con 4 acciones: `create|update|note|resolve`.** Sin `get` ni `list`. | La lectura ya existe: `wf_search` localiza, `wf_get ERR-n` da el detalle, `wf_get <tarea>` lista sus errores y SessionStart enseña los abiertos. Evita duplicar rutas de lectura y superficie `UNTRUSTED`. | Seis acciones con `get`/`list` (técnico); herramientas separadas por acción; solo `create|update|note`. | No hay un listado completo de todos los errores del proyecto desde MCP; está en la web. Si la práctica lo exige, `list` se añadiría después (condición: Claude necesita enumerar sin término de búsqueda). `resolve` es acción propia porque lleva un invariante (solución y validación). |
| **Campos editables y reabrir.** Editables: causa (con tipo), solución, validación, resultado, archivos. Inmutables: id, tarea, fecha, título, contexto, reproducción, salida. Reabrir permitido con `update` + `reopen` + `note` obligatoria. | El registro actual documenta hipótesis que pasan a confirmadas; contexto y reproducción son el hecho observado. La trazabilidad exige que cada cambio deje entrada de Historial. Evita una máquina de estados (campo de 2 valores). | Todo editable; nada editable; reabrir solo por nota o con un error nuevo; estados intermedios. | Un error mal descrito se corrige con `note`, no se reescribe. |
| **`resolve` exige Solución y Validación no vacías.** | Equivale al criterio de `AGENTS.md`: «verifica la solución y deja la evidencia». El técnico pedía solo Resultado; Calidad y Seguridad pidieron Solución y Validación, que son las que definen el cierre. | Resolver sin condiciones; exigir también Resultado. | Resolver con una validación pobre sigue siendo posible; solo se garantiza que exista. |
| **Topes:** título 200, campo 4000, salida 8000, suma 20 000, Historial 100 000, nota 4000. Rechazar, no truncar. | Alinean con `MAX_TITLE`, `MAX_LOG_ENTRY`, `MAX_BODY` y `MAX_HISTORY`. Las trazas largas se resumen. | Truncar en silencio; sin tope por campo. | Una traza muy larga se rechaza y hay que resumirla. |
| **`files` como lista de rutas relativas validadas** (≤ 20 × 200, sin `..`, sin absolutas, unidad ni UNC), en el frontmatter. | Seguridad: evita rutas absolutas con nombre de usuario y escapes. La lista estructurada se valida mejor que un campo de texto. | Texto libre; sección en el cuerpo. | Rutas relativas pueden seguir conteniendo datos personales (ver pregunta abierta). |
| **Secretos: rechazar en cada campo, escanear el documento final antes de escribir y deshacer si `commitPaths` detecta.** | Decisión del usuario. `commitPaths` deja el archivo sin commit (`git.ts:77-94`) y la web, `wf_get` y `wf_search` lo leerían. Borrar (create) o restaurar (update/note) evita que el secreto quede visible. | Redactar el secreto (cambia el significado de la salida y no elimina falsos negativos); aceptar el archivo sin commit. | `findSecrets` es heurístico. Falsos positivos (`password-assignment`): el mensaje dice qué patrón saltó para que se reescriba. Falsos negativos (JWT, Slack, Stripe, Google, Basic, .env) siguen siendo posibles y se documentan. |
| **`wf_search` con cupo de errores:** hasta 5, escaneados primero y dentro de `limit`; snippets ≤ 200; salida ≤ 4000 `UNTRUSTED`. | El objetivo es consultar antes de investigar. Sin cupo, 20 resultados de bitácora podrían tapar los errores. No se devuelve la salida completa. | Errores al final (técnico); sin cupo. | Los tests existentes no cambian (proyectos sin errores). Errores de más de 5 coincidencias requieren afinar la consulta. |
| **Bloque SessionStart:** 5 errores abiertos, ≤ 600 caracteres, solo si cabe, solo ID, tarea y título aplanado; nunca salida ni causa. | El tope 4000 ya falló una vez (`ERRORES.md`). La salida y la causa son texto libre de mayor riesgo de inyección. | Incluir causa o resumen; bloque sin tope propio; mostrar resueltos. | Un contexto casi lleno omite el bloque. Los tests lo cubren (≤ 4000 siempre). |
| **La creación devuelve posibles duplicados abiertos** (≤ 3, coincidencia literal) en la respuesta. | Recurrencia: la búsqueda literal no evita duplicados por sí sola. Sin fuzzy ni hash, que cuestan complejidad con poco valor demostrado. | Bloquear la creación; fuzzy o hash; deduplicar automáticamente. | Si el texto difiere, se crea un duplicado; `note` sigue siendo el camino recomendado en la skill. |
| **Web: pestaña «Errores» y detalle en página propia**; resueltos 10 + «Ver todos»; sección «Errores (n)» en el modal de tarea. | Decisión del usuario. La página propia tiene URL compartible y no apila modales. Cambia una decisión de `DESIGN.md` (pestañas), que se actualiza dentro de este plan. | Detalle en `<dialog>`; errores solo dentro de la tarea; lista única sin agrupar. | Más trabajo de enrutado en `app.js` por el retorno desde la tarea. |
| **Retorno del modal de tarea al error** (Esc o Cerrar devuelve al detalle con foco en el enlace). | Requisito del usuario. Hoy `task` fuerza el tablero detrás (`app.js:455-503`, `onBoard/keepBoard/taskFromApp`). | Cerrar siempre al tablero. | Es el punto de mayor riesgo de regresión del tablero; se cubre con e2e dirigido. |
| **e2e en proyecto aislado con reloj fijo.** | `e2e/read.spec.ts` cuenta tareas y proyectos; un proyecto aparte no altera esos recuentos. `ERRORES.md` exige reloj fijo en toda escritura de fixtures. | Añadir errores al proyecto existente de la fixture. | La fixture crece; se mantiene mínima. |
| **Sin severidades ni etiquetas; sin migrar `ERRORES.md`.** | No pedidos; el valor está en la búsqueda y en el vínculo con la tarea. | Campo de severidad; importador. | El histórico de `ERRORES.md` sigue donde está, fuera de la memoria de Wayfinder. |

## Contratos que se modifican

- **MCP:** 11 → 12 herramientas (`wf_error`). `wf_get` acepta IDs `ERR-n` y, en una tarea, añade el bloque `ERRORS`. Test de lista exacta actualizado (`test/mcp.integration.test.ts:75-76`).
- **`wf_search`:** `SearchHit.kind` pasa a `'history'|'task'|'log'|'error'` (`memory.ts:14`). Los errores van primero, con cupo de 5. Se ajusta la salida (`mcp.ts:327-349`).
- **`sessionContext`:** nuevo parámetro y bloque «Errores abiertos» (≤ 600 caracteres, solo si cabe); el tope total sigue siendo 4000. Se ajustan `hook.ts:185-186` y `test/hook.test.ts`.
- **`createProject`:** rechaza el prefijo `ERR` (`project.ts:65-72`).
- **Almacén:** nueva carpeta `projects/<slug>/errors/` y nuevo formato de archivo. Los proyectos sin ella se comportan igual.
- **Commits:** nuevo mensaje `wf: error <acción> <ID>`. Sigue siendo un commit por escritura (el incremento 1 comprueba que `check-dist.mjs:44-56` no depende del formato del mensaje).
- **API web:** 2 GET nuevos; la respuesta de tarea gana `errors: [{ id, title, status }]`. Sin cambios de escritura.
- **Web / `DESIGN.md`:** pestañas Tablero · Bitácora · **Errores** · Capturas · Proyecto (la posición exacta se fija en el incremento 4 junto con la rejilla de la barra) y rutas `#/<slug>/errors` y `#/<slug>/errors/<ID>`. La búsqueda web sigue excluida.
- **Skill:** nueva instrucción de buscar antes de investigar.
- **Sin cambios:** hook Stop, `pre-tool` (ya protege `WAYFINDER_HOME`), aprobación por chat y `contentHash`, `wf_review`, transiciones de tarea, archivo de la tarea.

## Preguntas que requieren decisión del usuario

- **Datos personales en rutas y texto libre de los errores.**
  - Impacto: `findSecrets` no detecta rutas con nombre de usuario ni correos (por ejemplo `C:\Users\<nombre>\…` dentro de una salida observada). Se guardarían en `~/.wayfinder` y en su repositorio git local.
  - Opciones conocidas: (a) aceptar el riesgo residual porque el repositorio es local y privado, documentar que el detector es heurístico e instruir en la skill que no se incluyan datos personales (el campo `files` ya rechaza rutas absolutas); (b) añadir un patrón de rutas de usuario y correos a `findSecrets`, lo que afecta también a bitácora e Historial y puede dar falsos positivos.
  - **Recomendación: (a)**, por la solución mínima y porque (b) cambia el comportamiento de otras herramientas ya aprobadas. Se necesita respuesta explícita al aprobar este plan; no se presupone.
  - **Decisión del usuario (2026-10-23): (a).** Se acepta el riesgo residual, se documenta que el detector es heurístico y la skill pide no incluir datos personales.

## Plan de implementación

Cada incremento deja `npm run typecheck` y `npm test` en verde y es revisable por separado. Un cambio en `src/` o `web/` termina con `npm run build` y `npm run check:dist`.

### Incremento 1: almacén de errores

1. `src/store/paths.ts`: `ERROR_ID_RE` y un helper de validación; reutilizar `safeJoin`. `src/store/project.ts`: `createProject` rechaza el prefijo `ERR` (`store.reservedPrefix`).
   - Validación: `test/store.test.ts` (o equivalente): crear proyecto `ERR` falla; un proyecto con otro prefijo no cambia.
2. `src/store/error-records.ts` (nuevo): `createError`, `updateError` (incluye `resolve` y `reopen`), `noteError`, `readError`, `listErrors`, `errorsForTask`, `findDuplicates`. Reutiliza `withLock`, `safeJoin`, `parseFrontmatter`/`serializeFrontmatter`, `history.ts` (`appendEntry` y escape de `#`), `assertNoSecrets`, `commitPaths` y `slugify`. Contador max+1 bajo lock. Validación de `files` y de todos los topes. Escaneo del documento final antes de escribir, y borrado o restauración si `commitPaths` detecta un secreto (se descubre en este paso cómo `commitPaths` comunica el aviso; no se presupone).
   - Validación (`test/error-records.test.ts`, reloj fijo y `WAYFINDER_HOME` temporal):
     - crear escribe archivo y un commit `wf: error create ERR-1`;
     - `ERR-1` frente a `ERR-10` (búsqueda por `${id}-`);
     - contador con concurrencia (procesos) sin colisión;
     - `task_id` inexistente o ausente: error claro y sin escribir;
     - tope exacto OK y +1 falla en título, campo, salida, suma e Historial;
     - `#` y `### 2026-…` en un campo escapados sin crear entradas;
     - `files` con `../`, absoluta, unidad, UNC, exceso de número o longitud rechazados;
     - secreto en cualquier campo, nota o título: rechazo sin escritura; secreto simulado en el commit: create borra, update restaura;
     - `resolve` sin solución o validación falla; resolver dos veces no escribe; reabrir exige nota y la registra;
     - campos inmutables no se pueden cambiar; frontmatter corrupto produce un error legible sin romper el listado;
     - tarea `done` o `discarded`: el error sigue visible; duplicados devueltos en create (máx. 3, solo abiertos);
     - proyecto sin `errors/`: `listErrors` vacío.

### Incremento 2: MCP, búsqueda y `wf_get`

1. `src/mcp.ts`: registrar `wf_error` (`create|update|note|resolve`) con salida neutralizada; `wf_get` enruta `ERR-n` y añade el bloque `ERRORS` en tareas.
2. `src/store/memory.ts`: `SearchHit.kind` + `'error'`; cupo de 5 errores primero; snippets ≤ 200; mismo presupuesto de 2 MB; ajustar el formateo en `mcp.ts:327-349`.
3. `src/i18n` (es y en): mensajes nuevos.
   - Validación (`test/mcp.integration.test.ts`, `test/memory.test.ts` o el archivo que cubra la búsqueda): lista exacta de 12 herramientas (cambio intencionado de `:75-76`); esquema de `wf_error`; create, note y resolve extremo a extremo con el cliente MCP; título o campo con `>>>` no cierra el bloque `UNTRUSTED`; `wf_get ERR-n` y `wf_get` de tarea con 0, 1 y más de 10 errores; `wf_search` con coincidencias de error, vacío, consulta de 2, 100 y 101 caracteres, cupo de 5, orden determinista, salida ≤ 4000 y snippets ≤ 200; los tests actuales de búsqueda sin errores no cambian.

### Incremento 3: SessionStart y skill

1. `src/hook.ts`: `sessionContext` con el parámetro de errores abiertos y el bloque (5 errores, 600 caracteres, «+N más», solo si cabe, `flatten` y `neutralize`); `hook.ts:185-186` lo alimenta.
2. `plugin/skills/wayfinder/SKILL.md`: instrucción de buscar antes de investigar y de registrar con `wf_error`.
   - Validación (`test/hook.test.ts`): sin errores, byte a byte igual al actual; 1, 3 y más de 5 abiertos; resueltos no aparecen; contexto casi lleno omite el bloque y nunca pasa de 4000; las tareas nunca se desplazan; título hostil (saltos, `<<<`, `>>>`, U+E0000) neutralizado; la salida y la causa nunca aparecen; los casos `:32,45,174,195-205` se mantienen.

### Incremento 4: API, web y `DESIGN.md`

1. `src/server.ts`: dos GET (lista y detalle) con validación del ID y 404 por `NOT_FOUND_KEYS`; `errors` en la respuesta de tarea. Sin rutas de escritura.
   - Validación (`test/server.test.ts`): lista y detalle; ID inexistente, malformado y proyecto inexistente dan 404; POST o PUT sobre errores da 404 o 405; proyecto sin errores devuelve lista vacía; HTML hostil sale inerte.
2. `web/app.js` (+ CSS mínimo con tokens existentes): `'errors'` en `PAGES`, pestaña, lista en dos grupos (resueltos 10 + «Ver todos»), página de detalle `#/<slug>/errors/<ID>`, sección «Errores (n)» en el modal de tarea y retorno al error. Primero se lee `onBoard`, `keepBoard`, `taskFromApp` y el uso de `history.back` para ampliar el mecanismo existente sin bucles. Estados cargando, vacío, error de red, inexistente e ilegible. Sin `replaceChildren(null)`.
3. i18n web y `docs/design/DESIGN.md` (pestañas, rutas, alcance, jerarquía, componentes y estados, flujo de retorno, evidencia).
   - Validación: `e2e/fixture-server.ts` y un spec nuevo con un proyecto aislado (reloj fijo, es y en), sin alterar los recuentos de `e2e/read.spec.ts`: pestaña y lista con abiertos y resueltos; detalle; tarea → error → Atrás reabre la tarea con foco en el enlace; error → tarea → Esc o Cerrar vuelve al error con foco en el enlace; sin deshacer el tablero; «Ver todos»; tarea sin errores; error inexistente; teclado y foco; instantánea ARIA; SSE refresca; 320, 768 y 1280 px en claro y oscuro; 640 px como proxy de zoom 200 %; no aparece «null»; `<script>` y `<img onerror>` en campos inertes. `test/contrast.test.ts` y `test/i18n.test.ts` verdes.

### Incremento 5: empaquetado y verificación real

1. `README.md`; `npm run build` (regenera `plugin/dist/`).
   - Validación: `npm run typecheck && npm test && npm run build && npm run check:dist && npm run test:e2e`.
2. Recorrido con cliente real del SDK sobre `plugin/dist/wayfinder.mjs mcp` y `WAYFINDER_HOME` temporal: crear proyecto y tarea, `wf_error create`, `note`, `resolve`, `wf_search`, `wf_get`, hook `session-start`.
3. Prueba en sesión real de Claude Code con el plugin reconstruido: registrar un error ligado a WAY-4, anotar una recurrencia, resolverlo, buscarlo y comprobarlo en una sesión nueva. Se usará un proyecto de pruebas o `WAYFINDER_HOME` temporal; el uso del `~/.wayfinder` real requiere confirmarlo con el usuario antes.
4. Web real: revisión en navegador (es y en, tres tamaños, teclado, claro y oscuro) con la ficha de revisión visual de `frontend-visual-review.md`.

## Criterios de aceptación

- [ ] `wf_error create` con título, `task_id` existente y contexto crea `errors/ERR-n-….md` con los campos del formato, en un commit `wf: error create ERR-n`; sin `task_id`, con tarea inexistente o con un tope superado, error claro y nada escrito.
- [ ] Dos creaciones concurrentes producen IDs distintos; `ERR-1` y `ERR-10` no se confunden.
- [ ] Una recurrencia con `note` añade una entrada fechada al Historial del mismo error y no crea otro archivo; `create` devuelve hasta 3 posibles duplicados abiertos y no los bloquea.
- [ ] `update` solo modifica campos editables y deja entrada de Historial; los inmutables no cambian. `resolve` sin solución o validación falla; con ellas el estado pasa a `resolved`; reabrir exige una nota y queda registrado.
- [ ] Un secreto en cualquier campo, título o nota se rechaza sin escribir; si el escaneo del commit lo detecta, el archivo creado se borra (o el anterior se restaura) y el mensaje no reproduce el valor.
- [ ] `files` acepta solo rutas relativas válidas (≤ 20 × 200) y las muestra como texto.
- [ ] `createProject` rechaza el prefijo `ERR`; los proyectos existentes no cambian.
- [ ] `wf_search` devuelve errores con `kind: 'error'`, ID, estado y fragmento ≤ 200, con cupo de 5, salida ≤ 4000 y orden determinista; en proyectos sin errores el resultado es idéntico al actual.
- [ ] `wf_get ERR-n` devuelve el error en un bloque `UNTRUSTED`; `wf_get` de una tarea lista sus errores (ID, estado, título) sin modificar el archivo de la tarea; `>>>` no cierra ningún bloque.
- [ ] SessionStart lista como máximo 5 errores abiertos en ≤ 600 caracteres solo si caben, con ID, tarea y título; no incluye resueltos, salida ni causa; el contexto nunca pasa de 4000 ni desplaza metadatos o historial; sin errores es idéntico al actual.
- [ ] La web muestra la pestaña «Errores» con «Abiertos (n)» y «Resueltos (n)» (10 + «Ver todos»), el detalle en `#/<slug>/errors/<ID>`, y estados vacío, cargando, error de red e inexistente. No tiene controles de escritura y los POST/PUT a errores devuelven 404 o 405.
- [ ] El modal de tarea muestra «Errores (n)»; abrir un error navega y cierra el modal; Atrás reabre la tarea con foco en el enlace; cerrar una tarea abierta desde un error vuelve al error con foco en el enlace; el tablero no se rompe.
- [ ] Texto hostil (`<script>`, `<img onerror>`, `>>>`) queda inerte; todo es operable con teclado; sin scroll horizontal a 320 px salvo el `<pre>`.
- [ ] 12 herramientas MCP; i18n es/en con paridad; `DESIGN.md`, SKILL y README coherentes; `plugin/dist/` sincronizado.
- [ ] `npm run typecheck`, `npm test`, `npm run build`, `npm run check:dist` y `npm run test:e2e` en verde; la verificación real (MCP, sesión de Claude y navegador) hecha o declarada bloqueada con su motivo.

## Estrategia de validación

- **Pruebas específicas:** `test/error-records.test.ts` (nuevo), `test/mcp.integration.test.ts`, la prueba de búsqueda existente, `test/hook.test.ts`, `test/server.test.ts`, `test/i18n.test.ts`, `test/contrast.test.ts`; e2e nuevo en proyecto aislado con reloj fijo. Siempre con `WAYFINDER_HOME` temporal.
- **Cambian intencionadamente:** `mcp.integration.test.ts:75-76` (12 herramientas); los tests de `SearchHit.kind` si comparan la unión; `hook.test.ts` gana casos sin relajar 4000; la fixture del e2e.
- **Deben quedar intactos:** `hook.test.ts:32,45,174,195-205`, los de bitácora e Historial, concurrencia, git (un commit por escritura), chat/aprobación, `read.spec.ts` y el resto del e2e, contraste e i18n (solo claves nuevas).
- **Validaciones amplias:** `npm run typecheck`, `npm test`, `npm run build`, `npm run check:dist`, `npm run test:e2e`.
- **Verificación funcional:** recorrido MCP con cliente real y hook en ejecución; sesión real de Claude Code (crear, recurrir, resolver, buscar y sesión nueva); navegador con es/en, 320/768/1280 px, claro/oscuro, teclado, 640 px como proxy de zoom 200 % y ficha de revisión visual.
- **Seguridad y accesibilidad:**
  - Seguridad: secretos (rechazo, escaneo final, deshacer), `files`, escape de `#`, `>>>`, inyección mediante SessionStart (solo metadatos), `safeJoin`, ID validado en la API, topes. Cobertura declarada: `findSecrets` es heurístico y no cubre datos personales (pregunta abierta).
  - Accesibilidad: jerarquía h1/h2/h3, `aria-current`, enlace único por ítem, estado en texto además de color, foco en `h1` y retorno al enlace, `<pre>` focalizable, teclado completo, 320 px, instantánea ARIA, contraste, movimiento reducido. Sin certificación con lectores de pantalla.

## Riesgos y reversión

- **Inyección indirecta mediante el texto de los errores** (SessionStart, `wf_get`, `wf_search`). Mitigación: SessionStart solo con ID, tarea y título aplanado y neutralizado; el resto bajo `UNTRUSTED` con `neutralize`; escape de `#`; salida completa nunca en búsqueda. Residual: no eliminable; documentado.
- **Secretos y datos personales.** `findSecrets` es heurístico: falsos negativos posibles y falsos positivos de `password-assignment`. Mitigación: escaneo de campos y documento final, borrado o restauración tras el commit. Residual: datos personales (pregunta abierta).
- **Colisión del prefijo `ERR`.** Mitigación: reserva en `createProject`, `ERROR_ID_RE` propio y enrutado por prefijo. Residual: un proyecto ya existente con `ERR` (hoy ninguno) seguiría ambiguo.
- **Regresión del tablero al cambiar el enrutado de la tarea.** Mitigación: descubrir el mecanismo actual antes de tocarlo, e2e de tarea desde tablero, desde error y Atrás.
- **Recurrencia duplicada.** La búsqueda literal puede no coincidir. Mitigación: aviso de duplicados y la skill. Residual aceptado.
- **Contexto de SessionStart saturado.** Mitigación: bloque opcional, tope propio y pruebas de límite.
- **Sin listado completo de errores desde MCP.** Residual aceptado; web y `wf_search` lo cubren. Condición para añadir `list`: que se demuestre la necesidad.
- **Estados inconsistentes** (resolver sin validación, reabrir). Mitigación: transición explícita con invariantes y entrada de Historial.
- **`plugin/dist` desincronizado.** `build` y `check:dist` en cada incremento.
- **Rendimiento de la búsqueda.** Barrido lineal con 2 MB y 20 resultados; evolucionar solo con medición.
- **Reversión:** el cambio de código se revierte por incremento (la operación git requiere autorización aparte). Los datos de `errors/` ya creados quedan como Markdown legible e ignorado por versiones anteriores; borrarlos es una acción sobre datos del usuario y requiere su decisión. Un `ERR` reservado en `createProject` no afecta a proyectos existentes.

## Desacuerdos residuales

- **Nombre del módulo.** El técnico propuso `bugs.ts`; el negador pidió evitar el choque con `errors.ts`; se recomienda `src/store/error-records.ts` por coherencia con `wf_error`, `ERR-n` y la carpeta `errors/`. Es una preferencia de nombre sin impacto funcional; si el usuario prefiere `bugs.ts`, solo cambian rutas.
- **Acciones de `wf_error`.** El técnico incluía `get` y `list`; Idealista, Negador y Calidad no lo exigían. Se recomienda no añadirlas: `wf_get` y `wf_search` ya cubren la lectura. Se reabrirá si en la práctica Claude necesita enumerar errores sin término de búsqueda.
- **Posición de los errores en `wf_search`.** El técnico los ponía tras las tareas; el negador pedía un cupo fijo. Se recomienda cupo de 5 y errores primero, porque el caso de uso es consultar antes de investigar. Riesgo: desplazar algo de la bitácora cuando hay 5 coincidencias de error.
- **Resolver.** Se exige Solución y Validación (Calidad y Seguridad) en lugar de solo Resultado (técnico). Riesgo residual: una validación formal no garantiza una verificación real.
- **Datos personales.** Seguridad pide decidir entre aceptar el riesgo residual o ampliar el detector; se recomienda aceptarlo y documentarlo (pregunta abierta arriba).
- **Retorno desde el modal.** Accesibilidad lo fija como requisito; el técnico lo consideraba un extra. Se mantiene como requisito por decisión del usuario (ronda 2); su coste depende de `app.js` y se evalúa al inicio del incremento 4, antes de implementarlo.
