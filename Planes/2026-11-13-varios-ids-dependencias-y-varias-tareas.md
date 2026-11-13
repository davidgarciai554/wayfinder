# Plan: varios IDs por orden, dependencias entre tareas y varias tareas por mensaje (WAY-18, WAY-15, WAY-19)

> Estado: aprobado (por el usuario, 2026-11-13, «Apruebo plan v1»; decisiones (P) según la recomendación)
> Versión: v1
> Tareas: WAY-18 (aprobación por chat con varios IDs, corrige ERR-5), WAY-15 (dependencias entre tareas), WAY-19 (varias tareas en un mensaje: una sesión por tarea y orden por dependencias)
> Revisa: `docs/design/DESIGN.md` (detalle de tarea y tarjeta). Aprobar este plan aprueba también esos cambios.

## Contexto y decisiones ya tomadas por la persona (2026-11-13)

- **ERR-5:** «apruebo las tres tareas WAY-8, WAY-9 y WAY-12» no registró ninguna orden. `extractOrders` (`src/store/mentions.ts`) solo mira las 3 palabras anteriores a cada ID, y cada ID previo de la lista («way») le quita una.
- Decisiones de la persona:
  1. Cuenta como orden un verbo seguido de una **lista** de IDs unidos por comas, «y», «e» o «and», con hasta 3 palabras de relleno.
  2. Si pide varias tareas: las **independientes, una sesión cada una**; si una depende de otra, la **misma sesión hace primero la que libera** y luego la bloqueada. Una sola tarea se queda en el chat.
  3. Las dependencias son **explícitas** (WAY-15).
  4. El bucle recorre **solo las tareas nombradas** (y las que las desbloquean).

Mesa redonda de solo lectura: analista, solución mínima, negador, seguridad y datos, calidad y validación, accesibilidad y experiencia.

## Decisiones

Cada decisión lleva la recomendación de la mesa. **Las marcadas con (P) necesitan tu confirmación**; si no dices nada, la aprobación del plan las acepta tal como están.

### WAY-18: varios IDs en una orden

| # | Decisión | Recomendación | Alternativas descartadas y motivo |
| --- | --- | --- | --- |
| D1 | Gramática | Verbo de aprobación, como mucho 3 palabras de relleno (sin contar los IDs) y una lista `ID (separador ID)*`. Separadores: `,`, `y`, `e`, `and`, `, y`, `, and`. La lista termina en el primer elemento que no encaja: lo que va después no cuenta («aprueba WAY-8 y luego mira WAY-9» → solo WAY-8). | Contar cualquier ID de la frase: descartado por ti. |
| D2 | Negaciones, preguntas, código y citas | Siguen sin ser orden. Una negación en el relleno anula la lista entera («no apruebes WAY-8, WAY-9» → nada). «pero», «excepto», «salvo» o «but» cortan la lista: «aprueba WAY-8 pero no WAY-9» → solo WAY-8. Una frase con `¿?` se descarta entera, como hoy. | — |
| D3 | Rangos y listas sin separador | No se reconocen: «WAY-8 a WAY-12» → solo WAY-8; «WAY-8 WAY-9» → solo WAY-8. Un rango aprobaría IDs que no escribiste. | Expandir rangos. |
| D4 (P) | Tope por mensaje | Como mucho **10 IDs** por mensaje. Si hay más, no se registra **ninguna** orden (frena un texto pegado con una lista larga). | Seguridad proponía 5; 10 te deja aprobar una tanda normal de una vez. Truncar: descartado, porque aprobaría una parte arbitraria. |
| D5 (P) | Verbos «haz / empieza / do / start» | Siguen contando como orden de aprobación, también en listas, como decidió el plan del MVP. «haz WAY-3 y WAY-4» sobre dos propuestas permite aprobarlas, siempre con `wf_review`, cita con el ID y el resto de controles de cada una. | Que solo «aprueba / approve» sirvan para listas (objeción del negador): más estricto, pero «haz WAY-3, WAY-4» ya no aprobaría propuestas y tendrías que escribir dos órdenes. |

### WAY-15: dependencias

