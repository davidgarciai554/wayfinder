# Plan: cambiar la tarea de un error (WAY-11)

> Estado: aprobado (por el usuario, 2026-11-13, «Apruebo los cuatro»; D1 según la recomendación: solo reasignar)
> Versión: v1
> Tarea: WAY-11
> Revisa: `Planes/2026-10-23-registro-de-errores.md` (la tarea del error era inmutable).

## Contexto y objetivo

- **Problema:** la tarea de un error es única e inmutable. `assertEditable` rechaza `task` (`src/store/error-records.ts:417-421`), así que un error registrado en la tarea equivocada se queda ahí para siempre.
- **Resultado esperado:** reasignar un error a otra tarea, con una nota obligatoria que quede en su historial. La descripción menciona, además o en su lugar, «tareas relacionadas» (D1).
- **Evidencia del sistema actual:**
  - La lista de errores de una tarea se calcula al leer: `errorsForTask` filtra por `e.task` (`error-records.ts:198`). La usan `wf_get` (`src/mcp.ts:179`) y la web (`src/server.ts:249`).
  - `wf_errors task_id` filtra por `e.task` (`mcp.ts:583`).
  - `createError` comprueba que la tarea existe con `readTask` dentro del bloqueo (`error-records.ts:381-382`).
  - `readForWrite` bloquea la escritura de errores con un estado desconocido.
  - El nombre del archivo no depende de la tarea.

## Alcance

- **Incluido:**
  - Reasignar con `wf_error action: "update"`, `task_id` y una `note` obligatoria.
  - Entrada en el historial del error.
  - i18n, pruebas, README, skill y `dist`.
- **Excluido:**
  - Tareas relacionadas (opción B, D1), salvo que decidas lo contrario.
  - Reasignar desde la web, que sigue siendo de solo lectura para los errores.
  - Reasignar en `resolve`, `note` o `discard`.
  - Cambiar el título u otros campos inmutables.
  - Commit y actualización del plugin.

## Decisiones de la mesa redonda

**Las marcadas con (P) necesitan tu confirmación**; si no dices nada, la aprobación del plan las acepta como están.

| # | Decisión | Evidencia y motivo | Alternativas descartadas | Riesgo o consecuencia |
| --- | --- | --- | --- | --- |
| D1 (P) | **Solo reasignar (opción A).** Las tareas relacionadas (B: `related: [WAY-5, …]`) se dejan para una tarea aparte, si hace falta. | El título dice «cambiar la tarea… **o** ligarlo a varias». A cubre el problema descrito (un error en la tarea equivocada) y no cambia el modelo. B añade una clave nueva y cambia `errorsForTask` (y con ello `wf_get`, la web y `wf_errors`) en unos cinco puntos. Ninguna fuente pide B con un caso concreto (solución mínima, negador y seguridad). | A+B: alcance medio-alto sin un caso real. B solo: no corrige un error mal ligado. | Un error que afecta de verdad a dos tareas sigue ligado a una sola, y la nota puede mencionar la otra. |
| D2 | **La nota es obligatoria** al cambiar la tarea. El historial del error recibe «Task: WAY-3 -> WAY-5.» seguido de la nota, en la misma escritura y en un único commit. | La tarea era inmutable para conservar la evidencia; el historial conserva la trazabilidad (seguridad). | Reasignar sin nota. | — |
| D3 | **Validación dentro del bloqueo**: `assertId` y `readTask` sobre el mismo proyecto. Una tarea inexistente o con un formato inválido da error, sin escribir nada. Reasignar a la misma tarea, sin ningún otro cambio, da «nada que actualizar». | Mismo control que `createError`. | — | Las tareas de otro proyecto no existen en este, así que se rechazan. |
| D4 | **Se permite en errores abiertos, resueltos y descartados**; un estado desconocido sigue bloqueado por `readForWrite`. La reasignación no cambia el estado. | Corregir a qué tarea pertenece un error no cambia si está resuelto. | Solo abiertos: obligaría a reabrir para corregir un dato. | — |
| D5 | **Combinable** con otros campos editables en la misma llamada. La entrada del historial menciona `task` entre los campos cambiados. | Sigue el patrón de `applyPatch`. | — | — |
| D6 | **Web sin cambios**: la lista de errores de cada tarea y el enlace del error se calculan al leer, así que reflejan la tarea nueva. | `server.ts:249` y `server.ts:262-273`. | — | — |

## Preguntas que requieren decisión del usuario

- **D1 (P):** ¿solo reasignar (recomendado) o también tareas relacionadas en este plan?

## Plan de implementación

