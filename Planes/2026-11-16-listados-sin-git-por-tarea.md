# Plan: listados sin git por tarea (WAY-23)

> Estado: aprobado (por el usuario, 2026-11-16, «Apruebo plan v1», con las recomendaciones: preguntas 1 (a), 2 (a), 3 (a) y umbral de 2 s)
> Versión: v1
> Tarea: WAY-23
> Base revisada: `a088964` (worktree `claude/optimistic-kare-345ffc`). `feat/wayfinder-mvp` va un commit por delante (`01947bd`), que no toca las funciones de este plan. Los números de línea son de `a088964` y cambiarán cuando entre WAY-13.

## Contexto y objetivo

- **Problema:** listar tareas tarda en proporción al número de tareas. Con 205 tareas, `wf_list` y la lista de la web tardan 23,7 s.
- **Causa confirmada:** `modifiedOutside` (`src/store/git.ts:113-120`) lanza dos procesos git por tarea (`status` y `log -1`), y se llama una vez por fila:
  - `line()` en `src/mcp.ts:132`, que usa `wf_list` (`src/mcp.ts:357`, hasta 200 filas);
  - `taskMeta()` en `src/server.ts:106`, que usa `GET /api/projects/<slug>/tasks` (`src/server.ts:242`).
- **Efecto en la web:** el tablero pide la lista en cada pintado (`web/app.js:513`). El filtro por etiqueta (`web/app.js:520`), «Mostrar descartadas» (`web/app.js:561`) y el autorefresco (`web/app.js:1041-1057`) la piden otra vez, y en esos pintados no se muestra «Cargando…» (`web/app.js:988`).
- **Resultado esperado:** un listado lanza un número fijo de procesos git, sea cual sea el número de tareas, y la marca «modificada fuera de Wayfinder» sigue significando lo mismo.

### Medidas del 2026-11-16

Windows 11, Node 24.12, git 2.55. Carpeta de datos temporal creada por la vía real (`createTask`, un commit por tarea), nunca la carpeta real. Mediana de 3 ejecuciones (de 5 en el candidato).

| Caso | 17 tareas | 205 tareas |
| --- | --- | --- |
| `GET /api/projects/demo/tasks` | 1,34 s | 23,7 s |
| `wf_list` (bundle del plugin, por stdio) | 1,36 s | 23,7 s (200 filas) |
| Leer las tareas sin git (`listTasks`) | 0,01 s | 0,12 s |
| `modifiedOutside` × N | 1,35 s | 24,0 s (117 ms por tarea) |
| Cálculo por lote propuesto (1 `status` + 1 `log`) | 0,09 s | 0,2 a 0,35 s |

La tarea recogía el 2026-11-13: 22 s en `wf_list` con 200 filas; 1,6 s y 20 s en la web con 17 y 205 tareas. Las cifras coinciden.

El `log` por lote recorre todo el historial de la carpeta de tareas (repositorio sintético, 205 tareas):

| Commits | `status` | `log` | Salida de `log` |
| --- | --- | --- | --- |
| 1 000 | 0,04 s | 0,08 s | 81 KB |
| 5 000 | 0,04 s | 0,3 s | 405 KB |
| 20 000 | 0,05 s | 1,0 a 1,1 s | 1,6 MB |

Mesa redonda proporcional (solo lectura): solución mínima, negador, calidad y validación, accesibilidad y experiencia, y seguridad y datos. El análisis del repositorio, las medidas y esta síntesis los hace el responsable de la sesión.

## Alcance

- **Incluido:**
  - Una función nueva en `src/store/git.ts` que calcula la marca de varias tareas con una pasada.
  - Su uso en `wf_list` y en la lista de tareas de la web.
  - `maxBuffer` explícito en el proceso git.
  - Pruebas nuevas y `dist` reconstruido.
- **Excluido:**
  - Cambios en la web (`web/app.js`, `web/styles.css`) y en `docs/design/DESIGN.md`: ver D8 y la pregunta 1.
  - Las vistas de una sola tarea (`wf_get`, `wf_review`, el detalle y las respuestas de escritura de la web): siguen con `modifiedOutside`, dos procesos en total.
  - Caché de resultados entre listados: ver D9.
  - Subcomandos git nuevos: `ALLOWED_SUBCOMMANDS` y `scripts/check-dist.mjs` no cambian.
  - Textos nuevos, README y skill: el comportamiento visible no cambia.
  - Commit, push y actualización del plugin instalado: necesitan tu autorización aparte.