| # | Decisión | Recomendación | Alternativas descartadas y motivo |
| --- | --- | --- | --- |
| D6 | Campo | `depends_on: [WAY-2, …]` en el frontmatter (el YAML ya admite listas; las claves se conservan). Al leerlo se tolera cualquier cosa: un valor que no sea una lista de IDs se trata como vacío, sin dejar la tarea ilegible. | — |
| D7 | Quién lo escribe | Solo `wf_update` con `depends_on` (sustituye la lista; `[]` la vacía). Validación bajo el bloqueo: formato de ID, tarea existente del mismo proyecto, no ella misma, sin repetidos, máximo 20 y **sin ciclos**. Todo con errores claros y sin escribir. | Escribirlo también en `wf_create` o en la web: nadie lo ha pedido; con dos llamadas basta. |
| D8 | ¿Entra en el hash de la revisión? | **No.** Es un dato de planificación que nunca autoriza nada, y meterlo invalidaría revisiones sin motivo. | Incluirlo (seguridad): «la persona aprueba lo que ve»; quedaría como desacuerdo menor. |
| D9 | Qué libera | Solo `done` libera. Una dependencia `proposed`, `todo` o `in-progress` bloquea. Una `discarded` se marca «descartada: revisa la dependencia» y sigue bloqueando hasta que alguien la quite. Si la dependencia no existe, se marca «no encontrada» y no bloquea. | Que «descartada» libere: ocultaría un bloqueo que hay que revisar. |
| D10 | Efecto | Solo informativo: **nunca bloquea** ni lanza nada. Al pasar a `in-progress` una tarea con dependencias abiertas, `wf_set_status` cambia el estado y devuelve un **aviso**. | Bloqueo duro: no pedido. |
| D11 | Dónde se ve | `wf_get` (dependencias con su estado), `wf_list` («bloqueada por WAY-n») y la web. SessionStart no cambia (tope de 4000 caracteres; Claude usa `wf_list`). | Mostrarlo en SessionStart: gasta presupuesto. |
| D12 (P) | Web | **Solo lectura.** En el detalle, una fila «Depende de» con cada tarea enlazada y su estado en texto. En la tarjeta, una etiqueta «Bloqueada por WAY-n» (o «WAY-n +1» si hay varias) con icono y texto, que reutiliza los tokens `--wf-flag-outside-*`, sin colores nuevos. El enlace no va dentro del enlace del título. | Editarlas en la web: formulario, ciclos y diseño nuevos, sin petición. No mostrarlas: el tablero es tu vista principal. |

### WAY-19: varias tareas en un mensaje

| # | Decisión | Recomendación | Alternativas descartadas y motivo |
| --- | --- | --- | --- |
| D13 | Código o skill | **Solo la skill** (`plugin/skills/wayfinder/SKILL.md`), apoyada en las dependencias visibles de WAY-15. El plugin no puede abrir sesiones: lo hace Claude con la herramienta de Claude Code Desktop. | Una herramienta MCP que ordene, o un hook que detecte varias tareas: más superficie para pocos IDs, y los ciclos ya no pueden existir (D7). Se reconsidera si la skill ordena mal en la práctica. |
| D14 | Conjunto | Las tareas nombradas en tu mensaje más, de forma transitiva, sus dependencias **abiertas en `todo` o `in-progress`**. Si una dependencia está en `proposed`, Claude para y te pide aprobarla; nunca la aprueba. No se barren las demás pendientes. | — |
| D15 | Reparto | Una tarea → este chat. Varias: cada grupo independiente va a su propia sesión, que trabaja en su propio worktree cuando edita código (`AGENTS.md`: edición paralela aislada). Cada cadena de dependencias va en una sola sesión, primero la que libera. Sin herramienta de sesiones (CLI), todo en este chat, en ese orden, avisando de que no puede abrir sesiones. | Sesiones compartiendo la carpeta: riesgo de editar los mismos archivos a la vez. |
| D16 | Límites del bucle | El bucle **no aprueba propuestas ni planes**. Cada tarea no trivial sigue necesitando su plan aprobado. Si falta el plan, hay un error o algo no encaja, la sesión para y dice qué tarea, por qué y qué necesita de ti, sin saltar a la siguiente. | — |
| D17 | Comunicación | Antes de empezar, una frase con el reparto (p. ej. «WAY-3 y WAY-5 independientes: una sesión cada una. WAY-7 depende de WAY-2: primero WAY-2»). Al acabar cada tarea, «WAY-2 hecha (1/2); sigo con WAY-7». Con una sola tarea no hay explicación de reparto. | — |

## Alcance

**Incluido**
- `src/store/mentions.ts` (lista de IDs, tope), `src/store/tasks.ts` (`dependsOn`, validación, aviso en `setStatus`), `src/mcp.ts` (`wf_update.depends_on`, `wf_get`, `wf_list`), `src/server.ts` (dependencias con estado en los metadatos de la tarea), `web/app.js` y `web/styles.css` (fila y etiqueta), `src/i18n/es.json` y `en.json`.
- `plugin/skills/wayfinder/SKILL.md`, `README.md`, `docs/design/DESIGN.md`.
- Pruebas, `plugin/dist` reconstruido. Al cerrar ERR-5 se resuelve también en Wayfinder y en `ERRORES.md`.

