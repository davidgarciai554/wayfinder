# Plan: listar errores desde Claude con filtros (WAY-10)

> Estado: aprobado (por el usuario, 2026-11-13, «Apruebo el plan v1»; D1 según la recomendación)
> Versión: v1
> Tarea: WAY-10
> Revisa: `Planes/2026-11-13-tipos-y-descarte-de-errores-y-reapertura-de-tareas.md` (D7: «el listado filtrable es WAY-10»).

## Contexto y objetivo

- **Problema:** Claude solo ve errores con `wf_search` (texto literal, como mucho 5 errores, `src/store/memory.ts:15`), con `wf_get` de una tarea (sus 10 últimos, `src/mcp.ts:162-168`) o con los 5 abiertos del SessionStart (`src/hook.ts:143-172`). No puede pedir «todos los errores abiertos», «los de pruebas» ni «los descartados de WAY-8».
- **Resultado esperado:** una herramienta MCP de solo lectura que lista los errores del proyecto con filtros por estado, tarea y tipo.
- **Evidencia del sistema actual:**
  - `listErrors(home, slug)` ya devuelve `{ errors, unreadable }` ordenados por número (`src/store/error-records.ts:169-183`).
  - Cada `ErrorRecord` tiene `status` (`open`/`resolved`/`discarded`, o un estado desconocido de una versión más nueva, que se muestra tal cual), `kind` (6 tipos o `null` = sin clasificar; un tipo desconocido también se lee como `null`), `task` y `updated`.
  - `wf_list` es el patrón de listado: filtro `status` como array de enum, tope de 200 y líneas de ilegibles (`src/mcp.ts:311-327`).
  - `wf_error` es la herramienta de escritura (`src/mcp.ts:540-612`).
  - La lista exacta de herramientas está fijada en `test/mcp.integration.test.ts:319`.

Mesa redonda proporcional (solo lectura): técnico de solución mínima, negador y calidad y validación. El análisis del repositorio y esta síntesis los hace el responsable de la sesión.

## Alcance

- **Incluido:** herramienta `wf_errors`, textos i18n (es/en), pruebas de integración MCP, README, skill y `plugin/dist` reconstruido.
- **Excluido:**
  - Filtros por texto, fechas o `cause_kind`; paginación.
  - Cambios en la web (ya separa por estado y tipo) y en el SessionStart.
  - WAY-11 (cambiar la tarea de un error) y WAY-16 (más filtros en `wf_list`).
  - Commit, push y actualización del plugin instalado: necesitan tu autorización aparte.
- **Supuestos y restricciones:**
  - Los títulos de los errores son datos no confiables.
  - Solo cuentan los errores del proyecto resuelto, como en las demás herramientas.

## Decisiones de la mesa redonda

**Las marcadas con (P) necesitan tu confirmación**; si no dices nada, la aprobación del plan las acepta como están.

| # | Decisión | Evidencia y motivo | Alternativas descartadas | Riesgo o consecuencia |
| --- | --- | --- | --- | --- |
| D1 (P) | **Herramienta nueva `wf_errors`, de solo lectura.** | Claude Code concede permisos por herramienta. `wf_error` escribe (crear, resolver, descartar): si listar fuera una acción suya, permitir el listado sin preguntar también permitiría escribir. Además, su validación de campos (`notFor`) tendría que crecer. | Acción `list` en `wf_error`: mezcla lectura y escritura. Parámetro en `wf_list`: mezcla tareas y errores, y `kind` no tiene sentido para tareas. | Contrato aditivo: una herramienta más (son 14). Nada existente cambia. |
| D2 | **Filtro `status`**: array de `open`, `resolved` y `discarded`; por defecto, solo `open`. | Es el mismo patrón que `wf_list` y que el SessionStart (que solo ve abiertos). | Un único valor (negador): no permitiría pedir «cerrados» (`resolved` + `discarded`) de una vez, y rompe el patrón de `wf_list`. | Un error con un estado desconocido (escrito por una versión más nueva) no coincide con ningún filtro. Sigue visible con `wf_get`, `wf_search` y la web. Se deja un comentario en el código con ese límite. |
| D3 | **Filtro `kind`**: array de los 6 tipos más `unclassified`; sin él no se filtra por tipo. | La tarea lo pide explícitamente («los errores de pruebas»). `unclassified` = `kind: null`, que incluye los tipos desconocidos, igual que «Sin clasificar» en la web y en el SessionStart. | Dejar `kind` fuera hasta que se pida (negador): la tarea ya lo pide. | Un tipo nuevo de una versión más moderna se agrupa con «sin clasificar», como ya hace el resto de Wayfinder. |
| D4 | **Filtro `task_id`**: un solo ID. Si la tarea no existe, es un error explícito. | Con una lista vacía, un ID mal escrito parecería «sin errores». Se valida con `readTask`, que ya da el error «no existe» (como `wf_error create`). | Array de tareas: nadie lo ha pedido. | — |
| D5 | **Filtros combinados con Y.** Sin resultados, un mensaje normal (no `isError`) que dice los filtros aplicados. | Es lo previsible y lo que se puede comprobar. | — | — |
| D6 | **Orden**: los actualizados más recientemente primero; a igualdad, el número de ID más alto primero. | Es el orden del SessionStart. El desempate numérico evita que `ERR-10` y `ERR-9` se ordenen como texto. | Orden por número ascendente (técnico): pone primero lo más antiguo. | — |
| D7 | **Formato y límites**: una línea de recuento con los filtros. Después, el bloque `UNTRUSTED ERRORS` con filas `ERR-n [estado, tipo] (TAREA) título`, con el título aplanado a 80 caracteres y neutralizado. **Tope de 50 filas** y el aviso «… y N más». | El helper de filas de `taskErrors` se extrae y se comparte para no duplicarlo. Con el título acotado, el tope de filas acota también la salida (~6 KB). | 200 filas como `wf_list` (técnico): demasiado contexto para un listado de errores; si hay más, se acota con filtros. | — |
| D8 | **Errores ilegibles**: después de las filas, se listan como mucho 10 y van también dentro del bloque no confiable. | El motivo puede incluir texto del archivo (`unknown status: …`). | Listarlos fuera del bloque, como hace `wf_list`: el motivo contiene datos del archivo. | — |