1. `src/store/error-records.ts`:
   - `task` sale de la lista inmutable de `assertEditable` (el título sigue siendo inmutable).
   - En `updateError`, si llega `task`: nota obligatoria, `assertId` y `readTask` dentro del bloqueo, comprobación de que la tarea cambia, `record.task` actualizado y la entrada «Task: A -> B.» con la nota.
   - `resolveError` sigue rechazando `task`.
   - Comentario breve sobre el límite (una sola tarea por error).
   - Validación: tests de store.
2. `src/mcp.ts`:
   - Descripción de `wf_error`: `task_id` es válido en `update` junto con una `note`, y deja de figurar en «no pueden cambiar».
   - Error claro si llega `task_id` en `note`, `discard` o `resolve`.
3. `src/i18n/es.json` y `src/i18n/en.json`: los errores nuevos («cambiar la tarea necesita una nota» y «la tarea ya es esa»).
4. Pruebas:
   - `test/error-records.test.ts`:
     - reasignar con nota en un error abierto, en uno resuelto y en uno descartado;
     - sin nota, tarea inexistente, ID inválido y misma tarea;
     - estado desconocido;
     - un solo commit;
     - historial anterior intacto más la entrada nueva;
     - `errorsForTask` de las dos tareas.
   - `test/mcp.integration.test.ts`:
     - `wf_error update` con `task_id` y `note`;
     - `wf_get` de las dos tareas;
     - `wf_errors task_id`;
     - `task_id` en `resolve` rechazado.
   - `test/server.test.ts`: la lista de errores de la tarea nueva incluye el error reasignado.
   - Validación: `npm test`.
5. `README.md` (sección «Registro de errores»), `plugin/skills/wayfinder/SKILL.md` (sección Errors: cómo reasignar), `ERRORES.md` sin cambios y `dist`.
   - Validación: `npm run check:dist`.

## Criterios de aceptación

- [ ] `wf_error update` con `task_id` y `note` mueve el error a otra tarea existente del mismo proyecto, en un solo commit.
- [ ] El historial del error conserva todo lo anterior y añade «Task: A -> B.» con la nota.
- [ ] Sin nota, con una tarea inexistente o inválida, o con la misma tarea, da un error claro y no escribe nada.
- [ ] `wf_get`, `wf_errors task_id` y la web muestran el error en la tarea nueva y no en la anterior.
- [ ] El título y los campos observados (contexto, reproducción y salida) siguen sin poder cambiarse.
- [ ] `npm run typecheck`, `npm test` y `npm run check:dist` en verde.

## Estrategia de validación

- **Pruebas específicas:** store, integración MCP y servidor.
- **Validaciones amplias:** `npm run typecheck`, `npm test` y `npm run check:dist`. `test:e2e` no aplica: la web no cambia.
- **Verificación funcional:** reasignar un error de prueba con el cliente MCP y comprobarlo en la web local con datos de prueba. El uso desde una sesión real queda **no verificado** hasta que actualices el plugin.
- **Seguridad:** la validación se hace dentro del bloqueo, la nota pasa por `assertNoSecrets`, el historial nunca se reescribe y `saveUnlocked` restaura el archivo si el commit falla.

## Riesgos y reversión

- **Riesgo:** perder la trazabilidad de dónde se registró el error. Mitigación: la entrada de creación («Created (task: X)») y la de reasignación quedan en el historial.
- **Riesgo:** una versión anterior que lea el error. Mitigación: el formato no cambia (`task` sigue siendo un solo ID).
- **Reversión:** revertir el código. Los errores reasignados siguen siendo válidos.

## Desacuerdos residuales

- La recomendación inicial del responsable era A+B. La mesa (solución mínima, negador y seguridad) recomienda solo A, porque el título dice «o» y B no tiene un caso concreto. Se adopta A, pendiente de tu confirmación (D1).

## Notas de implementación

> Anotaciones posteriores a la aprobación. No cambian el alcance aprobado.

- **2026-11-13:**
  - `updateError` acepta `task`, con la nota obligatoria (`store.errorTaskNeedsNote`) y `readTask` dentro del bloqueo. La entrada del historial es «Updated. Task: A -> B. Fields: …» seguida de la nota.
  - `resolveError` rechaza `task` con `store.errorTaskOnlyInUpdate`. En `note` y `discard` ya se rechazaba desde el MCP.
  - El test existente «update changes only editable fields» deja de considerar `task` inmutable: es el cambio de comportamiento pedido.
  - Validación: tests nuevos en `test/error-records.test.ts`, `test/mcp.integration.test.ts` y `test/server.test.ts`; `npm run typecheck`, `npm test` (169/169) y `npm run check:dist`.
  - **No verificado:** el uso desde una sesión real de Claude, que necesita actualizar el plugin instalado.
