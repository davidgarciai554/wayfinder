# Plan: marcar una tarea como bloqueada con su motivo (WAY-13)

> Estado: aprobado (por el usuario, 2026-11-16, «Apruebo plan v1»; decisiones (P) según la recomendación)
> Versión: v1
> Tarea: WAY-13. Relacionada: WAY-24 (versión del formato de datos).
> Revisa: `docs/design/DESIGN.md` (tarjeta y detalle de tarea). Aprobar este plan aprueba también esos cambios.

## Contexto y objetivo

- **Problema:** hoy un bloqueo solo queda como texto libre en el campo `blockers` de `wf_log`. No se ve en el tablero ni en `wf_list`, y en SessionStart solo aparece el de las dos tareas en curso más recientes. Una tarea «por hacer» que está parada no se distingue de una libre.
- **Resultado esperado:** una marca de bloqueo con motivo, visible en el tablero, en `wf_list`, en `wf_get` y en el contexto de inicio de sesión, que se quita al desbloquear con una nota.
- **Restricción de la 1.0:** alcance cerrado; queda fuera la edición de tareas desde la web.
- **Evidencia del sistema actual:**
  - Estados: `proposed`, `todo`, `in-progress`, `done`, `discarded` (`src/store/transitions.ts:3`).
  - Un estado desconocido deja la tarea «ilegible» (`toTask`, `src/store/tasks.ts:91`). `test/store.test.ts:136` usa justo `status: blocked` como ejemplo. Una tarea ilegible desaparece de SessionStart, y `wf_get`, `wf_log`, `wf_set_status` y `wf_update` fallan sobre ella.
  - Las claves de frontmatter que el código no conoce se conservan en cada reescritura: `writeTaskUnlocked` parte de `{ ...task.data }` (`tasks.ts:191-207`), y lo hace desde el primer commit del MVP (`70487e7`). Pruebas: `test/store.test.ts:17` y `:353`.
  - `depends_on` y `tags` ya son claves opcionales con lectura tolerante, que escribe solo Claude y que la web solo lee.
  - `wf_log` con `task_id` añade una entrada al historial y una línea a la bitácora en un commit (`logProgress`, `tasks.ts:457-488`). El campo `blockers` se guarda como `- Blockers: …` en la entrada (`src/store/history.ts:32-37`).
  - SessionStart muestra filas `- ID [estado] (prioridad) título`, con un tope de 4000 caracteres y sin descripciones, por el riesgo de inyección (`sessionContext`, `src/hook.ts:119-174`).
  - El bloqueo por dependencias ya existe: «bloqueada por WAY-n» en `wf_list` (`src/mcp.ts:123-137`) y la etiqueta «Bloqueada por WAY-n» en la web (`web/app.js:219-228`).

Mesa redonda de solo lectura: solución mínima, negador, representante funcional, calidad y validación, seguridad y datos, accesibilidad y experiencia. La base factual, la moderación y la síntesis son de la sesión principal. No hubo idealista: el valor ya está decidido, porque la tarea forma parte del alcance cerrado de la 1.0.

## Compatibilidad: cómo se guarda el bloqueo

El bloqueo se guarda como una **clave opcional del frontmatter**, `blocked: "<motivo>"`. No es un estado nuevo: la tarea sigue en `todo` o `in-progress`.

