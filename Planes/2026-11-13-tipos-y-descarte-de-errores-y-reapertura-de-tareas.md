# Plan: tipos y descarte de errores, y reapertura de tareas (WAY-8, WAY-9, WAY-12)

> Estado: aprobado (por el usuario, 2026-11-13, «apruebo el plan v1»; decisiones (P) según la recomendación)
> Versión: v1
> Tareas: WAY-8 (tipos de error), WAY-9 (errores descartados), WAY-12 (reabrir tareas)
> Revisa: `Planes/2026-10-21-wayfinder-mvp.md` («`done`, `discarded` → *: terminales», L261, y «deshacer el descarte», L166), `Planes/2026-10-23-registro-de-errores.md` («severidades, etiquetas», L70) y `docs/design/DESIGN.md` (L17, L60, L148-150). Aprobar este plan aprueba también esas revisiones.

## Contexto

- En un escaneo del 2026-11-13 la persona pidió que los errores tuvieran «distintas secciones para separar cada tipo de error». Después aprobó en el chat WAY-8, WAY-9 y WAY-12 y pidió completarlas una a una.
- Hoy un error solo tiene `status` (`open`/`resolved`) y `cause_kind` (`hypothesis`/`confirmed`), en `src/store/error-records.ts:20-23`. `cause_kind` dice si la causa está probada, no qué tipo de fallo es, así que no cubre la necesidad.
- Un error que no se va a corregir (falsa alarma, fallo puntual del entorno) solo se puede cerrar inventando una solución y una validación (`resolveError`). Mientras tanto ocupa uno de los 5 huecos de errores abiertos del SessionStart.
- La tabla de transiciones (`src/store/transitions.ts:18-32`) no tiene salida desde `done` ni desde `discarded`.

Mesa redonda proporcional (solo lectura): analista del repositorio, técnico de solución mínima, negador, seguridad y datos, calidad y validación, y accesibilidad y experiencia. Esta síntesis la redacta el responsable de la sesión.

## Decisiones

Cada decisión lleva la recomendación de la mesa. **Las marcadas con (P) necesitan tu confirmación**; si no dices nada, la aprobación del plan las acepta tal como están.

### WAY-8: tipos de error

| # | Decisión | Recomendación | Alternativas descartadas y motivo |
| --- | --- | --- | --- |
| D1 (P) | Lista de tipos | 6 valores fijos: `build` (compilación), `test` (pruebas), `analysis` (análisis: lint, tipos), `runtime` (ejecución), `behavior` (comportamiento inesperado) y `environment` (entorno: puertos, permisos, configuración, dependencias, plataforma). Es la clasificación que `AGENTS.md` ya usa para registrar errores, más «entorno», que cubre 5 de las 17 entradas de `ERRORES.md` (puerto ocupado, `EPERM`, cortafuegos…). | 8 tipos (los de la propuesta): «dependencia» e «integración» se solapan con «entorno» y «comportamiento». 4 tipos (negador): mezcla análisis con compilación y ejecución con comportamiento, que en `ERRORES.md` sí se distinguen. |
| D2 | Campo | `kind` opcional en el frontmatter, solo con valores del enum. Se valida como `cause_kind` (`validateCauseKind` + `z.enum`). Un valor desconocido en disco (versión más nueva o edición a mano) se lee como «Sin clasificar», nunca como texto literal ni como ilegible. | Texto libre: llevaría texto no confiable al contexto de Claude. |
| D3 | ¿Editable? | Sí: `create` y `update` aceptan `kind`. Es una clasificación, no algo observado (lo observado, es decir contexto, reproducción y salida, sigue siendo inmutable). | Solo en `create`: obliga a notas para corregir una clasificación. |
| D4 | Sin migración | Los errores existentes quedan sin `kind` y se muestran como «Sin clasificar». | Migrar a mano: toca datos sin necesidad. |
| D5 (P) | Web | Pestaña «Errores»: el **estado** sigue siendo el `h2` (Abiertos, Resueltos y, con WAY-9, Descartados, cada uno con recuento) y dentro de cada uno hay un `h3` por **tipo** con recuento, en orden fijo y «Sin clasificar» al final. Solo aparecen los tipos con elementos. El tipo también se muestra en texto en el detalle del error (`<dl>`, «Tipo») y en «Errores (n)» de la tarea. | Tipo como `h2` y estado como `h3`: lo pendiente queda repartido en varios bloques y hay que reescribir más. Filtro o selector: `DESIGN.md` excluye la búsqueda y las secciones ya separan los tipos; se reconsidera si hay muchos errores. |
| D6 | SessionStart | El bloque de errores abiertos empieza con el resumen por tipo (p. ej. «Errores abiertos (3): pruebas 2, entorno 1») y cada línea lleva el tipo traducido. Se mantienen el máximo de 5 líneas, el tope de 600 caracteres y `MAX_CONTEXT`; si el resumen no cabe, se omite antes que las líneas. | Solo el resumen: Claude pierde los ID. |
| D7 | Búsqueda | `wf_search` muestra el tipo junto al estado del error. No hay filtro nuevo en MCP: el listado filtrable es WAY-10. | Filtro aquí: adelanta WAY-10. |