**Excluido**
- Rangos, edición de dependencias en la web o en `wf_create`, dependencias entre proyectos y herramientas MCP nuevas.
- Orquestar sesiones desde el plugin y recorrer todas las pendientes.
- Commit, push y operaciones fuera del repositorio sin tu autorización.

## Incrementos

En este orden: ERR-5 es independiente y pequeño; WAY-15 es el contrato de datos; WAY-19 depende de los dos. Cada uno se cierra con su `wf_log` y su tarea a `done`. **Sin commits** salvo que los pidas.

### Incremento 1: WAY-18 (ERR-5)
1. `extractOrders`: lista encadenada tras el primer ID con verbo (D1-D3), tope (D4). `findPhrase` (registrar proyecto, abrir la web) no cambia.
2. Tests en `test/chat.test.ts`: se añaden casos sin quitar los actuales:
   - **Sí son orden:** las dos frases de ERR-5, «and», «e», sin duplicados.
   - **No son orden:** «pero no», «y luego mira», otro prefijo, negación en el relleno, relleno de 4 palabras, rango, sin separador, pregunta, cita, código y 11 IDs.
   - **Extremo a extremo:** tres aprobaciones con `approveByChat`.
- **Validación:** `node --test test/chat.test.ts test/hook.test.ts`, después `npm test` y `npm run check:dist`.

### Incremento 2: WAY-15
1. `Task.dependsOn`, lectura tolerante y escritura (`[]` borra la clave). `updateTask` valida (D7) bajo el bloqueo.
2. `setStatus` → `in-progress` con dependencias abiertas devuelve un aviso (D10).
3. MCP: `wf_update` acepta `depends_on`; `wf_get` muestra cada dependencia con su estado; `wf_list` añade «bloqueada por».
4. Servidor y web (D12), i18n, `DESIGN.md`, README.
- **Validación:**
  - `test/store.test.ts` (validaciones, ciclo largo, colgante, compatibilidad, aviso);
  - `test/mcp.integration.test.ts`, `test/server.test.ts`, `test/concurrency.test.ts` (dos actualizaciones que juntas formarían un ciclo);
  - e2e en `e2e/read.spec.ts` con el fixture (bloqueada, libre, no encontrada, 320 px, inglés);
  - `npm test`, `npm run test:e2e`, `npm run check:dist` y revisión visual.

### Incremento 3: WAY-19
1. Sección nueva de la skill con D13-D17, y README.
- **Validación:**
  - Revisión del texto contra las decisiones.
  - **Prueba manual en Claude Code Desktop:** pedir tres tareas, dos independientes y una dependiente. Se anotan las sesiones abiertas, el orden y la parada ante un plan que falta.
  - Sin ese recorrido real, queda **no verificado**: el comportamiento del modelo no es determinista.

## Criterios de aceptación

- [ ] «aprueba WAY-8, WAY-9 y WAY-12» y «apruebo las tres tareas WAY-8, WAY-9 y WAY-12» registran los tres IDs; con «and» y con «e», igual.
- [ ] Los casos actuales de no-orden siguen igual. «aprueba WAY-8 pero no WAY-9» registra solo WAY-8. Una negación en el relleno, una pregunta, una cita, el código, un rango, una lista sin separador, un ID de otro prefijo y una lista de 11 IDs no amplían nada.
- [ ] Tres propuestas pasan a `todo` con una sola orden, cada una con su `wf_review` y su cita.
- [ ] `wf_update` con `depends_on` válido se guarda. Se rechazan sin escribir nada el ID inexistente, el de otro proyecto, la autodependencia, el repetido, el que pasa de 20 y el ciclo (también uno de 3 tareas).
- [ ] Una tarea sin `depends_on`, o con un valor inválido escrito a mano, se lee igual y no queda ilegible.
- [ ] `wf_get` y `wf_list` muestran las dependencias. Pasar a `in-progress` con una abierta avisa sin bloquear.
- [ ] La web muestra «Depende de» y «Bloqueada por WAY-n» en texto, con teclado y sin desbordar a 320 px.
- [ ] La skill describe D13-D17. La prueba en Desktop se hace o queda marcada como no verificada.
- [ ] `npm run typecheck`, `npm test`, `npm run test:e2e` y `npm run check:dist` en verde.

## Riesgos

