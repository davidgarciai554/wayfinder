# Plan: etiquetas en las tareas (WAY-14)

> Estado: aprobado (por el usuario, 2026-11-13, «Apruebo los cuatro»; D7 según la recomendación)
> Versión: v1
> Tarea: WAY-14
> Depende de: WAY-16 (`Planes/2026-11-13-filtros-de-prioridad-y-texto-en-wf-list.md`); las dos cambian `wf_list`.

## Contexto y objetivo

- **Problema:** las tareas solo tienen estado, prioridad, plan y dependencias (`src/store/tasks.ts:36-60`). No se pueden agrupar por área (web, MCP, hooks, docs…).
- **Resultado esperado** (descripción de la tarea): etiquetas opcionales, filtrables en `wf_list` y en el tablero.
- **Evidencia del sistema actual:**
  - El frontmatter conserva las claves desconocidas (`writeTaskUnlocked`, `tasks.ts:161-177`).
  - `depends_on` es el patrón para listas: se filtran los valores inválidos al leer y la clave se borra cuando la lista queda vacía (`tasks.ts:99`, `tasks.ts:322-328`).
  - La web pinta todo con `textContent` y tiene una CSP estricta (`src/server.ts:51-60`).
  - El tablero ya guarda una preferencia local, «mostrar descartadas» (`readPref`/`writePref`, `web/app.js:496`).
  - En `docs/design/DESIGN.md`, las etiquetas son de 13 px con radio de 6 px, y los selectores son `<select>` nativos de 44 px en compacto e intermedio.

## Alcance

- **Incluido:**
  - Clave `tags` en el frontmatter.
  - `tags` en `wf_create` y `wf_update`.
  - Las etiquetas visibles en `wf_get` y `wf_list`, y el filtro `tag` en `wf_list`.
  - En la web: etiquetas en la tarjeta y en el detalle, y un filtro por etiqueta en el tablero.
  - i18n, pruebas, e2e, README, skill, `DESIGN.md` y `dist`.
- **Excluido:**
  - Compartir el mecanismo con los tipos de error (ver D2).
  - Campo de etiquetas en el formulario web de creación (D7, pendiente de tu decisión).
  - Etiquetas en el SessionStart.
  - Etiquetas en los errores.
  - Renombrar etiquetas de forma masiva.
  - Commit y actualización del plugin.

## Decisiones de la mesa redonda

**Las marcadas con (P) necesitan tu confirmación**; si no dices nada, la aprobación del plan las acepta como están.

| # | Decisión | Evidencia y motivo | Alternativas descartadas | Riesgo o consecuencia |
| --- | --- | --- | --- | --- |
| D1 | **Etiquetas libres** con el formato `^[a-z0-9][a-z0-9-]{0,29}$`, como mucho 10 por tarea y sin duplicados. | El formato cerrado es el control de seguridad: sin espacios, mayúsculas, Unicode ni delimitadores (`<<<`). El tope acota la salida. | Lista cerrada por proyecto: nadie la ha pedido y obliga a configurarla. | Al escribir, un valor fuera del formato se **rechaza** con un error claro, sin pasarlo a minúsculas: es más simple y previsible. |
| D2 | **No se comparte mecanismo con los tipos de error**, en contra de lo que sugería la descripción. | Los tipos de error son una lista cerrada con significado fijo (`ERROR_KINDS`). Las etiquetas son libres. | Reutilizar `ERROR_KINDS`: mezclaría conceptos. | Queda anotado en la tarea. |
| D3 | **Lectura tolerante**: al leer, los valores inválidos se ignoran (como en `depends_on`). Si `wf_update` no recibe `tags`, la clave del archivo no se toca. `tags: []` la borra. | Compatibilidad con archivos editados a mano o escritos por otra versión. No se borra en silencio lo que no se ha pedido cambiar (negador). | Fallar al leer: una etiqueta mala ocultaría la tarea. | — |
| D4 | **Filtro `tag` en `wf_list`**: un array; la tarea pasa si tiene **alguna** de las etiquetas pedidas. Se combina con Y con el resto de filtros. | Coincide con la semántica de `status` y `priority`. «Todas» no se ha pedido. | «Todas»: si hace falta, se añade después. | — |
| D5 | **Salida MCP**: `tags: a, b` en `wf_get` y ` #a #b` al final de la línea de `wf_list`, solo si la tarea tiene etiquetas. | Sin etiquetas, la salida es idéntica a la de hoy. | Etiquetas siempre visibles: cambiaría la salida de todas las tareas. | — |
| D6 | **Web: filtro con un `<select>` nativo «Etiqueta»** sobre el tablero. Opciones: «Todas» más las etiquetas del proyecto, por orden alfabético. Se guarda como preferencia local por proyecto, y una etiqueta guardada que ya no existe vuelve a «Todas». Las tarjetas muestran las etiquetas como texto. | La descripción pide filtrar «en el tablero». El `<select>` nativo da teclado, foco y nombre accesible sin código propio. Mismo patrón que «mostrar descartadas». | Chips con `aria-pressed`: más código. | Con un filtro activo, los recuentos de columna y de «Saltar a» cuentan solo lo filtrado, y un aviso «Filtrando por etiqueta X» con un botón «Quitar filtro» deja claro el estado. |
| D7 (P) | **Formulario web de creación sin campo de etiquetas.** Las etiquetas se ponen desde Claude (`wf_create` / `wf_update`). | Hoy la web no edita tareas (`DESIGN.md`: «edición libre de tareas» excluida). Así no aparece un flujo de edición nuevo. | Campo «Etiquetas» separado por comas en el diálogo de nueva tarea: más validación y e2e. | Quien use solo la web no puede etiquetar. |
| D8 | **Secretos**: las etiquetas pasan por `assertNoSecrets`, y el commit ya analiza el archivo entero. | Defensa en profundidad (seguridad). | — | — |