- **Un plugin anterior** lee la tarea como una tarea normal, porque `toTask` ignora las claves que no conoce. Al reescribirla (actualizar, cambiar de estado, registrar avance) conserva la clave. No la muestra: ese es su único límite.
- **Un estado `blocked`** haría lo contrario: cualquier versión anterior vería la tarea como «ilegible». Por eso se descarta.
- **La marca no depende de que alguien la borre.** Al leer, solo cuenta si la tarea está en `todo` o `in-progress`. Así, si una versión anterior cierra una tarea bloqueada y deja la clave, la versión nueva la ignora.
- **Lectura tolerante:** un valor que no sea texto (número, lista, `true`) o que esté vacío se trata como «sin bloqueo». La tarea nunca queda ilegible, y la clave se conserva hasta que alguien bloquee la tarea o la cierre.
- **Relación con WAY-24:** este cambio no necesita subir la versión del formato ni depende de WAY-24; las dos tareas pueden hacerse en cualquier orden. La regla de WAY-24 sobre los cambios admitidos en 1.x debería incluir este tipo de cambio: «clave opcional nueva, leída con tolerancia, que las versiones anteriores ignoran y conservan». `blocked` sería el tercer ejemplo, tras `depends_on` y `tags`.
- **Contratos que cambian, todos por adición:** un parámetro opcional en `wf_log`, una marca nueva en el texto de `wf_list`, `wf_get` y SessionStart, y un campo nuevo `blocked` en los metadatos de tarea de la API de la web. Ninguno cambia lo que ya existe para una tarea sin bloqueo.

## Alcance

**Incluido**
- `src/store/tasks.ts`, `src/mcp.ts`, `src/hook.ts`, `src/server.ts`, `web/app.js`, `web/styles.css`, `src/i18n/es.json` y `en.json`.
- Pruebas: `test/store.test.ts`, `test/concurrency.test.ts`, `test/mcp.integration.test.ts`, `test/hook.test.ts`, `test/server.test.ts`, `e2e/fixture-server.ts`, `e2e/read.spec.ts`.
- Documentación: `plugin/skills/wayfinder/SKILL.md`, `README.md`, `docs/design/DESIGN.md`.
- `plugin/dist` reconstruido.

**Excluido**
- Un estado nuevo, cambios en la tabla de transiciones o en el hook Stop.
- Bloquear o desbloquear desde la web (la 1.0 excluye editar tareas desde la web).
- Bloquear propuestas, filtro de `wf_list` por bloqueo, fecha o caducidad de la marca, categorías de motivo y avisos de bloqueo antiguo.
- Migraciones: ninguna tarea existente se toca.
- Commit, push y cualquier operación fuera del repositorio sin autorización.

**Supuestos y restricciones**
- **Rama de partida:** la implementación sale de `feat/wayfinder-mvp` (`01947bd`). El worktree donde se redactó este plan está en `a088964` (`main`), un commit por detrás: le falta la corrección de ERR-8, que toca `src/i18n/*.json`, `test/mcp.integration.test.ts` y `plugin/dist`, archivos que este plan también modifica.
- **Dónde vive el plan:** Wayfinder comprueba `Planes/` en el checkout principal, no en el worktree de la sesión (ERR-10). La copia del checkout principal es la que cuenta para el enlace y la que debe confirmarse en `feat/wayfinder-mvp`; la del worktree no se confirma, para no chocar al integrar.
- «Se quita al desbloquear con nota» se lee como requisito: la nota debe quedar garantizada por la herramienta, como ya pasa al reabrir o descartar (`store.noteRequired`), y no depender de que Claude se acuerde.

## Decisiones de la mesa redonda

Las marcadas con **(P)** necesitan tu confirmación. Si no dices nada, aprobar el plan las acepta con la recomendación.