- **Supuestos y restricciones:**
  - Solo se usan `status` y `log`, que ya están permitidos (`src/store/git.ts:12`).
  - La carpeta de datos es siempre la raíz de su repositorio: `initHome` crea su propio `.git` (`src/store/init.ts:68`), comprobado también con la carpeta dentro de otro repositorio. Las rutas que devuelve git son relativas a esa carpeta, como `task.file`.
  - El slug llega validado a los dos puntos de uso: `SLUG_RE` en `src/server.ts:232` y `assertSlug` vía `requireProject` en MCP (`src/store/paths.ts:22`, `:92`).
  - Supuesto sin comprobar: el tamaño del historial de tu carpeta de datos real. No se ha mirado.

## Decisiones de la mesa redonda

| # | Decisión | Evidencia y motivo | Alternativas descartadas | Riesgo o consecuencia |
| --- | --- | --- | --- | --- |
| D1 | **Calcular la marca una vez por listado**: 1 `git status` y 1 `git log` de `projects/<slug>/tasks`. | De 24,0 s a 0,2-0,35 s con 205 tareas. No añade subcomandos ni dependencias. | Ver D9 (caché), D10 (`--author` con negación) y D11 (cambiar el significado). | Dos caminos para la misma marca (por lote y por archivo): los une una prueba de equivalencia. |
| D2 | **`status` con `--porcelain -z --no-renames --untracked-files=all`.** | Sin esas opciones el lote falla en tres casos comprobados: nombres no ASCII (git los entrecomilla), renombrados y una carpeta de tareas entera sin seguimiento (git la resume como `?? carpeta/`). | `status --porcelain` a secas. | — |
| D3 | **`log` con `--first-parent -m --format=%x01%an%x09%ae --name-only -z`.** Una tarea queda marcada si el commit más reciente de la línea principal que cambió su archivo no es de `Wayfinder <wayfinder@localhost>`. Un merge hecho a mano cuenta como un cambio de quien lo hizo. | En historial lineal (el único que crea Wayfinder) coincide con `git log -1 -- archivo` en los 10 casos probados. Sin `--first-parent -m`, un merge manual que se queda con la versión editada a mano deja la tarea **sin marcar** (objeción del negador, reproducida). | `log` sin opciones y `log -c`: se dejan casos sin marcar. `log -m` solo: marca de más en cualquier merge. | Si traes la línea principal a una rama tuya con un merge, las tareas que Wayfinder escribió en la principal aparecen marcadas hasta su siguiente escritura. Marca de más, nunca de menos. |
| D4 | **Análisis de la salida:** partir primero por NUL; un trozo que empieza por el byte 0x01 es la cabecera de un commit; el resto son rutas. Autor y correo se comparan por igualdad exacta. Solo se consideran los archivos de las tareas del listado. | Probado con autores que contienen 0x01, tabuladores o la propia identidad dentro del nombre o del correo: todos quedan marcados, igual que hoy. Ninguna ruta de `projects/…` puede empezar por 0x01. | Partir por 0x01 o por líneas: un autor o un nombre de archivo hostil podría confundir el análisis. | Quien escribe en la carpeta de datos ya puede hoy confirmar con la identidad de Wayfinder y evitar la marca. Este cambio no lo empeora ni lo arregla. |
| D5 | **Si el cálculo por lote falla, se usa el cálculo por archivo de hoy** para las tareas del listado. Si git no está (`missing`), ninguna queda marcada, como hoy. La salida de un proceso que falló no se lee nunca. | Mantiene el resultado actual en todos los fallos, sin textos ni estados nuevos. Lo propone el negador. | Dejar todas sin marca en silencio: un solo fallo borraría la señal de todo el listado. Aviso visible «no se pudo comprobar» (seguridad): cambia la salida de `wf_list` y la web; ver la pregunta 2. | Con el lote roto, el listado vuelve a tardar como hoy. |
| D6 | **`maxBuffer` de 64 MiB en `realRunner`** (`src/store/git.ts:26`). | El valor por defecto de Node es 1 MiB y la salida de `log` lo supera hacia los 12 000 commits (1,6 MB con 20 000). 64 MiB cubren unos 500 000 commits. Si aun así se supera, aplica D5. | Dejar el valor por defecto: el lote fallaría siempre a partir de cierto historial. | Hasta 64 MiB de memoria en un caso extremo. |
| D7 | **Las vistas de una sola tarea no cambian.** | `src/mcp.ts:157`, `src/server.ts:252` y `:424` lanzan dos procesos en total. | Pasarlas al lote: más cambio sin ganancia. | — |
| D8 | **La web no se toca; el indicador de carga del tablero queda como está.** | Con la lista en 0,3-0,5 s, el filtro y «Mostrar descartadas» responden sin espera apreciable. `loading()` sustituye todo `main` (`web/app.js:196-198`): usarlo en esos pintados destruiría el control enfocado. `DESIGN.md:145` solo exige «Cargando…» en la carga del tablero y `:148` prohíbe mover el foco en el autorefresco. | Filtrar en el navegador: no arregla `wf_list`, la primera carga ni el autorefresco, y añade una copia de la lista que hay que invalidar. Indicador «ocupado» pasado un umbral: ver la pregunta 1. | Con una red lenta (móvil) el filtro puede tardar más de 1 s sin señal. No está medido. |
| D9 | **Sin caché.** El `log` recorre todo el historial en cada listado. | 0,3 s con 5 000 commits. Una caché con clave `HEAD` añade estado e invalidación para un coste que hoy no existe. | Caché en memoria por `HEAD`. | El coste crece con el historial: 1 s con 20 000 commits. Condición para evolucionar: un listado real por encima de 1 s. |
| D10 | **No usar `log -P --author` con negación** para listar solo commits ajenos. | Tarda la mitad y no produce salida, pero depende de que git tenga PCRE y obliga a un segundo camino si alguien confirma muchas tareas a mano. | — | Queda como primera opción si se cumple la condición de D9. |
| D11 | **No cambiar el significado de la marca** (por ejemplo, mirar solo los cambios sin commit en los listados). | Es una señal de confianza que la persona y Claude ya usan. | Marca parcial o sin marca en los listados. | — |