### WAY-9: errores descartados

| # | Decisión | Recomendación | Alternativas descartadas y motivo |
| --- | --- | --- | --- |
| D8 (P) | Representación | Nuevo estado `discarded` en `ERROR_STATUSES`, literal a la petición. **Consecuencia:** un plugin instalado más antiguo que lea la misma carpeta de datos muestra esos errores como «ilegibles» (no los borra ni los modifica) hasta que se actualice. Se mitiga de cara al futuro: a partir de esta versión, un estado desconocido se muestra como texto y no deja el registro ilegible. | `status: resolved` + clave `resolution: discarded`: compatible con plugins viejos, pero un descartado parecería «Resuelto» en ellos, que es justo la confusión que se quiere evitar. |
| D9 | Acción MCP | `wf_error` con `action: "discard"`, `note` obligatoria (pasa por `validateNote`: secretos y longitud). Funciona desde `open` (y desde `resolved` si hubo un error al resolver). Reabrir sigue siendo `update` con `reopen: true` y nota, ahora también desde `discarded`. Las notas quedan en el historial del error. | Reutilizar `resolve` con un indicador: mezcla dos cierres con requisitos distintos. |
| D10 (P) | Quién descarta | Claude, con nota obligatoria. La skill le indica que solo descarte falsas alarmas o fallos que no se van a corregir, y que te lo diga. La web muestra la sección «Descartados» con el motivo (la nota) en el detalle, así que nada se oculta en silencio. | Solo la persona desde la web: necesita rutas de escritura de errores, que la web no tiene por diseño. Se puede añadir más adelante. |
| D11 | Consumidores | Un descartado no cuenta como abierto (SessionStart, duplicados, `errorMeta`) ni como resuelto. `errorPill` deja de tratar «todo lo que no es abierto» como «Resuelto»: el descartado usa la píldora `s-discarded` existente (tachado, con su texto). | — |

### WAY-12: reabrir tareas

| # | Decisión | Recomendación | Alternativas descartadas y motivo |
| --- | --- | --- | --- |
| D12 (P) | Quién reabre | **Solo la persona desde la web** (con escritura activada: Origin, clave, cuerpo JSON y `expectedUpdated`, como Aprobar y Descartar). Claude (MCP) y el chat no pueden reabrir. | Claude por MCP: una propuesta descartada sin aprobar volvería a `todo` sin ti, y una tarea o un error podría pedir «reabre WAY-X» (inyección). MCP solo hacia `proposed`: posible, pero sin un caso real y con más superficie. |
| D13 | Destino | `done` → `todo`. `discarded` → `todo` si la tarea es tuya (`origin: user`) o fue aprobada (`approvedVia` presente); si no (propuesta de Claude o de routine nunca aprobada), vuelve a `proposed` y necesita aprobarse de nuevo. Nunca a `in-progress`: empezarla sigue exigiendo plan. | `approvedVia` solo: tus tareas creadas en la web nacen en `todo` sin `approvedVia` (`tasks.ts:204-208`) y volverían a propuesta. Guardar el estado previo: campo nuevo innecesario. |
| D14 | Nota | Obligatoria en el diálogo. Se guarda en el **historial de la tarea** (entrada «Reabierta: …») y en la bitácora (línea `status: done -> todo` con la nota y el enlace), en un solo commit. | Solo la bitácora: la tarea pierde por qué se reabrió. |
| D15 | Aprobación previa | Al volver a `proposed`, la tarea no tiene `approvedVia` por definición. Una aprobación por chat posterior exige una revisión nueva (el hash ya lo garantiza). | — |
| D16 | Web | Botón «Reabrir» en el detalle de las tareas `done` y `discarded` (y en sus tarjetas), solo con escritura activada. Diálogo `<dialog class="modal">` no destructivo: dice a qué columna vuelve, `textarea` «Nota (obligatoria)» con foco inicial, Cancelar/Reabrir; errores junto al campo; 409 dentro del diálogo sin perder la nota; Esc devuelve el foco. | `alertdialog` como Descartar: reabrir es reversible y no destructivo. |