## Preguntas que requieren decisión del usuario

- **D7 (P):** ¿formulario de creación sin campo de etiquetas (recomendado) o con él?

## Plan de implementación

1. `src/store/tasks.ts`:
   - `Task.tags: string[]`, leída de forma tolerante (D3).
   - `validateTags` (D1, D8).
   - `tags` en `createTask` (como parámetro de entrada) y en `updateTask` (reemplaza la lista; `[]` borra la clave).
   - Validación: tests de store.
2. `src/mcp.ts`:
   - `tags` en `wf_create` y `wf_update`.
   - Línea `tags:` en `detail` y sufijo en `line` (D5).
   - Filtro `tag` en `wf_list` (D4), con `z.array(z.string().max(30)).max(10)`.
   - Descripciones de las herramientas.
   - Validación: `npm run typecheck`.
3. `src/server.ts`:
   - `tags` en el JSON de cada tarea.
   - `POST` de creación sin cambios (si D7 queda como está).
4. `web/app.js` y `web/styles.css`:
   - Etiquetas en la tarjeta (`card`) y en la cabecera del detalle, con texto y la clase `tag` existente (sin colores nuevos).
   - `<select>` «Etiqueta» con su `<label>` sobre las columnas, aviso de filtro activo y botón «Quitar filtro».
   - Preferencia local validada al leerla.
   - Recuentos de columna sobre lo filtrado.
5. `src/i18n/es.json` y `src/i18n/en.json`: textos de la web y del MCP.
   - Validación: `test/i18n.test.ts`.
6. Pruebas:
   - `test/store.test.ts`:
     - formato válido e inválido (mayúsculas, espacios, Unicode, `<<<`, 31 caracteres, 11 etiquetas, duplicados);
     - secreto rechazado;
     - lectura tolerante de un frontmatter manual;
     - claves desconocidas conservadas;
     - sin `tags` no se toca nada;
     - `[]` borra.
   - `test/mcp.integration.test.ts`:
     - crear y actualizar con etiquetas;
     - `wf_get` y `wf_list` con y sin etiquetas;
     - filtro `tag` con «alguna» y combinado con `priority` y `query`.
   - `test/server.test.ts`: `tags` en el JSON.
   - `e2e/` (fixture con etiquetas):
     - tarjeta con etiquetas;
     - filtro por teclado;
     - aviso y botón «Quitar filtro»;
     - filtro sin resultados;
     - preferencia que sobrevive a una recarga;
     - 320 px sin scroll horizontal;
     - árbol de accesibilidad;
     - inglés.
   - Validación: `npm test` y `npm run test:e2e`.
7. `README.md`, `plugin/skills/wayfinder/SKILL.md` (sección «While working»), `docs/design/DESIGN.md` (tarjeta, filtro y registro de revisión visual) y `dist`.
   - Validación: `npm run check:dist`.

## Criterios de aceptación