| # | Decisión | Evidencia y motivo | Alternativas descartadas | Riesgo o consecuencia |
| --- | --- | --- | --- | --- |
| D1 | Clave opcional `blocked: "<motivo>"` en el frontmatter. | Ver «Compatibilidad». Mismo patrón que `depends_on` y `tags`. | Estado `blocked`: ilegible para versiones anteriores, obliga a tocar transiciones de tres actores, columnas y colores, y pierde de qué estado venía la tarea. Deducirlo del último `blockers` del historial: no distingue un bloqueo vigente de uno resuelto, y `blockers` también se usa para preguntas abiertas. Un mapa con fecha: nadie la consume; la fecha ya está en el historial. | Un plugin anterior no muestra la marca. |
| D2 (P) | Se escribe con `wf_log` y un parámetro opcional `blocked`. Con `blocked: true`, `blockers` es el motivo y es obligatorio. Con `blocked: false` se quita la marca y `entry` es la nota. Sin `blocked`, `wf_log` hace lo de hoy: `blockers` solo nunca pone ni cambia la marca. | La marca y su entrada de historial van en un commit, así que el motivo y la nota del desbloqueo quedan siempre registrados. Reutiliza `logProgress` entero. Al bloquearse, Claude registra el avance de todos modos: es una sola llamada. | Herramienta nueva `wf_block` (negador): más explícita, pero es una herramienta más en cada sesión y el bloqueo acabaría en dos llamadas o en dos entradas. `blocked` en `wf_update` (solución mínima): la más barata, pero no garantiza la nota y `wf_update` «nunca cambia el historial». | `wf_log` deja de ser solo registro. Con `blocked: true`, `blockers` tiene un límite más corto (200) que el habitual (1000). |
| D3 | El motivo cumple las reglas del título: una línea, hasta 200 caracteres, sin caracteres de control ni invisibles, sin nada que parezca un secreto. Se rechaza; no se recorta. | `validateTitle` (`tasks.ts:145-152`), `flatten` (`src/store/text.ts`). El motivo sale en listados y tarjetas. | Aceptar los 1000 caracteres de `blockers`: desborda tarjetas y listados. | Un motivo largo hay que resumirlo; el detalle va en `entry`. |
| D4 | Solo se bloquean tareas `todo` o `in-progress`. Bloquear otra vez sustituye el motivo. Desbloquear una tarea sin marca se rechaza sin escribir. | El hash de la revisión de propuestas no cubre el motivo (`src/store/review.ts:14`): se aprobaría un texto no visto. Una propuesta ya espera una decisión. | Bloquear propuestas: obligaría a meter el motivo en el hash. | — |
| D5 | La marca se ignora al leer fuera de `todo` e `in-progress`. `setStatus` borra la clave al pasar a `done` o `discarded` y al reabrir. | Evita marcas huérfanas aunque una versión anterior cierre la tarea. | Depender solo del borrado: no cubre las versiones mezcladas. | Cerrar una tarea bloqueada quita la marca sin nota propia; el motivo sigue en el historial. |
| D6 | La marca es solo informativa: no impide ni autoriza ningún cambio de estado, ni cambia la regla del plan ni el hook Stop. No hay aviso al pasar a `in-progress`. | Mismo criterio que las dependencias. Un texto que escribe Claude no debe activar ni desactivar controles. La marca ya se ve antes de empezar. | Impedir `in-progress` hasta desbloquear: puede atascar. Aviso como el de las dependencias: lo descartan solución mínima y negador por ruido. | Claude puede empezar una tarea bloqueada si no mira la marca. |
| D7 | `wf_list` añade «bloqueada: motivo» junto a «bloqueada por WAY-n». `wf_get` añade `blocked: yes` y el motivo en un bloque propio de dato no confiable. El motivo sale siempre limpio (`flatten` y `neutralize`). | Precedentes: marcas de `wf_list` (`mcp.ts:127-133`) y bloques `UNTRUSTED` (`mcp.ts:67-72`). | Motivo en `wf_get` fuera de bloque: lo puede haber resumido Claude de contenido ajeno. | — |
| D8 (P) | SessionStart muestra solo una marca fija, `[bloqueada]`, en la fila de la tarea y antes del título. El motivo no entra: Claude lo lee con `wf_list` o `wf_get`. | Es el contexto que llega sin que nadie lo pida: hoy no lleva texto libre fuera de bloques etiquetados. Cuesta unos 12 caracteres por tarea. Las dos tareas en curso más recientes ya muestran su `blockers` en el bloque de historial. | Motivo en la misma fila: mezcla dato libre con metadatos de confianza. Bloque aparte «motivos de bloqueo» etiquetado y solo mientras quepa (como el historial): válido, con más código y más superficie. | Claude necesita una llamada para saber el motivo de una tarea «por hacer». |
| D9 (P) | Web, solo lectura. Tarjeta: etiqueta «Bloqueada» con candado y texto, estilo `f-risk`, antes de «Bloqueada por WAY-n»; debajo, el motivo en texto suave, con dos líneas como máximo. Detalle: la etiqueta en la cabecera y la fila «Motivo del bloqueo» con el texto completo, antes de «Depende de». | Sin tokens nuevos: `--wf-flag-risk-*`, `--wf-muted` y `lockIcon` ya existen y su contraste está medido (`test/contrast.test.ts`). El recorte a dos líneas es un valor local. | Estilo neutro `f-outside`, como las dependencias: no destaca y se confunden. Motivo solo en el detalle: el tablero seguiría sin decir por qué. | `f-risk` también se usa en «Aprobada pese a aviso» y en errores abiertos; el candado y el texto los distinguen. |