## Preguntas que requieren decisión del usuario

1. **Indicador de carga del tablero.**
   - **(a) Recomendada: no tocarlo** (D8). La causa de la espera desaparece.
   - (b) Añadir un «Cargando…» con `aria-busy` que solo aparece si el filtro o la casilla tardan más de 1 s, sin mover el foco y sin activarse en el autorefresco. Toca `web/app.js`, `DESIGN.md` y las pruebas e2e, y no se puede comprobar con lector de pantalla desde aquí. Tendría sentido si mides esperas de más de 1 s desde el móvil.
2. **Qué hacer si el cálculo por lote falla.**
   - **(a) Recomendada: volver al cálculo por archivo** (D5). Mismo resultado que hoy, más lento.
   - (b) Mostrar un aviso «no se pudo comprobar» en el listado (lo pide seguridad y datos). Cambia la salida de `wf_list` y de la web, y necesita textos nuevos. Hoy el fallo por tarea ya es silencioso, así que sería una mejora aparte.
3. **Orden respecto a WAY-13**, que está en curso y toca `line()`, `taskMeta()` y `src/store/tasks.ts`.
   - **(a) Recomendada: WAY-13 primero.** WAY-23 se implementa desde `feat/wayfinder-mvp` cuando WAY-13 esté integrada, en una sola sesión de escritura sobre esos archivos.
   - (b) WAY-23 primero: es más pequeña, pero obliga a WAY-13 a rehacer su cambio sobre las firmas nuevas.
4. **Umbral de tiempo del criterio de aceptación:** mediana de 2 s o menos con 205 tareas en este PC (se esperan 0,3 a 0,5 s). ¿Te vale?

## Plan de implementación

1. `test/git.test.ts`: pruebas nuevas de la función por lote, escritas antes que el código.
   - Equivalencia con `modifiedOutside` archivo a archivo, en un repositorio real: limpio; edición sin commit; cambio en el índice; commit de otra identidad; commit ajeno seguido de una escritura de Wayfinder; commit ajeno de dos tareas con una reescrita después; archivo sin seguimiento con nombre no ASCII y espacios, y ese archivo confirmado por otra identidad; `git mv` sin commit y confirmado; carpeta de tareas entera sin seguimiento.
   - Merge manual que se queda con el archivo de la rama editada a mano: marcada, igual que por archivo. Merge al revés (D3): se fija el resultado esperado, marcada de más.
   - Autores hostiles (0x01, tabulador, la identidad de Wayfinder dentro del nombre o del correo): marcadas.
   - Número de procesos con `setGitRunner`: exactamente 2 con 5 archivos y con 20.
   - Fallos con `setGitRunner`: git ausente → ninguna marcada; `status` o `log` fallan → se usa el cálculo por archivo; un `log` fallido con salida parcial no se lee.
   - Validación: `npm test` (deben fallar hasta el paso 2).
2. `src/store/git.ts`:
   - `export function modifiedOutsideAmong(home: string, dir: string, files: readonly string[]): Set<string>`, con D2, D3, D4 y D5. Comentario breve con el límite de D9 y su condición.
   - `maxBuffer: 64 * 1024 * 1024` en `realRunner` (D6).
   - `modifiedOutside` no cambia.
   - Validación: `npm run typecheck` y las pruebas del paso 1.