### Fuera de este plan

- ERR-5 (la aprobación por chat no reconoce varios IDs tras un solo verbo). Afecta al filtro de seguridad de las órdenes y merece su propio cambio.
- Escritura sobre errores desde la web, filtro de errores (WAY-10), cambio de tarea de un error (WAY-11), etiquetas de tareas (WAY-14).
- Commit, push y actualización del plugin instalado: requieren tu autorización aparte.

## Alcance

**Incluido**
- `src/store/error-records.ts`: `ERROR_KINDS`, `validateKind`, `kind` en registro y parche; `discarded` en `ERROR_STATUSES`, `discardError`, reapertura desde `resolved` o `discarded`; lectura tolerante de estados y tipos desconocidos.
- `src/store/transitions.ts`: entradas solo para `web`: `done → todo`, `discarded → todo | proposed` (con `needsNote`).
- `src/store/tasks.ts`: reapertura en `setStatus` (destino según D13, entrada de historial + línea de bitácora, un commit).
- `src/mcp.ts`: `kind` en `wf_error` (create/update), acción `discard`, tipo y estado en `wf_get`, `wf_search` y el bloque de duplicados. `wf_set_status` no cambia (MCP sigue sin poder reabrir).
- `src/hook.ts`: bloque de errores abiertos con resumen por tipo (D6).
- `src/server.ts`: `kind` en `errorMeta`; ruta `POST /api/projects/:slug/tasks/:id/reopen` con las mismas protecciones que `discard` y `note` obligatoria.
- `web/app.js`, `web/index.html`, `web/styles.css`: secciones por estado y tipo, píldora «Descartado», tipo en el detalle y en la tarea, botón y diálogo «Reabrir» (añadir `textarea` a la regla de 44 px).
- `src/i18n/es.json`, `src/i18n/en.json`: tipos, estado descartado, reapertura (con paridad).
- Documentación: `docs/design/DESIGN.md`, `README.md`, `plugin/skills/wayfinder/SKILL.md`; anotación de la revisión en `Planes/2026-10-21-wayfinder-mvp.md` (tabla de estados) y en `Planes/2026-10-23-registro-de-errores.md`.
- Pruebas (ver «Estrategia de pruebas»), `dist/` y `plugin/dist/` reconstruidos.

**Excluido**: lo listado en «Fuera de este plan»; migración de datos; dependencias nuevas; tokens o colores nuevos.

## Cambios en `DESIGN.md` que se aprueban con el plan

1. L17: «pestaña Errores de solo lectura» → «sin acciones de escritura sobre errores».
2. L60 y L148: «Abiertos», «Resueltos» y «Descartados» como `h2` con recuento; dentro, un `h3` por tipo con recuento, en orden fijo y «Sin clasificar» al final; solo tipos con elementos.
3. L148-150: estado «Descartado» con `s-discarded` (tachado y texto, sin depender del color) y el tipo en texto en el detalle y en «Errores (n)».
4. Acciones y componentes (L65-70, L146-147, inventario L131): «Reabrir» en tareas `done`/`discarded` y su diálogo (no destructivo, nota obligatoria, foco inicial en la nota).
5. Una fila nueva en la evidencia de revisión al cerrar.