## Preguntas que requieren decisión del usuario

1. **D2, cómo se escribe:** ¿`wf_log` con `blocked` (recomendado), o una herramienta nueva `wf_block`? Con `wf_block` el contrato es más explícito y `wf_log` no cambia; a cambio hay una herramienta más y dos pasos al bloquear.
2. **D8, SessionStart:** ¿solo la marca (recomendado), o también el motivo en un bloque aparte etiquetado como dato no confiable?
3. **D9, tablero:** ¿la etiqueta con el color de aviso y el motivo visible en la tarjeta (recomendado), o etiqueta neutra y motivo solo en el detalle?

## Plan de implementación

Un solo incremento. Sin commits salvo que los pidas.

1. `test/store.test.ts`: prueba de compatibilidad, antes de tocar el código. Una tarea con `blocked: "x"` escrito a mano se lee como tarea normal y conserva la clave tras `updateTask`, `setStatus` y `logProgress`.
   - Validación: `node --test test/store.test.ts` con el código sin cambiar. Debe pasar tal cual: es la evidencia de cómo se comporta la versión anterior.
2. `src/store/tasks.ts`:
   - `Task.blocked` (texto; vacío si no hay bloqueo). `toTask` lo rellena solo si el estado es `todo` o `in-progress` y la clave es texto no vacío, limpio y recortado a 200 (D5 y lectura tolerante).
   - Validación del motivo con las reglas de D3.
   - `logProgress` acepta `blocked`. Valida antes del bloqueo de escritura y aplica D4 dentro de él. Con `true` fija `data.blocked`; con `false` borra la clave. Todo en el commit de la entrada.
   - `setStatus` borra la clave según D5.
   - Validación: `test/store.test.ts` (bloquear, sustituir motivo, desbloquear con nota, rechazos sin escritura, valores inválidos a mano, cierre y reapertura, `done` con clave residual, motivo con `:`, `#` y comillas) y `test/concurrency.test.ts` (un bloqueo y un `updateTask` simultáneos no se pisan).
3. `src/mcp.ts`:
   - `wf_log`: parámetro `blocked` y descripción actualizada. `blocked` sin `task_id` se rechaza como los demás campos de tarea. La respuesta dice si la tarea queda bloqueada o desbloqueada.
   - `line` (para `wf_list`) y `detail` (para `wf_get`) según D7.
   - Validación: `test/mcp.integration.test.ts` (ida y vuelta, `>>>` y `<<<` neutralizados, convivencia con «bloqueada por», mensajes en inglés).
4. `src/hook.ts`, `sessionContext`: marca fija en la fila (D8).
   - Validación: `test/hook.test.ts` (marca presente, texto del motivo ausente, 50 tareas bloqueadas sin pasar de 4000 caracteres, inglés).