3. `src/mcp.ts`:
   - `line(task, byId, outside)` usa `outside.has(task.file)` en lugar de llamar a `modifiedOutside`.
   - `wf_list` calcula `outside` una vez, solo para las filas que muestra, con `projects/<slug>/tasks`.
   - `detail()` no cambia.
   - Validación: `npm run typecheck`.
4. `src/server.ts`:
   - `taskMeta(home, task, byId?, outside?)`: con `outside` usa `outside.has(task.file)`; sin él, `modifiedOutside` como hoy.
   - La ruta `GET /api/projects/<slug>/tasks` calcula `outside` una vez y lo pasa.
   - Las demás llamadas a `taskMeta` no cambian.
   - Validación: `npm run typecheck`.
5. `test/server.test.ts`:
   - La lista devuelve `modifiedOutside: true` para una tarea editada fuera y `false` para las demás.
   - Con `setGitRunner`, la petición de la lista lanza el mismo número de procesos git con 5 tareas que con 20, y no más de 2.
   - Validación: `npm test`.
6. `test/mcp.integration.test.ts`: `wf_list` muestra «modified outside Wayfinder» en la fila de una tarea editada fuera y en ninguna otra. Hoy no hay prueba de esto.
   - Validación: `npm test`.
7. `dist` y `plugin/dist`: `npm run build`.
   - Validación: `npm run check:dist`.
8. Medida final con una carpeta de datos temporal y 205 tareas, igual que la de partida: mediana de 3 de `GET /api/projects/demo/tasks` y de `wf_list`. Las cifras se anotan en «Notas de implementación».

## Criterios de aceptación

- [ ] Con 205 tareas, `GET /api/projects/<slug>/tasks` y `wf_list` (200 filas) tardan 2 s o menos de mediana en este PC. Partida: 23,7 s en ambos.
- [x] Un listado lanza 2 procesos git, con 5 tareas y con 20 (prueba automática).
  - Evidencia (WAY-30, 2026-11-26): `test/git.test.ts` «WAY-23: the batch runs two git processes whatever the number of files, and none without files» (5 y 20 archivos, 2 procesos) y `test/server.test.ts` «WAY-23: the task list flags the file edited outside Wayfinder with two git processes, whatever the number of tasks»; ambas con ✔ en `npm test` (230/230).
- [x] La marca del listado coincide con `modifiedOutside` por archivo en todos los casos del paso 1, salvo el merge al revés de D3, que queda marcado de más.
  - Evidencia (WAY-30, 2026-11-26): `test/git.test.ts` «WAY-23: the batch flags the same files as the per-file check after hand edits, foreign commits, renames and untracked files», «WAY-23: a hand-made merge counts as a change by whoever made it» y «WAY-23: author names and emails that imitate the separators are still another identity», con ✔ en `npm test` (230/230).
- [x] Si el lote falla, el listado responde y marca lo mismo que hoy.
  - Evidencia (WAY-30, 2026-11-26): `test/git.test.ts` «WAY-23: when the batch cannot run, the answer is the per-file one and failed output is never read», con ✔ en `npm test` (230/230).
- [ ] La salida de `wf_list` y la respuesta de la lista web no cambian de formato.
- [ ] `wf_get`, `wf_review` y el detalle de la web siguen igual.
- [x] `npm run typecheck`, `npm test`, `npm run check:dist` y `npm run test:e2e` en verde.
  - Evidencia (WAY-30, 2026-11-26): `npm run typecheck` y `npm run check:dist` correctos (quality.txt); `npm test` 230/230 (test.txt); `npm run test:e2e` 68 passed, 0 fallos (e2e.txt).

## Estrategia de validación

- **Pruebas específicas:** `test/git.test.ts` (equivalencia, merges, autores hostiles, número de procesos, fallos), `test/server.test.ts` (marca y número de procesos en la lista web) y `test/mcp.integration.test.ts` (marca en `wf_list` con el bundle real).
- **Validaciones amplias:** `npm run typecheck`, `npm test`, `npm run check:dist` y `npm run test:e2e`. `e2e/read.spec.ts:28` ya comprueba que la etiqueta se ve en el tablero; la fixture usa git real (`e2e/fixture-server.ts:129-136`) y no depende de los argumentos.
- **Verificación funcional:** la medida del paso 8 y abrir el tablero de prueba con 205 tareas para cambiar el filtro y la casilla.
- **Medida de tiempo:** manual, no en `npm test`. Un umbral de tiempo automático fallaría según la carga de la máquina; la garantía automática es el número de procesos.
- **Seguridad:** solo lectura sobre la carpeta de datos; ningún subcomando nuevo; el pathspec es una carpeta fija construida con un slug validado, en lugar de un nombre de archivo leído del disco por cada tarea.
- **Accesibilidad:** no aplica si la pregunta 1 queda en (a): la web no cambia.
- **No verificado tras implementar:**
  - el plugin instalado en una sesión real, hasta que lo actualices;
  - otras versiones de git y otros sistemas (solo Windows 11 con git 2.55);
  - tu carpeta de datos real y su historial;
  - el tiempo del filtro desde el móvil.