## Incrementos

Uno por tarea, en este orden: WAY-9 se apoya en las secciones de WAY-8; WAY-12 es independiente y la de más riesgo. Al terminar cada uno: `wf_log` con la evidencia, `ERRORES.md`/`wf_error` si algo falla, y la tarea a `done`. **Sin commits** salvo que los autorices.

### Incremento 1 — WAY-8: tipos de error
1. Store: `ERROR_KINDS`, `validateKind` (clave i18n `store.invalidKind`), `kind` en `toRecord`/`serializeRecord`/`applyPatch`; un valor desconocido se lee como sin tipo.
2. MCP: `kind: z.enum(ERROR_KINDS).optional()` en `wf_error` y descripción; tipo en `errorDetail`, búsqueda y duplicados.
3. Hook: resumen por tipo y tipo por línea, respetando los topes.
4. Servidor y web: `kind` en `errorMeta`; `h3` por tipo dentro de cada estado; «Tipo» en el detalle; tipo en «Errores (n)».
5. i18n, `DESIGN.md` (puntos 1-3 en lo que toca a tipos), README, SKILL.md.
6. Pruebas, `npm run build` y revisión visual.
- **Validación:** `node --test test/error-records.test.ts test/hook.test.ts test/server.test.ts test/memory.test.ts test/i18n.test.ts`, después `npm test`, `npm run test:e2e`, `npm run check:dist` y revisión en ejecución.

### Incremento 2 — WAY-9: errores descartados
1. Store: `discarded` en `ERROR_STATUSES`; `discardError` (nota obligatoria, idempotencia, commit `wf: error discard`); `updateError` reabre desde `resolved` o `discarded`; un estado desconocido se lee sin dejar el registro ilegible.
2. MCP: acción `discard` (solo `id` y `note`; rechaza otros campos).
3. Consumidores: `findDuplicates`, hook, `errorMeta`, `memory.ts`, `wf_get`; web: sección «Descartados» (máx. 10 + «Ver los N», como Resueltos), `errorPill` con tres estados, nota visible en el historial del error.
4. i18n, `DESIGN.md`, README, SKILL.md (cuándo descartar y que hay que decírtelo).
- **Validación:** igual que el incremento 1, más `test/mcp.integration.test.ts`.

### Incremento 3 — WAY-12: reabrir tareas
1. Transiciones solo para `web` y destino según D13 en `setStatus`; entrada en el historial + línea en la bitácora en un commit.
2. Ruta `POST …/reopen` con Origin, clave, JSON, `expectedUpdated` y `note`.
3. Web: botón y diálogo «Reabrir», foco y estados (validación, 409, 404, «Reabriendo…»).
4. i18n, `DESIGN.md`, README, SKILL.md (Claude no reabre: te pide que lo hagas en la web), anotación en el plan MVP.
- **Validación:** `node --test test/store.test.ts test/server.test.ts test/chat.test.ts test/mcp.integration.test.ts test/hook.test.ts`, después `npm test`, `npm run test:e2e`, `npm run check:dist` y revisión en ejecución.

## Criterios de aceptación

**WAY-8**
- [ ] `create` y `update` aceptan los 6 tipos; un valor fuera del enum se rechaza sin escribir archivo ni commit.
- [ ] Un error sin `kind`, o con un `kind` desconocido en disco, se lee igual que antes y aparece como «Sin clasificar»; las claves desconocidas se conservan al reescribir.
- [ ] La pestaña Errores muestra, dentro de cada estado, un `h3` por tipo con recuento y «Sin clasificar» al final; se mantiene el tope de 10 resueltos.
- [ ] El detalle del error y «Errores (n)» de la tarea muestran el tipo en texto.
- [ ] SessionStart: resumen por tipo y tipo por línea, sin pasar de 600 caracteres ni de `MAX_CONTEXT`; con títulos largos y 6 tipos, las tareas nunca se desplazan.
- [ ] Paridad es/en (`test/i18n.test.ts`).