5. `src/server.ts`, `taskMeta`: campo `blocked` (el motivo o `null`).
   - Validación: `test/server.test.ts`.
6. `web/app.js` y `web/styles.css`: etiqueta en `tagsFor`, motivo en `card`, fila en el detalle (D9). El motivo se inserta siempre como texto, nunca como HTML.
   - Validación: proyecto nuevo en `e2e/fixture-server.ts` (bloqueada con motivo largo, bloqueada y con dependencia, libre, motivo `<img onerror>`) y casos en `e2e/read.spec.ts` (etiqueta y motivo, dos etiquetas distintas, fila del detalle, texto literal, 320 px sin scroll horizontal, sin controles de escritura, inglés).
7. `src/i18n/es.json` y `en.json`: textos nuevos de errores, marcas y web.
   - Validación: `test/i18n.test.ts`.
8. Documentación:
   - `plugin/skills/wayfinder/SKILL.md`: cuándo bloquear, cómo desbloquear con nota, que `blockers` solo no marca, que no es un estado, y revisar al empezar la sesión si el motivo sigue vigente.
   - `README.md`: apartado «Bloquear una tarea» y nota de versiones anteriores.
   - `docs/design/DESIGN.md`: acciones, tabla de estados, filas «Tarjeta» y «Detalle», valor local del recorte y fila de evidencia.
9. `npm run build` y validaciones amplias: `npm run typecheck`, `npm test`, `npm run test:e2e`, `npm run check:dist`.
10. Revisión en ejecución de la web: tablero y detalle a 320 y 1280 px, en claro y oscuro, con teclado. Se anota en la tabla de evidencia de `DESIGN.md`.
11. Comprobación cruzada con el bundle anterior, una vez y a mano: servir con el `plugin/dist/wayfinder.mjs` previo al cambio una carpeta de datos de prueba que tenga una tarea bloqueada por la versión nueva. La tarea debe aparecer en el tablero, sin marca y fuera de «ilegibles», y conservar la clave tras descartarla desde esa web.
    - Si no se hace, queda como **no verificado en ejecución real**; la evidencia sería solo la del paso 1.

## Criterios de aceptación

**Compatibilidad**
- [x] Con el código sin cambiar, una tarea con `blocked` escrito a mano se lee como tarea normal y conserva la clave al reescribirse.
  - Evidencia (WAY-30, 2026-11-26): test/store.test.ts, «WAY-13 compatibility: a hand-written blocked key leaves the task readable and survives update, log and set-status» (✔): la tarea con blocked a mano se lee como todo, sin ilegibles, y la clave se conserva tras updateTask, logProgress y setStatus.
- [ ] `blocked` con un número, `true`, una lista, un mapa o texto vacío: la tarea se lee, sale sin bloqueo y conserva la clave.
- [ ] Una tarea sin la clave se comporta como hoy: las pruebas existentes pasan sin tocarlas, incluida la de `status: blocked` como ilegible.

**Bloquear y desbloquear**
- [x] `wf_log` con `task_id`, `blockers` y `blocked: true` sobre una tarea `todo` o `in-progress` guarda la marca y la entrada del historial en un commit. Repetirlo con otro motivo lo sustituye.
  - Evidencia (WAY-30, 2026-11-26): test/store.test.ts, «WAY-13: wf_log blocks with a reason and unblocks with a note, each in one commit with its history entry» (✔): bloquear suma 1 commit con la entrada «- Blockers: …» en el historial, repetir con otro motivo lo sustituye; test/mcp.integration.test.ts «WAY-13: wf_log blocks and unblocks…» (✔) lo hace por MCP; «the block lives only on todo and in-progress…» lo prueba en in-progress.