## Riesgos y reversión

- **Riesgo:** el lote marca distinto que el cálculo por archivo en un caso no previsto. Mitigación: prueba de equivalencia y D5. Las diferencias conocidas van hacia marcar de más (D3).
- **Riesgo:** el coste del `log` crece con el historial (D9). Mitigación: comentario con el límite y la condición para evolucionar.
- **Riesgo:** no hay tiempo máximo para los procesos git, igual que hoy. Un historial enorme alarga el listado, pero menos que ahora.
- **Riesgo de integración:** WAY-13 cambia `line()`, `taskMeta()` y `src/store/tasks.ts` a la vez. Si las dos ramas se implementan por separado, habrá conflicto en `src/mcp.ts` y `src/server.ts`, y los `dist` reconstruidos chocarán siempre. Mitigación: la pregunta 3 y reconstruir `dist` después de integrar.
- **Reversión:** el cambio no toca datos ni formato. Basta revertir el código y reconstruir `dist`.

## Desacuerdos residuales

- **Fallo del lote.** Seguridad y datos pide un estado visible «no verificado» en lugar de un resultado silencioso. Negador y solución mínima prefieren volver al cálculo por archivo. Recomendación: D5 ahora; el aviso visible, como mejora aparte si la quieres (pregunta 2).
- **Tiempo máximo de git.** Seguridad y datos pide un `timeout` en las llamadas por lote. No se incluye: hoy no existe y, al agotarse, habría que decidir qué mostrar (la misma pregunta 2).
- **Umbral de tiempo.** Solución mínima propone menos de 1 s; calidad, menos de 2 s y sin prueba automática. Recomendación: 2 s, medido a mano (pregunta 4).
- **Alcance del lote.** El negador prefería usar el lote solo como filtro previo y confirmar cada candidata con la función actual. Se descarta porque, con `--first-parent -m`, el lote ya coincide en los casos probados y la confirmación devolvería el coste por archivo a quien confirma muchas tareas a mano.

## Notas de implementación

> Anotaciones posteriores a la aprobación. No cambian el alcance aprobado.

- **2026-11-16:**
  - Implementado sobre `2a8dbdf` (`feat/wayfinder-mvp` con WAY-13 integrada), en el worktree `claude/optimistic-kare-345ffc`. Sin commit.
  - `modifiedOutsideAmong(home, dir, files)` en `src/store/git.ts`, con `maxBuffer` de 64 MiB en `realRunner`. La usan `wf_list` (`src/mcp.ts`, solo para las filas que muestra) y `GET /api/projects/<slug>/tasks` (`src/server.ts`). `modifiedOutside` y las vistas de una sola tarea no cambian.
  - Sin desviaciones del plan. Detalle no previsto: la cabecera de autor se compara tras quitar saltos de línea finales, por si otra versión de git la termina de otro modo.
  - Pruebas nuevas: cinco en `test/git.test.ts` (equivalencia, merges, autores hostiles, número de procesos y fallos), una en `test/server.test.ts` y una en `test/mcp.integration.test.ts`.
  - Validación: `npm run typecheck`, `npm test` (191/191), `npm run check:dist` y `npm run test:e2e` (47/47).
  - Medida final, misma carpeta temporal de 205 tareas y mismo método (mediana de 3):

    | Caso | Antes | Después |
    | --- | --- | --- |
    | `GET /api/projects/demo/tasks` | 23,7 s | 0,33 s |
    | `wf_list` (200 filas) | 23,7 s | 0,35 s |

  - Tablero real sobre esa carpeta: el filtro por etiqueta y «Mostrar descartadas» responden en 0,34 a 0,37 s y el foco se queda en el control. Tras editar a mano el archivo de una tarea, el autorefresco muestra «Modificada fuera de Wayfinder» solo en esa tarjeta.
  - **No verificado:** el plugin instalado en una sesión real (hay que actualizarlo), otras versiones de git y otros sistemas, la carpeta de datos real y el tiempo del filtro desde el móvil.