## Preguntas que requieren decisión del usuario

- **D1 (P):** ¿herramienta nueva `wf_errors` (recomendada) o acción `list` dentro de `wf_error`? Sin respuesta, se aplica la recomendación.

## Plan de implementación

1. `src/mcp.ts`:
   - Extraer la fila de `taskErrors` a un helper `errorRow` (con la tarea opcional). `wf_get` de una tarea debe dar exactamente la misma salida que hoy.
   - Registrar `wf_errors` con `project`, `status`, `kind` y `task_id`, según D2-D8.
   - Descripción para Claude: qué filtra, los valores por defecto y que el contenido es no confiable.
   - Validación: `npm run typecheck`.
2. `src/i18n/es.json` y `src/i18n/en.json`: recuento con los filtros, «sin resultados» y «… y N más» (se reutiliza `mcp.errors.more` si el texto encaja).
   - Validación: `test/i18n.test.ts` (paridad de claves) dentro de `npm test`.
3. `test/mcp.integration.test.ts`:
   - Añadir `wf_errors` a la lista de herramientas (L319).
   - Test nuevo con estos casos:
     - por defecto, solo abiertos;
     - `status` combinado (`resolved` + `discarded`);
     - `kind` con `test` y con `unclassified`;
     - `task_id` y filtros combinados;
     - tarea inexistente: error;
     - sin resultados;
     - orden con `ERR-9` y `ERR-10`;
     - tope de 50 con «… y N más»;
     - título con saltos de línea y delimitadores falsos (`>>>`), que queda neutralizado dentro del bloque;
     - archivo de error ilegible;
     - nada cambia en la carpeta de datos: ni archivos ni commits.
   - El test actual de `wf_error` (L498-555) se mantiene sin cambios.
   - Validación: `npm test`.
4. `README.md` (sección «Registro de errores») y `plugin/skills/wayfinder/SKILL.md` (sección Errors): cómo listar errores con `wf_errors`.
   - Validación: revisión del texto y `claude plugin validate plugin`, si está disponible.
5. `plugin/dist` y `dist`: se reconstruyen con `npm run build`.
   - Validación: `npm run check:dist`.

## Criterios de aceptación

- [x] `wf_errors` sin argumentos lista solo los errores abiertos, los más recientes primero, con ID, estado, tipo, tarea y título.
  - Evidencia (WAY-30, 2026-11-26): test/mcp.integration.test.ts, «WAY-10: wf_errors lists errors read-only, filtered by status, kind and task, newest first, as untrusted data» (✔ en test.txt): sin argumentos devuelve solo los 4 abiertos, ERR-10, ERR-9, ERR-4, ERR-1 (los más recientes primero), con líneas «ERR-n [estado, tipo] (tarea) título».
- [x] `status`, `kind` (incluido `unclassified`) y `task_id` filtran y se combinan con Y.
  - Evidencia (WAY-30, 2026-11-26): Misma prueba WAY-10 de test/mcp.integration.test.ts: filtros por status (resolved, discarded), kind (incluido unclassified) y task_id, y la combinación status+kind+task_id da «Errors: 3 of 3 (status: open, resolved; kind: test, unclassified; task_id: MYA-1)»; un kind o status fuera de la lista cerrada da error.