- [x] Se rechaza sin escribir nada: `blocked` sin `task_id`; `blocked: true` sin `blockers`, con más de 200 caracteres, con caracteres invisibles o con algo que parece un secreto; `blocked: true` sobre una tarea `proposed`, `done` o `discarded`; `blocked: false` sobre una tarea sin marca.
  - Evidencia (WAY-30, 2026-11-26): test/store.test.ts, «WAY-13: invalid blocks are rejected without writing anything» (✔): sin motivo, vacío, 201 caracteres, caracteres invisibles/bidi/control, secreto ghp_, tareas proposed/done/discarded (store.blockNotAllowed) y blocked:false sin marca (store.notBlocked) lanzan error con tree(home) idéntico (200 caracteres sí pasa); test/mcp.integration.test.ts: blocked sin task_id → «blockers and blocked are only accepted with task_id».
- [x] `wf_log` con `blocked: false` quita la marca y deja la nota en el historial y en la bitácora.
  - Evidencia (WAY-30, 2026-11-26): test/store.test.ts, «WAY-13: wf_log blocks and unblocks…» (✔): quita la clave del archivo (storedBlock undefined) en 1 commit, deja la nota en el historial y en la bitácora (log/*.md contiene «desbloqueada, ya hay aprobación»).
- [x] `wf_log` sin `blocked` no pone, quita ni cambia la marca, aunque lleve `blockers`.
  - Evidencia (WAY-30, 2026-11-26): test/store.test.ts, «WAY-13: wf_log blocks and unblocks…» y test/mcp.integration.test.ts, «WAY-13: wf_log blocks and unblocks…» (✔): un wf_log con blockers pero sin blocked no pone, quita ni cambia la marca (wf_list idéntico).
- [x] Pasar a `done` o `discarded`, o reabrir, deja el archivo sin la clave. Una tarea `done` con la clave escrita se muestra sin marca.
  - Evidencia (WAY-30, 2026-11-26): test/store.test.ts, «WAY-13: the block lives only on todo and in-progress; closing and reopening remove the key» (✔): done y discarded eliminan la clave, reabrir la quita y una tarea done con la clave a mano se lee con blocked vacío.
- [x] La marca no impide ningún cambio de estado.
  - Evidencia (WAY-30, 2026-11-26): test/store.test.ts, «WAY-13: wf_log blocks and unblocks…» y «the block lives only on todo and in-progress…» (✔): una tarea bloqueada pasa a in-progress, todo y done; test/mcp.integration.test.ts «WAY-13: wf_log blocks and unblocks…»: wf_set_status a in-progress sin error.

**Dónde se ve**
- [x] `wf_list` muestra «bloqueada: motivo» y, si además hay una dependencia abierta, «bloqueada por WAY-n». `wf_get` muestra `blocked: yes` y el motivo en un bloque de dato no confiable.
  - Evidencia (WAY-30, 2026-11-26): test/mcp.integration.test.ts, «WAY-13: wf_log blocks and unblocks; wf_list and wf_get show the reason as untrusted data» (✔): wf_list «— blocked: Waiting for … ; blocked by MYA-1» (motivo manual primero, dependencia después; la prueba usa WAYFINDER_LANG=en), wf_get «blocked: yes» y el motivo dentro de <<<UNTRUSTED BLOCK REASON … >>>.
- [x] SessionStart marca la fila con `[bloqueada]`, el texto del motivo no aparece y el contexto no pasa de 4000 caracteres.
  - Evidencia (WAY-30, 2026-11-26): test/hook.test.ts, «WAY-13: session-start marks a blocked task with a fixed mark; the reason stays out of the task rows» (✔): fila «[bloqueada]» en es y «[blocked]» en en, y el texto del motivo no aparece; «WAY-13: many blocked tasks keep session-start within its limit, truncated as before» (✔) mantiene ≤ 4000 caracteres; accept2.txt paso 3.8 con hooks reales.
- [x] La web muestra la etiqueta «Bloqueada» con icono y texto y el motivo en la tarjeta, y el motivo completo en el detalle. Una tarea con bloqueo y dependencia muestra las dos etiquetas. No hay ningún control para bloquear o desbloquear.
  - Evidencia (WAY-30, 2026-11-26): e2e.txt, e2e/read.spec.ts «WAY-13: a blocked task says «Bloqueada» with its reason on the card and the detail, as text and read-only» (ok): etiqueta «Bloqueada» con svg aria-hidden y texto, motivo en la tarjeta (2 líneas) y completo en el detalle, «Bloqueada» + «Bloqueada por BLO-2» juntas, y ningún botón de bloquear.
- [x] Un motivo con HTML se ve como texto, y uno largo no provoca scroll horizontal a 320 px.
  - Evidencia (WAY-30, 2026-11-26): e2e/read.spec.ts «WAY-13: a blocked task says «Bloqueada»…» (ok en e2e.txt): el motivo «<img src=x onerror=…>» se ve como texto y no ejecuta nada, y a 320 px una dirección larga no provoca scroll horizontal (noHorizontalScroll en tablero y detalle).
- [x] `npm run typecheck`, `npm test`, `npm run test:e2e` y `npm run check:dist` en verde.
  - Evidencia (WAY-30, 2026-11-26): quality.txt: npm run typecheck (TYPECHECK_OK) y npm run check:dist (CHECKDIST_OK) correctos; test.txt: npm test 230/230 en verde; e2e.txt: npm run test:e2e 68 passed (4.9m).

## Estrategia de validación

- **Pruebas específicas:** `node --test` sobre cada archivo de prueba tocado, en el orden de los pasos 1 a 7.
- **Validaciones amplias:** `npm run typecheck`, `npm test` (construye antes e incluye `test/contrast.test.ts`), `npm run test:e2e` y `npm run check:dist`.
- **Verificación funcional:** revisión de la web en ejecución (paso 10), una sesión real para ver la marca en SessionStart y la comprobación cruzada del paso 11.
- **Seguridad:** carga sintética en las pruebas: instrucciones dentro del motivo, `<<<` y `>>>`, U+202E y U+200B, un patrón de secreto y HTML en la web.
- **Accesibilidad:** texto e icono, nunca solo color; orden de lectura del detalle; teclado y foco tras el autorefresco. Sin tokens nuevos, así que no hay contrastes nuevos que medir.
- **Sin verificar previsto:** lector de pantalla (NVDA), zoom real al 200 % y `npm run test:docker`, que no cubre este cambio.

## Riesgos y reversión

| Riesgo | Mitigación | Residual |
| --- | --- | --- |
| Marca obsoleta: nadie desbloquea | Se ve en cada inicio de sesión y en el tablero; la skill pide comprobar si el motivo sigue vigente; cerrar la tarea la quita | No hay fecha ni caducidad en la marca |
| Inyección de instrucciones a través del motivo | Fuera de SessionStart, limpio en `wf_list`, en bloque no confiable en `wf_get` y como texto en la web | Claude lee el motivo cuando lo pide, como ya lee títulos e historial |
| Confundir `blockers` con la marca | `blockers` solo nunca marca; descripción de `wf_log` y skill | Depende de que Claude siga la skill |
| Versiones mezcladas | D5: la lectura ignora la marca en tareas cerradas | Si una versión anterior cierra y reabre una tarea bloqueada, la marca reaparece hasta que alguien la quite |
| Presupuesto de SessionStart | Solo una marca fija por tarea bloqueada | Unos 12 caracteres por tarea |

**Reversión:** son cambios de código sin commit hasta que lo autorices. `blocked` es una clave opcional: si se revierte el código, las tareas siguen legibles y la clave se conserva sin efecto. No hay migración que deshacer.

## Desacuerdos residuales

- **Cómo se escribe (D2).** El negador prefiere `wf_block`, porque sobrecargar `wf_log` mezcla registrar con cambiar una marca. Solución mínima prefiere `wf_update`, por coste, y acepta `wf_log` si la nota debe ser obligatoria. Se recomienda `wf_log`, con la condición del negador ya incluida: la marca solo cambia si `blocked` se pasa de forma explícita. Queda como pregunta 1.
- **Motivo en SessionStart (D8).** Solución mínima admitía un motivo recortado; seguridad y negador, solo la marca. Queda como pregunta 2.
- **Aviso al pasar a `in-progress` (D6).** Calidad lo daba por incluido y el representante funcional lo veía como decisión tuya (avisar o impedir). Se deja fuera por solución mínima y negador; seguridad pide que la marca nunca impida nada. Si lo quieres, es un añadido pequeño.
- **Borrado al reabrir (D5).** El negador lo considera sobrante. Se mantiene porque es la misma línea que el borrado al cerrar y cubre las tareas que cerró una versión anterior.

## Notas de implementación

> Anotaciones posteriores a la aprobación. No cambian el alcance aprobado.

- **Rama (2026-11-16):** con tu autorización, el worktree de la sesión avanzó de `a088964` a `feat/wayfinder-mvp` (`01947bd`) por avance rápido, sin push. Todo queda sin commit.
- **Paso 1:** la prueba de compatibilidad pasó sobre el código sin cambiar antes de tocar `src/`.
- **Pasos 2 a 7:** implementados como decía el plan. Detalles:
  - El motivo admite espacios y saltos de línea, que se pliegan en una sola línea al guardar, igual que el título. Se rechazan el texto vacío, más de 200 caracteres y los caracteres de control o invisibles.
  - `wf_log` añade a su respuesta «WAY-n queda bloqueada.» o «WAY-n queda desbloqueada.».
  - `wf_get` muestra `blocked: yes` y el motivo en el bloque `UNTRUSTED BLOCK REASON`.
- **Paso 11:** hecho en ejecución, con una prueba temporal que no queda en el repositorio. El bundle anterior al cambio (`plugin/dist/wayfinder.mjs` de `01947bd`) leyó una carpeta de datos con dos tareas bloqueadas por el código nuevo: su SessionStart las lista sin marca, su web las muestra en el tablero y sin ilegibles, y al descartar una desde esa web el archivo conserva la clave `blocked`. Después el código nuevo lee esa tarea descartada sin bloqueo y la otra sigue bloqueada.
- **Validación (2026-11-16):** `npm run typecheck`, `npm test` 183/183, `npm run check:dist` y `npm run test:e2e` 47/47. Revisión de capturas del tablero y del detalle a 320 y 1280 px, en claro y oscuro; fila añadida a la evidencia de `docs/design/DESIGN.md`.
- **Sin verificar:** una sesión real de Claude Code con el plugin actualizado (el hook se probó con el bundle nuevo desde las pruebas), NVDA, zoom real al 200 % y `npm run test:docker`.
- **ERR-10:** registrado en Wayfinder y en `ERRORES.md`; sigue abierto y queda fuera de este plan.
- **Revisión independiente (2026-11-16):** sin P0, P1 ni P2. Dos observaciones P3:
  - **Aplicada:** una propuesta con una clave `blocked` escrita a mano quedaba bloqueada al aprobarse, con un motivo que nadie revisó. Ahora la clave solo sobrevive entre `todo` e `in-progress`: `setStatus` la borra en cualquier otro cambio, y la aprobación por chat (`src/store/approve.ts`, una línea) también. Es coherente con D4; añade ese archivo a los tocados. Pruebas en `test/store.test.ts` y `test/chat.test.ts`.
  - **Aceptada sin cambio:** `blocked` es el séptimo parámetro posicional de `logProgress`. Convertirlo en un objeto de opciones obligaría a tocar todas las llamadas existentes.
- **Validación final (2026-11-16), tras la corrección de la revisión:** `npm run typecheck`, `npm test` 184/184, `npm run check:dist` y `npm run test:e2e` 47/47.