| Riesgo | Mitigación | Residual |
| --- | --- | --- |
| Orden falsa por una lista (texto pegado) | Gramática cerrada y contigua, tope de 10 sin truncar, y por cada ID siguen haciendo falta `wf_review`, hash, cita y origen `claude` | El texto pegado sin citar cuenta como tuyo, como hoy (README) |
| «haz X, Y» aprueba propuestas sin querer (D5) | Cada ID necesita su revisión con veredicto antes de aprobarse, y Claude te dice cuáles aprueba | Tu decisión en D5 |
| Sesiones paralelas que editan lo mismo | Un worktree por sesión que edita (D15) | Conflictos de integración al juntar ramas: los resuelves tú, según las reglas de Git |
| El bucle salta la regla del plan | D16 y la regla del plan en `wf_set_status` | Depende de que Claude siga la skill |
| Comportamiento del modelo (WAY-19) | Prueba manual | No determinista |

## Reversión

Son cambios de código sin commit hasta que lo autorices. `depends_on` es una clave opcional: si se revierte el código, las tareas siguen siendo legibles y la clave se conserva.

## Preguntas abiertas

Las decisiones (P): D4, D5 y D12. Sin respuesta, se aplica la recomendación.

## Notas de implementación

> Anotaciones posteriores a la aprobación. No cambian el alcance aprobado.

- **Incremento 1, WAY-18 (2026-11-13):** la ventana del verbo (4 palabras: verbo y 3 de relleno) se cuenta desde el ID anterior, así que los IDs previos no la llenan; los IDs unidos por un separador heredan el veredicto del primero. `findPhrase` no cambia. Validación: `test/chat.test.ts` 21/21, `npm test` 153/153, `check:dist`. ERR-5 resuelto.
- **Incremento 2, WAY-15 (2026-11-13):**
  - `Task.dependsOn` se lee de `depends_on` con tolerancia (se quedan solo los IDs válidos, sin repetidos). `updateTask` valida fuera del bloqueo (formato, la propia tarea, repetidos, máximo 20) y dentro (existencia y ciclo con búsqueda en profundidad).
  - `setStatus` → `in-progress` añade el aviso `store.dependenciesOpen` después del commit.
  - `taskMeta` y `wf_get`/`wf_list` usan `dependencyStates`.
  - La etiqueta de la tarjeta no lleva enlace propio; los enlaces están en el detalle.
  - Validación: `test/store.test.ts` (validaciones, ciclo de 3, lectura tolerante, aviso), `test/concurrency.test.ts` (dos procesos que juntos cerrarían un ciclo: uno se guarda y el otro se rechaza), `test/mcp.integration.test.ts`, `test/server.test.ts`, `e2e/read.spec.ts`. `npm test` 159/159, `npm run test:e2e` 45/45, `check:dist`; capturas a 1280 y 390 px.
- **Incremento 3, WAY-19 (2026-11-13):** secciones «Dependencies» y «Several tasks in one message» en `plugin/skills/wayfinder/SKILL.md` (D13-D17) y «Pedir varias tareas a la vez» en el README. Validación: revisión del texto contra D13-D17 y `claude plugin validate plugin` correcto. **No verificado:** la prueba manual en Claude Code Desktop (abrir una sesión por grupo independiente, el orden de la cadena y la parada ante un plan que falta), que depende del comportamiento del modelo.
- **Revisión independiente (2026-11-13):** sin P0 ni P1. Correcciones aplicadas:
  - **P2:** la ventana de 4 palabras también se aplicaba a un ID suelto y a los verbos genéricos, así que «haz un resumen de WAY-8» contaba como orden. Ahora solo «aprueba/apruebo/apruébala/aprobar/approve» llegan a 3 palabras de relleno; «haz/empieza/arranca/do/start» siguen con 2, como antes. Cada ventana comprueba sus propias negaciones. Hay casos negativos nuevos en `test/chat.test.ts`.
  - **P3:** la marca «bloqueada por» solo aparece en tareas `proposed`, `todo` o `in-progress` (`wf_list` y la web).
  - **P3 (skill):** una dependencia `proposed` o `discarded` detiene la cadena. Una tarea nombrada que es una propuesta sigue la sección de aprobación. El brief de una sesión hija lista los IDs sin verbos de aprobación, porque el hook de la sesión nueva lo leería como orden.
  - **Aceptado sin cambio:** un ciclo previo escrito a mano y ajeno a la tarea hace que `wf_update` rechace la nueva dependencia (falla cerrado). El tope de 10 cuenta los IDs ordenados, no los mencionados.
  - Validación final: `npm test` 159/159, `npm run test:e2e` 45/45, `check:dist` y `claude plugin validate plugin` correctos.