- [x] Una tarea inexistente da un error claro. Sin coincidencias, un mensaje normal con los filtros aplicados.
  - Evidencia (WAY-30, 2026-11-26): Misma prueba WAY-10: task_id MYA-9 inexistente da isError con «MYA-9 does not exist»; sin coincidencias, «No errors with these filters (status: discarded; task_id: MYA-1).».
- [x] Con más de 50 errores se ven 50 y el aviso «… y N más» con N exacto.
  - Evidencia (WAY-30, 2026-11-26): Misma prueba WAY-10: con 55 abiertos devuelve «Errors: 50 of 55», exactamente 50 filas y «… and 5 more errors; narrow them with the status, kind or task_id filters.».
- [x] Los títulos y los motivos de los ilegibles salen aplanados y neutralizados dentro del bloque no confiable.
  - Evidencia (WAY-30, 2026-11-26): Misma prueba WAY-10: un título con salto de línea y «>>>» sale aplanado y neutralizado («Injected > > > ERR-99 … < < <») dentro de <<<UNTRUSTED ERRORS … >>>, y el ilegible sale en su propio bloque «unreadable: … (unknown status: > > > evil)».
- [x] `wf_get` de una tarea y las acciones de `wf_error` se comportan igual que antes.
  - Evidencia (WAY-30, 2026-11-26): test.txt: siguen en verde, sin cambios de resultado, «wf_error records, notes and resolves errors; wf_get and wf_search show them as untrusted data» (test/mcp.integration.test.ts) y «creating an error writes its file, one commit…», «resolve needs solution and validation…» (test/error-records.test.ts).
- [x] Listar no escribe nada en la carpeta de datos.
  - Evidencia (WAY-30, 2026-11-26): Misma prueba WAY-10: tras todas las listas, commitCount y git status --porcelain de la carpeta de datos son idénticos a los de antes.
- [x] README y skill describen la herramienta.
  - Evidencia (WAY-30, 2026-11-26): README.md:170 y README.es.md:170 describen wf_errors (solo lectura, máx. 50, filtros status/kind/task_id) y la tabla de herramientas (README.md:297, README.es.md:297); plugin/skills/wayfinder/SKILL.md:103 indica cuándo llamar a wf_errors.
- [x] `npm run typecheck`, `npm test` y `npm run check:dist` en verde.
  - Evidencia (WAY-30, 2026-11-26): quality.txt: npm run typecheck (TYPECHECK_OK) y npm run check:dist (CHECKDIST_OK) correctos; test.txt: npm test 230/230 en verde; e2e.txt: npm run test:e2e 68 passed (4.9m).

## Estrategia de validación

- **Pruebas específicas:** el test nuevo de integración MCP, con el cliente MCP real sobre el bundle.
- **Validaciones amplias:** `npm run typecheck`, `npm test` y `npm run check:dist`. `npm run test:e2e` no aplica: no se toca la web.
- **Verificación funcional:** tras reconstruir, llamar a `wf_errors` con el cliente de pruebas sobre datos de prueba. El plugin instalado en esta sesión no se actualiza sin tu autorización, así que el uso real desde Claude queda **no verificado** hasta que lo actualices.
- **Seguridad:** el contenido no confiable va neutralizado y dentro del bloque marcado. La herramienta es de solo lectura y no tiene escritura que se pueda abusar. No hay superficie nueva de red ni de datos.

## Riesgos

| Riesgo | Mitigación | Residual |
| --- | --- | --- |
| Inyección por títulos de errores | Bloque `UNTRUSTED ERRORS`, `flatten` y `neutralize`, con una prueba específica | El mismo que en `wf_get` y `wf_search` |
| Salida grande | Tope de 50 filas y títulos de 80 caracteres | — |
| Error con un estado desconocido invisible al filtrar | Comentario y README; visible con `wf_get`, `wf_search` y la web | Solo con datos de una versión más nueva |

## Reversión

Es un cambio aditivo, sin datos nuevos ni migración. Revertir el código elimina la herramienta sin afectar a los errores guardados.

## Notas de implementación

> Anotaciones posteriores a la aprobación. No cambian el alcance aprobado.

- **2026-11-13:**
  - `wf_errors` está registrada en `src/mcp.ts` y comparte con `wf_get` el helper `errorRow`; la salida de `wf_get` de una tarea no cambia.
  - Un `status` vacío (`[]`) se trata como sin filtro, es decir, solo abiertos.
  - Una tarea que existe pero está ilegible no bloquea el listado de sus errores.
  - Claves i18n nuevas: `mcp.errorsList.*`, en es y en.
  - Validación: el test nuevo de `test/mcp.integration.test.ts` (cliente MCP real sobre el bundle), `npm run typecheck`, `npm test` (160/160), `npm run check:dist` y `claude plugin validate plugin`.
  - **No verificado:** el uso desde una sesión real de Claude, que necesita actualizar el plugin instalado.