**WAY-9**
- [ ] `discard` sin nota, con nota vacía, con un secreto o demasiado larga se rechaza sin cambiar el archivo.
- [ ] Un descartado no aparece en el bloque de abiertos del SessionStart ni en los duplicados, y no se muestra como «Resuelto» en ningún sitio.
- [ ] La web lo muestra en «Descartados» con la píldora tachada y su texto, y la nota en el detalle.
- [ ] `update` con `reopen: true` y nota lo devuelve a `open`, igual que con un resuelto.
- [ ] Un estado desconocido en disco no deja el registro ilegible.

**WAY-12**
- [ ] Desde la web: `done` → `todo`; `discarded` → `todo` si `origin: user` o hay `approvedVia`; si no, → `proposed`.
- [ ] Por MCP y por chat, cualquier transición desde `done` o `discarded` se rechaza con `store.invalidTransition` y el archivo queda igual.
- [ ] La nota es obligatoria (vacía o con secreto → 400 sin cambios) y queda en el historial de la tarea y en la bitácora, en un solo commit.
- [ ] La ruta responde 403 sin Origin válido o sin clave, y 409 con un `expectedUpdated` antiguo, sin cambiar nada.
- [ ] Una propuesta reabierta a `proposed` no se puede aprobar por chat sin una revisión nueva.
- [ ] El diálogo funciona con teclado: foco inicial en la nota, Esc devuelve el foco, el error de validación enfoca la nota, el 409 no pierde la nota y, tras el éxito, el foco no se pierde en `body`. Objetivos de 44 px por debajo de 1100 px.

**Comunes**
- [ ] `npm run typecheck`, `npm test`, `npm run test:e2e` y `npm run check:dist` en verde.
- [ ] Revisión de la web en ejecución a 1280 y 390 px (también 320 px para el diálogo), en claro y oscuro.

## Estrategia de pruebas

- Unitarias: `test/error-records.test.ts` (tipo, descartar y reabrir, lectura tolerante), `test/store.test.ts` (transiciones por actor y destino), `test/hook.test.ts` (bloque por tipo y topes), `test/memory.test.ts` (descartado no es abierto), `test/i18n.test.ts`, `test/contrast.test.ts` (si cambian estilos).
- Integración: `test/mcp.integration.test.ts` (`kind`, `discard`, MCP no reabre), `test/server.test.ts` (ruta `reopen` y `errorMeta`), `test/chat.test.ts` (sin aprobación tras reabrir sin revisión).
- e2e: `e2e/errors.spec.ts` (secciones por tipo, «Sin clasificar», «Descartados», árbol de accesibilidad) y `e2e/write.spec.ts` (reabrir: nota vacía, 409, éxito y foco, en es y en). El fixture `e2e/fixture-server.ts` solo se amplía en el proyecto `errores` (tipos en ERR-1 y 2-3 abiertos más, uno descartado) y con tareas `done`/`discarded` en un proyecto que no altere los recuentos de `read.spec.ts`.
- Revisión visual en ejecución: ficha según `Plantillas/revision-visual-frontend.md`, o la fila de evidencia de `DESIGN.md`.

## Riesgos

| Riesgo | Mitigación | Riesgo residual |
| --- | --- | --- |
| Reapertura que salta la aprobación | Solo web; destino `proposed` sin aprobación previa; pruebas de que MCP y chat se rechazan | Ninguno conocido en el código; depende de que la web siga exigiendo clave |
| Plugin instalado antiguo ante `discarded` | Lectura tolerante desde esta versión; README lo explica | Hasta actualizar el plugin, los descartados se ven «ilegibles» en él |
| Claude descarta errores para quitarlos del contexto | Nota obligatoria, sección visible en la web, la skill pide avisarte | La nota la escribe Claude; el control es la visibilidad |
| SessionStart demasiado largo | Topes existentes, el resumen se omite antes que las líneas, pruebas con 6 tipos | — |
| Recuentos de los e2e existentes | Datos nuevos solo en proyectos aislados | — |

## Reversión