- [ ] `wf_create` y `wf_update` aceptan `tags` válidas y rechazan las inválidas con un error claro; `[]` borra.
- [ ] Una etiqueta inválida en un archivo no rompe la lectura, y una edición sin `tags` no la toca.
- [ ] `wf_get` y `wf_list` muestran las etiquetas solo cuando existen; sin etiquetas, la salida no cambia.
- [ ] El filtro `tag` de `wf_list` usa «alguna» y se combina con Y con el resto de filtros.
- [ ] En el tablero, las etiquetas se ven en la tarjeta y en el detalle, y el `<select>` filtra con teclado, foco visible y estado anunciado en texto.
- [ ] El filtro sobrevive a una recarga, y una etiqueta que ya no existe vuelve a «Todas».
- [ ] A 320 px no hay scroll horizontal, y la interfaz funciona en inglés.
- [ ] `npm run typecheck`, `npm test`, `npm run test:e2e` y `npm run check:dist` en verde.

## Estrategia de validación

- **Pruebas específicas:** store, integración MCP, servidor y e2e (Playwright, Chromium).
- **Validaciones amplias:** `npm run typecheck`, `npm test`, `npm run test:e2e` y `npm run check:dist`.
- **Verificación funcional:** revisión en ejecución con el navegador integrado (escritorio en claro y oscuro, 390 px y 320 px) según `frontend-visual-review.md`, registrada en `DESIGN.md`.
- **Accesibilidad:** `<select>` nativo con `<label>`, estado del filtro en texto, foco visible, nada de color como único portador de significado y objetivos de 44 px. NVDA y el zoom real al 200 % quedan **no verificados**.
- **Seguridad:** el formato cerrado, `textContent` en la web, `flatten`/`neutralize` en el MCP y `assertNoSecrets`.

## Riesgos y reversión

- **Riesgo:** una versión anterior de Wayfinder que lea un archivo con `tags`. Mitigación: la clave desconocida se conserva al reescribir (con un test de ida y vuelta).
- **Riesgo:** que las etiquetas proliferen sin control. Mitigación: el tope de 10 por tarea y el filtro visible. Residual: aceptado.
- **Reversión:** revertir el código. Los archivos con `tags` siguen siendo legibles, porque la clave desconocida se conserva.

## Desacuerdos residuales

- **Filtro web.** El negador y el técnico de solución mínima proponían dejar fuera el filtro web. Se incluye porque la descripción de la tarea lo pide explícitamente, con la forma más pequeña posible: un `<select>` nativo.
- **Tope de 10 etiquetas.** El técnico de solución mínima lo veía innecesario. Se mantiene, a petición de seguridad, para acotar la salida.

## Notas de implementación

> Anotaciones posteriores a la aprobación. No cambian el alcance aprobado.

- **2026-11-13:**
  - Store: `Task.tags`, `TAG_RE`, `MAX_TAGS` y `validateTags` en `src/store/tasks.ts`. Los valores ilegibles del archivo se conservan mientras no se pasen `tags`.
  - MCP: el esquema de `tags` en `wf_create` y `wf_update` es amplio (100 caracteres y 50 elementos) a propósito, para que el mensaje claro de formato lo dé el store. El filtro `tag` de `wf_list` sí usa 30 y 10.
  - Web: el selector usa `<label for>` en vez de una etiqueta que lo envuelva, para que su nombre accesible sea «Etiqueta» sin la opción elegida.
  - Correcciones tras la revisión visual: «Quitar filtro» es un botón normal dentro de un aviso en fila (`button-quiet` ocupaba todo el ancho), y el aviso dice «Filtro activo: etiqueta «x». Tareas visibles: N.» para evitar «1 tareas».
  - Validación:
    - `npm run typecheck`, `npm test` (165/165), `npm run check:dist` y `npm run test:e2e` (46/46 y, tras los ajustes, el e2e de WAY-14 y el inglés en verde);
    - revisión en ejecución registrada en `DESIGN.md`.
  - **No verificado:** NVDA, el zoom real al 200 % y el uso desde una sesión real de Claude sin actualizar el plugin.
  - Corrección tras la revisión de código independiente: el recuento «Tareas visibles» ya no cuenta las tareas descartadas cuando su columna está oculta. El fixture `etiquetas` tiene ahora una tarea descartada con `mcp` y el e2e lo comprueba. Validación: `npm run test:e2e` 46/46 y `npm run check:dist`.