Cada incremento queda en archivos del repositorio sin commit hasta que lo autorices; se revierte descartando esos cambios. En los datos, un `kind` y un `discarded` son claves y valores de frontmatter: si se revierte el código, los errores con `kind` siguen legibles (clave desconocida que se conserva) y los descartados se verían «ilegibles» hasta volver a resolverlos o reabrirlos. Una reapertura es un commit `wf:` en la carpeta de datos.

## Preguntas abiertas

Las decisiones (P): D1, D5, D8, D10 y D12. Sin respuesta, se aplica la recomendación.

## Notas de implementación

> Anotaciones posteriores a la aprobación. No cambian el alcance aprobado.

- **Incremento 1, WAY-8 (2026-11-13):**
  - Tipos `build`, `test`, `analysis`, `runtime`, `behavior` y `environment` en `ERROR_KINDS` (`src/store/error-records.ts`); un valor desconocido en disco se lee como sin clasificar y se conserva en el archivo hasta que un `update` pone uno válido.
  - Las etiquetas traducidas usan claves `errorKind.*`, compartidas por la web, el hook y el MCP (la API `/api/i18n` las sirve junto a `web.*` y `status.*`).
  - SessionStart: el recuento por tipo («Por tipo: …») solo se incluye si no cuesta ninguna línea de error; las líneas sin tipo no llevan etiqueta.
  - El recuento del `h2` «Resueltos» sigue contando los mostrados, como antes.
  - Validación: `npm run typecheck`; `npm test` 142/142; `npm run test:e2e` 42/42; `npm run check:dist` correcto; revisión visual con capturas de Playwright sobre el fixture e2e (1280 px claro, 390 px oscuro, detalle y tarea).
- **Incremento 2, WAY-9 (2026-11-13):**
  - `discarded` en `ERROR_STATUSES`; `discardError` exige nota (vacía, con secreto o demasiado larga → rechazo sin escribir), es idempotente y deja «Discarded.» y el motivo en las notas del error; commit `wf: error discard`. Reabrir con `update` + `reopen` acepta resueltos y descartados. Se puede descartar un resuelto.
  - Lectura tolerante: un estado que esta versión no conoce, si es una palabra sencilla (`^[a-z][a-z-]{0,19}$`), se lista tal cual (web: grupo «Otros estados», píldora sin color); cualquier escritura sobre él se rechaza con `store.errorUnknownStatus`. Lo demás sigue siendo ilegible.
  - `wf_error` con `action: "discard"` (solo `id` y `note`). La skill pide descartar solo falsas alarmas o fallos que no se van a corregir y decírselo a la persona.
  - Validación: `npm run typecheck`; `npm test` 145/145; `npm run test:e2e` 43/43; `npm run check:dist` correcto; capturas de Playwright sobre el fixture e2e.
- **Incremento 3, WAY-12 (2026-11-13):**
  - Transiciones solo para `web`: `done → todo` y `discarded → todo | proposed`, con nota. `reopenTarget(task)` decide el destino (D13) y `setStatus` exige ese destino exacto bajo el bloqueo. La nota va al historial de la tarea («status: X -> Y» y el motivo) y a la bitácora, en un solo commit; máximo 4000 caracteres.
  - D15 se cumple de forma explícita: el hash de la revisión no incluye el estado, así que al volver a `proposed` se borra la revisión guardada (`consumeReviewUnlocked`) y una aprobación por chat necesita una revisión nueva. Esto añade un import circular `tasks.ts` ↔ `review.ts`, solo con llamadas en tiempo de ejecución.
  - Ruta `POST …/tasks/:id/reopen` con Origin, clave, JSON, `expectedUpdated` y `note`; `reopensTo` en los metadatos de tarea para que la web diga a qué columna vuelve.
  - Defecto encontrado por la prueba nueva y corregido antes de cerrar: la ruta usaba `todo` por defecto cuando la tarea no estaba hecha ni descartada, lo que aprobaba una propuesta (ERR-6 en Wayfinder y `ERRORES.md`).
  - Validación: `npm run typecheck`; `npm test` 150/150; `npm run test:e2e` 44/44; `npm run check:dist` correcto; capturas del diálogo a 1280 px en claro y 320 px en oscuro. Sin ejecutar: `npm run test:docker` (no se tocó la lista de herramientas MCP).
