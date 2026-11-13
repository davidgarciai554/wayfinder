# Registro de errores

## 2026-10-21 · El bundle ESM falla con «Dynamic require of "process" is not supported»

- **Contexto:** incremento 2 del plan `Planes/2026-10-21-wayfinder-mvp.md` (servidor MCP). Windows 11, Node 24.12.0, esbuild 0.28.2.
- **Reproducción:** `npm run build` y después `node plugin/dist/wayfinder.mjs mcp`. Los tests de integración MCP fallan con `SdkError: Connection closed`.
- **Salida observada:** `Error: Dynamic require of "process" is not supported` en `node_modules/yaml/dist/compose/composer.js` dentro del bundle.
- **Causa confirmada:** `yaml` se publica como CommonJS y hace `require('process')` en tiempo de ejecución. En un bundle con `format: 'esm'`, esbuild no puede resolver esos `require` dinámicos si no existe una función `require`. En el incremento 1 no apareció porque `init` no carga `yaml`.
- **Solución:** `scripts/build.mjs` añade en el banner `createRequire(import.meta.url)` para definir `require` dentro del bundle.
- **Archivos modificados:** `scripts/build.mjs`.
- **Validación:** `npm run build` y `node --test test/mcp.integration.test.ts` → 5/5. El servidor arranca y responde al cliente MCP real.

## 2026-10-21 · Tests de integración MCP colgados y `EPERM` al borrar la carpeta temporal

- **Contexto:** incremento 2, mismos tests.
- **Reproducción:** `node --test test/mcp.integration.test.ts` con la limpieza registrada antes que el cierre del cliente.
- **Salida observada:** `EPERM, Permission denied: \\?\C:\Users\...\Temp\wf-mcp-…` en `rmSync`. Además, el proceso de tests no terminaba porque los servidores hijos seguían vivos.
- **Causa confirmada:** el servidor MCP hijo tenía la carpeta temporal como directorio de trabajo y seguía vivo cuando se intentaba borrarla; en Windows no se puede borrar el directorio de trabajo de otro proceso.
- **Solución:** un único `t.after` que primero cierra los clientes (y con ellos los servidores) y después borra con `maxRetries`.
- **Archivos modificados:** `test/mcp.integration.test.ts`.
- **Validación:** la suite termina en ~4 s con 5/5.

## 2026-10-21 · El hook SessionStart no inyecta contexto: los valores por defecto de `userConfig` no llegan a los hooks

- **Contexto:** incremento 3, validación en una sesión real de Claude Code 2.1.306 con `claude -p --plugin-dir <copia del plugin>` en Windows 11.
- **Reproducción:** cargar el plugin sin valores de `userConfig` guardados y preguntar por el contexto de inicio. El hook `session-start` termina con estado 0 pero sin salida.
- **Salida observada:** con un hook de diagnóstico, las variables `CLAUDE_PLUGIN_OPTION_*` no existen (solo `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA` y `CLAUDE_PROJECT_DIR`), y `${user_config.home}` en los `args` de un hook falla con `Plugin option "home" isn't set`. En cambio, el MCP sí recibe el `default` a través de `${user_config.home}` en `.mcp.json`.
- **Causa confirmada:** Claude Code solo exporta y sustituye para los hooks las opciones que la persona ha guardado; los `default` del manifiesto no se aplican. El hook buscaba entonces `~/.wayfinder`, donde no estaba el proyecto.
- **Solución:** `hookEnv` (`src/hook.ts`), cuando no hay ni `WAYFINDER_*` ni `CLAUDE_PLUGIN_OPTION_*`, usa los `default` de `${CLAUDE_PLUGIN_ROOT}/.claude-plugin/plugin.json`, igual que el MCP.
- **Archivos modificados:** `src/hook.ts`, `test/hook.test.ts`, `plugin/dist/wayfinder.mjs`.
- **Validación:** test unitario de la caída a los valores del manifiesto; sesión real repetida: el contexto llega con las tareas y `language: es`, y con el valor por defecto `en` llega `language: en`. `npm test` con 54/54 en Node 22 y 24.

## 2026-10-21 · El banner de desconexión de la web estaba siempre visible

- **Contexto:** incremento 4, interfaz web (`web/styles.css`), pruebas e2e con Playwright.
- **Reproducción:** abrir `wayfinder serve` con conexión normal: el banner «Sin conexión con Wayfinder…» aparecía igualmente.
- **Salida observada:** el test «empty project…» falló con `strict mode violation: getByRole('alert') resolved to 2 elements`, uno de ellos `<div hidden="" id="banner" …>`. El test del banner pasaba sin probar nada, porque el banner ya estaba visible.
- **Causa confirmada:** `.banner { display: flex }` tiene más especificidad que la regla del navegador `[hidden] { display: none }`, así que el atributo `hidden` no ocultaba el elemento.
- **Solución:** regla global `[hidden] { display: none !important; }`. Los tests comprueban ahora que el banner está oculto con conexión y que aparece al abortar `/api/events`.
- **Archivos modificados:** `web/styles.css`, `e2e/read.spec.ts`.
- **Validación:** `npm run test:e2e` → 11/11.

## 2026-10-22 · El test e2e de la bitácora dependía de la fecha del día

- **Contexto:** incremento 5, al volver a ejecutar `npm run test:e2e` un día después del incremento 4.
- **Reproducción:** ejecutar la suite e2e en un día distinto de 2026-10-21.
- **Salida observada:** `log, screenshots (with viewer) and project pages` falla: el primer día de la bitácora es `2026-10-22` con «08:38 · WF-6» en lugar de la entrada «Implementado el filtro».
- **Causa confirmada:** `e2e/fixture-server.ts` pasaba un reloj fijo a `createTask` y `appendLog`, pero no a `setStatus` ni a `updateTask`; esos cambios de estado escriben marcas en la bitácora con la hora real, así que aparecía un día nuevo cada día. El 2026-10-21 coincidía por casualidad con el reloj fijo. No es un defecto del producto.
- **Solución:** el fixture pasa el mismo reloj fijo a todas las escrituras.
- **Archivos modificados:** `e2e/fixture-server.ts`.
- **Validación:** `npm run test:e2e` → 20/20.

## 2026-10-22 · La web no abre en http://127.0.0.1:4321: el puerto lo tenía otra aplicación (Astro)

- **Contexto:** prueba manual tuya tras el incremento 5, en Windows 11.
- **Reproducción:** con el servidor de desarrollo de Astro de otro proyecto escuchando en `0.0.0.0:4321` (es el puerto por defecto de Astro), abrir `http://127.0.0.1:4321/index.html?k=…`.
- **Salida observada:** sin Wayfinder arrancado, contesta la página de la otra aplicación. Con Wayfinder arrancado en 4321, Windows le deja abrir `127.0.0.1:4321` sin error, de modo que dos programas comparten el puerto y la misma dirección muestra uno u otro según cuál esté vivo. Además, `/index.html` daba 404 en Wayfinder (solo se servía `/`), y `~/.wayfinder` no existía, por lo que `serve` habría salido pidiendo `init`.
- **Causa confirmada:** el puerto por defecto de Wayfinder (4321) coincidía con el de Astro, y en Windows enlazar `127.0.0.1:<P>` no falla aunque otro proceso tenga `0.0.0.0:<P>`.
- **Solución:** puerto por defecto 4747; antes de escuchar, `serve` comprueba si algo ya responde en `127.0.0.1:<P>` y, si es así, sale con código 1 y el mensaje «El puerto <P> ya lo usa otra aplicación…» (también ante `EADDRINUSE`), parando watchers y temporizadores. `/index.html` se sirve igual que `/`, también con `?k=`.
- **Archivos modificados:** `src/server.ts`, `src/cli.ts`, `src/i18n/es.json`, `src/i18n/en.json`, `test/server.test.ts`, `dist/`, `plugin/dist/`.
- **Validación:** test unitario con un servidor ocupando `0.0.0.0:<P>` → `serve.portInUse`; `/index.html` → 200 y la clave por `/index.html?k=` → cookie. Bundle real: `serve --port 4321` con Astro activo → mensaje y código 1; `serve` sin opciones → `http://127.0.0.1:4747/?k=…` y `/index.html` → 200. `npm test` 71/71, `npm run test:e2e` 20/20 y `check:dist` correcto.

## 2026-10-22 · El hook Stop no pedía la bitácora si ese día había habido una aprobación o una pausa

- **Contexto:** incremento 7, prueba extremo a extremo con el plugin instalado (Claude Code 2.1.308, `claude -p` en un repositorio de demostración).
- **Reproducción:** aprobar por chat «aprueba DEM-1», pasar la tarea a `in-progress` y terminar la sesión sin `wf_log`.
- **Salida observada:** la sesión termina sin que el hook Stop bloquee. La bitácora del día solo contiene el registro automático `status: proposed -> todo` / `approved-via: chat`.
- **Causa confirmada:** `hasLogFor` solo comprobaba que existiera el archivo del día, y las transiciones con nota o marcas (aprobación por chat, pausas, descartes, `trivial`) escriben registros automáticos en ese archivo. El test existente esquivaba el caso: evaluaba «mañana» porque la nota ya había creado la bitácora de hoy.
- **Solución:** `hasLogFor` cuenta solo las entradas cuyo cuerpo no empieza por `status: <a> -> <b>`, es decir, las escritas con `wf_log`. Límite documentado en el código: una entrada de `wf_log` que empiece así se tomaría por automática.
- **Archivos modificados:** `src/store/log.ts`, `test/hook.test.ts`, `plugin/dist/`.
- **Validación:** test nuevo del mismo día (falla sin el cambio y pasa con él); `npm test` 74/74. En sesión real con el plugin instalado, el hook bloquea una vez y Claude escribe `wf_log`; si la persona pidió expresamente no escribir la bitácora, Claude lo respeta y no hay bucle.

## 2026-10-22 · El contexto de SessionStart podía pasar del tope de 4000 caracteres al truncar la lista

- **Contexto:** plan de bitácora e historial, incremento 4, al añadir la prueba de que el historial nunca desplaza la lista de tareas.
- **Reproducción:** un proyecto con unas 60 tareas pendientes de título largo y el hook `session-start` en inglés.
- **Salida observada:** `assert.ok(ctx.length <= 4000)` falla: el contexto mide 4009 caracteres.
- **Causa confirmada:** `sessionContext` cortaba en `MAX_CONTEXT - 40` y añadía el aviso «(list truncated; use wf_list for the full list)», que con el salto de línea mide 49 caracteres. Defecto previo al plan; la prueba antigua no tenía tantas tareas.
- **Solución:** se reserva exactamente la longitud del aviso traducido.
- **Archivos modificados:** `src/hook.ts`, `test/hook.test.ts`.
- **Validación:** la prueba nueva falla antes del cambio y pasa después; `node --test test/hook.test.ts` 12/12.

## 2026-10-22 · La página de bitácora mostraba el texto «null» al final

- **Contexto:** plan de bitácora e historial, incremento 5, revisión visual con capturas.
- **Reproducción:** abrir `#/<slug>/log` en un proyecto con 7 días de bitácora o menos (sin botón «Cargar días anteriores»).
- **Salida observada:** debajo del último día aparece la palabra «null».
- **Causa confirmada:** `renderLog` llamaba a `main.replaceChildren(head, list, more ? … : null)`, y `replaceChildren` convierte un `null` en un nodo de texto. Defecto previo al plan (presente en el incremento 4).
- **Solución:** solo se pasa el botón cuando existe.
- **Archivos modificados:** `web/app.js`, `e2e/history.spec.ts`.
- **Validación:** prueba e2e nueva (`main` no contiene «null»); `npm run test:e2e` 27/27; captura revisada.

## 2026-10-22 · Al abrir o cerrar una tarea la web parecía recargarse, y la URL podía quedarse en la tarea

- **Contexto:** detalle de tarea en modal (commit `f011764`), aviso del usuario en Chrome.
- **Reproducción:** en el tablero, abrir una tarea y cerrarla con Esc o con «×».
- **Salida observada:** el tablero se sustituía por «Cargando…» y se volvía a pintar entero al abrir y al cerrar. En la pestaña de automatización de Chrome (en segundo plano, `visibilityState: hidden`), el modal se cerraba pero la URL seguía en `#/<slug>/task/<ID>`.
- **Causa confirmada:** cada cambio de ruta entre tablero y tarea volvía a pintar la página completa. Además, la vuelta atrás dependía del evento `close` del `<dialog>`, que Chrome entregó tarde en la pestaña oculta. La bandera `closingByRoute` tampoco servía, porque ese evento es asíncrono.
- **Solución:** entre tablero y tarea del mismo proyecto se conserva el tablero y solo se abre o cierra el modal y se marca la tarjeta. Esc (evento `cancel`, inmediato) y «×» cambian de ruta directamente; el router cierra el modal; `close` queda como respaldo, con una guarda contra doble navegación.
- **Archivos modificados:** `web/app.js`, `e2e/history.spec.ts`.
- **Validación:** Chrome real (pestaña de automatización) con clic y teclas reales: tablero intacto (mismo nodo), URL de vuelta a `board`, foco en la tarjeta, con Esc y con «×». E2E nueva «no reload»; `npm run test:e2e` 29/29.

## 2026-10-22 · `EPERM` intermitente al crear el bloqueo con 20 procesos concurrentes

- **Contexto:** `npm test` tras el cambio anterior, Windows 11, Node 24.
- **Reproducción:** intermitente; `test/concurrency.test.ts` «20 concurrent processes create 20 distinct IDs».
- **Salida observada:** `Error: EPERM: operation not permitted, mkdir '…\home\.wayfinder.lock'` en `withLock` (`src/store/sync.ts`).
- **Causa (hipótesis muy probable, coherente con el comportamiento documentado de Windows):** un `mkdir` sobre un directorio que otro proceso está borrando devuelve `EPERM`; `withLock` solo trataba `EEXIST` como contención y abortaba la escritura.
- **Solución:** `withLock` trata `EPERM`, `EBUSY` y `EACCES` como contención (espera y reintenta hasta el tiempo límite), igual que ya hacía `writeFileAtomic`.
- **Archivos modificados:** `src/store/sync.ts`.
- **Validación:** `node --test test/concurrency.test.ts` 5 veces seguidas en verde; `npm test` completo. Al ser intermitente, no hay una reproducción determinista que demuestre la corrección.

## 2026-10-23 · E2E «create a task…» falla de forma intermitente: el mensaje de éxito ya se ha borrado

- **Contexto:** incremento 4 del plan `Planes/2026-10-23-registro-de-errores.md` (WAY-4). `npm run test:e2e` en Windows 11, Node 24.12.0.
- **Reproducción:** `npx playwright test e2e/write.spec.ts` varias veces. Falla en algunas ejecuciones, no en todas.
- **Salida observada:** `e2e/write.spec.ts:101` → `expect(locator('#flash')).toHaveText('Creada ESC-5 en «Por hacer».')` recibe `""`.
- **Causa (hipótesis muy probable, sin corregir):** carrera de tiempos en el propio test. El mensaje de éxito se borra a los 6 s (`flash` en `web/app.js`). El test, después de verlo, ejecuta tres llamadas síncronas a git y a disco (`commits()`, `lastSubject()`, `read()`) y luego espera 5,2 s más. Si esas llamadas tardan más de ~0,8 s, el mensaje ya no está.
- **Preexistente, no introducido por WAY-4:** en un worktree limpio de `HEAD` (7f9f6ec, sin los cambios de WAY-4) el mismo test falló 4 de 4 veces. Con los cambios de WAY-4 falló 2 de 4 ejecuciones.
- **Solución (2026-10-23, después de WAY-4):** el test mide el tiempo desde que aparece el mensaje y comprueba que sigue visible a los 5 s exactos (el requisito de `DESIGN.md` es «≥ 5 s»), con una espera máxima de 200 ms en esa comprobación. Antes contaba después de las llamadas a git. No cambia el producto.
- **Archivos modificados:** `e2e/write.spec.ts`.
- **Validación:** `npx playwright test e2e/write.spec.ts` 5 de 5 en verde (antes fallaba 2 de 4); `npm run test:e2e` completo 37/37 dos veces seguidas.

## 2026-10-23 · Regresión de WAY-4: al reabrir una tarea justo después de cerrarla, el modal se cierra solo

- **Contexto:** al intentar estabilizar la suite e2e tras WAY-4 (commit fdaa554). Windows 11, Chromium headless.
- **Reproducción:** `npx playwright test e2e/read.spec.ts -g "keyboard only: open a task" --repeat-each 10`. Abre la tarea con Enter, la cierra con el botón y vuelve a pulsar Enter enseguida.
- **Salida observada:** 5 de 10 fallan en `read.spec.ts:77` (`dialog` no visible). En el commit anterior a WAY-4 (7f9f6ec) pasan 10 de 10.
- **Causa confirmada (con un test de diagnóstico que registraba los eventos):** al cerrar, el router cierra el `<dialog>`, pero su evento `close` llega a veces después de que Enter haya vuelto a abrir la tarea (`hash board → foco en la tarjeta → hash task → close`). El respaldo de ese evento (`leaveTask`) veía la ruta de tarea y navegaba atrás, cerrando el modal recién abierto. La carrera existía en el diseño; los cambios de WAY-4 en el render alteraron los tiempos y la hicieron frecuente.
- **Solución:** `hideTask` marca los cierres hechos por el router (`closedByRouter`) y el respaldo `onTaskDialogClose` ignora el evento `close` que corresponde a esos cierres; solo navega cuando el diálogo lo ha cerrado el navegador por su cuenta. A diferencia del intento anterior (`closingByRoute`), la marca se consume en el propio evento, no de forma síncrona.
- **Archivos modificados:** `web/app.js`, `plugin/dist/web/app.js`.
- **Validación:** el mismo test con `--repeat-each 20`: 20/20. `npm run test:e2e` completo 37/37 dos veces seguidas; `npm test` 116/116; `npm run check:dist` en verde.

## 2026-11-11 · La aprobación por chat rechaza «apruebo way-5»: ID en minúsculas y verbo no reconocido

- **Contexto:** aprobación de WAY-5 desde el chat con el plugin instalado. Windows 11.
- **Reproducción:** escribir «apruebo way-5», llamar a `wf_review` y después a `wf_set_status` con `status: "todo"`, `user_requested: true` y la frase literal en `user_quote`.
- **Salida observada:** `chat.invalidQuote` («La cita de la petición debe contener WAY-5…»).
- **Causa confirmada:** `approveByChat` comprobaba la cita con `quote.includes(id)`, que distingue mayúsculas y además aceptaba «WAY-50» como si nombrara WAY-5. `extractOrders` (hook `UserPromptSubmit`) buscaba el ID con una expresión regular que también distinguía mayúsculas, y «apruebo» no estaba entre los verbos de aprobación, así que la orden tampoco se habría registrado.
- **Solución:** `extractOrders` busca el ID sin distinguir mayúsculas y lo guarda en forma canónica (`PREFIJO-N`) y reconoce «apruebo». `approveByChat` exige el ID completo en cualquier combinación de mayúsculas y minúsculas. Las protecciones de negación, pregunta, código y citas no cambian.
- **Archivos modificados:** `src/store/mentions.ts`, `src/store/approve.ts`, `test/chat.test.ts`, `plugin/dist/wayfinder.mjs`.
- **Validación:** `npm run typecheck` sin errores; `node --test test/chat.test.ts` 11/11 con casos nuevos («apruebo wf-12», «Aprueba Wf-12», cita «haz WF-10» rechazada para WF-1, aprobación completa en minúsculas); `npm test` 117/117; `npm run check:dist` coincide con un build limpio.
- **Resultado:** corregido en el repositorio. El plugin instalado mantiene la versión anterior hasta que se actualice. Registro en Wayfinder vinculado a WAY-5.

## 2026-11-11 · `test:docker` desfasado: espera 11 herramientas MCP desde que se añadió `wf_error`

- **Contexto:** incremento 4 de WAY-6 (plan `Planes/2026-11-11-instalacion-web-remota-y-alta-guiada.md` v3). Windows 11, Docker 29.9.2, imagen `wayfinder:dev` recién construida.
- **Reproducción:** `docker build -t wayfinder:dev .` y `npm run test:docker`.
- **Salida observada:** falla «MCP over stdio in a container…» con `AssertionError`: se esperaban 11 herramientas y hay 13.
- **Causa confirmada:** la prueba solo comprobaba el número de herramientas. Se quedó desfasada en `fdaa554` (`wf_error`, 12 herramientas): la última edición del archivo es anterior a ese commit y desde entonces no se había ejecutado `test:docker`. `wf_web` sube el total a 13. Es un fallo previo a WAY-6, que además añade una herramienta.
- **Solución:** la prueba compara la lista ordenada de nombres, como `test/mcp.integration.test.ts`, en lugar del número.
- **Archivos modificados:** `test/docker/image.docker.ts`.
- **Validación:** `npm run test:docker` → 5/5. También se adaptó la prueba al cambio de WAY-6: dentro del contenedor la web escucha en `0.0.0.0` y exige la clave también para leer, y la clave tiene el formato `<gen>.<secreto>`.
- **Resultado:** resuelto. Registrado en Wayfinder como error de WAY-6.

## 2026-11-11 · El enlace para otros dispositivos pide la clave si se abre desde otra web (cookie `SameSite=Strict`)

- **Contexto:** incremento 5 de WAY-6 (plan `Planes/2026-11-11-instalacion-web-remota-y-alta-guiada.md` v3), revisión visual en el navegador integrado (Chromium). Windows 11. Servidor de vista previa con los datos e2e en `127.0.0.1` y en una IPv4 de la LAN.
- **Reproducción:** desde la página del PC (`127.0.0.1`), navegar con `location.href` al enlace remoto `http://<ip>:<puerto>/?k=<clave>`.
- **Salida observada:** página «Acceso a Wayfinder» con HTTP 401 y el aviso «Esta web necesita la clave de su enlace», aunque la clave era la vigente.
- **Causa confirmada:** la respuesta a `?k=` ponía la cookie con `SameSite=Strict` y redirigía (303) a `/`. Como la navegación empezaba en otro sitio, el navegador no enviaba la cookie en la redirección y el listener remoto respondía 401. Desde la barra de direcciones funcionaba; desde un chat o un correo, no.
- **Solución:** la cookie pasa a `SameSite=Lax`, que se envía en las navegaciones de nivel superior. Las escrituras siguen protegidas por la comprobación de Origin, el cuerpo solo JSON y la clave. Nueva prueba e2e que abre el enlace desde otra web.
- **Archivos modificados:** `src/server.ts`, `test/server.test.ts`, `e2e/access.spec.ts`.
- **Validación:** `npx playwright test e2e/access.spec.ts` (caso «abrir el enlace desde otra web»); `node --test test/server.test.ts` 18/18. En el navegador integrado, el móvil (390 px) muestra los proyectos. Suite completa: `npm test` 133/133, `npm run test:e2e` 41/41, `npm run test:docker` 5/5, `npm run check:dist` OK.
- **Resultado:** resuelto antes de publicar. Registrado en Wayfinder como error de WAY-6.

## 2026-11-12 · El enlace del móvil da «connection refused» cuando la web cae en un puerto distinto de 4747

- **Contexto:** WAY-6 (ERR-4 en Wayfinder). Sesión nueva de Claude Code con `webHost` en la IP de la LAN y perfil de red privado. Windows 11 con el cortafuegos activo y la regla del README «Wayfinder (Node) - red privada» (`-LocalPort 4747`).
- **Reproducción:** con otra sesión de Claude que ya tiene la web en red en el puerto 4747, decir «abre Wayfinder» en una segunda sesión y abrir en el móvil, en la misma wifi, el enlace para otros dispositivos.
- **Salida observada:** el móvil muestra «connection refused». El servidor escucha en la IP de la LAN y en `127.0.0.1` en el puerto 61772; la regla del cortafuegos solo cubre el 4747 y la acción de entrada por defecto es Block.
- **Causa confirmada:** la sesión anterior mantiene su web en el 4747. Por diseño (README: «se abre en otro puerto libre»), la segunda sesión escucha en un puerto aleatorio que la regla documentada no cubre, y `wf_web` no avisa de ello.
- **Solución:** cuando la web se abre en red en un puerto distinto de 4747, `wf_web` añade junto al enlace para otros dispositivos un aviso con los dos puertos. El aviso dice que la regla del cortafuegos del README solo abre el 4747, y cómo liberarlo: cerrar la otra web y volver a escribir «abre Wayfinder», o permitir también ese puerto. `status` repite el aviso. El README explica el caso. Se descartó una regla del cortafuegos sin puerto fijo porque abre más de lo necesario. Para salir del paso en esta ocasión se cerró la sesión que ocupaba el 4747.
- **Archivos modificados:** `src/mcp.ts`, `src/i18n/es.json`, `src/i18n/en.json`, `test/mcp.integration.test.ts`, `README.md`, `plugin/dist/wayfinder.mjs`.
- **Validación:** solución temporal comprobada. El 4747 lo tenía la sesión interactiva de prueba abierta con `wf-interactive.ps1`, y su proceso no se podía cerrar desde otra sesión («Acceso denegado»). Con esa sesión cerrada por la persona, la web se reabrió en el 4747 y el móvil carga el tablero. Corrección: nuevo test de integración con el 4747 ocupado (aviso en `start` y `status`, con el puerto real); `npm run typecheck` correcto, `npm test` 138/138 y `check:dist` correcto. Sin comprobar todavía en una sesión real con el plugin instalado, que sigue en la versión del commit `00ce54e`.

## 2026-11-13 · La aprobación por chat no reconoce varios IDs tras un solo verbo

- **Contexto:** aprobación por chat de tres propuestas en un único mensaje, con el plugin instalado. Windows 11, Claude Code 2.1.322. ERR-5 en Wayfinder, ligado a WAY-8.
- **Reproducción:** escribir «apruebo las tres tareas WAY-8, WAY-9 y WAY-12», llamar a `wf_review` de cada ID y después a `wf_set_status` con `status: "todo"` y `user_requested: true`. También falla el tercer ID de «aprueba WAY-8, WAY-9 y WAY-12».
- **Salida observada:** «No hay una orden explícita reciente para WAY-8 en el último mensaje» (igual para WAY-9 y WAY-12).
- **Causa confirmada:** `extractOrders` (`src/store/mentions.ts`) solo acepta un ID si un verbo de aprobación aparece como mucho `WINDOW = 3` palabras antes. «las tres tareas» deja el verbo a 4 palabras de WAY-8, y cada ID anterior de la lista («way» + número) consume palabras de la ventana del siguiente.
- **Solución:** pendiente de decisión. Es el filtro que impide aprobaciones inducidas, así que ampliarlo (por ejemplo, aceptar una lista de IDs encadenada al verbo) necesita su propio cambio y pruebas de negación y preguntas. Mientras tanto, la orden funciona escribiendo un verbo junto a cada ID, por ejemplo «aprueba WAY-8, aprueba WAY-9 y aprueba WAY-12».
- **Archivos modificados:** ninguno.
- **Validación:** causa comprobada leyendo `extractOrders` y con las tres llamadas rechazadas.
- **Resultado:** sin resolver.

## 2026-11-13 · La ruta web de reapertura aprobaba una tarea que no estaba terminada ni descartada

- **Contexto:** implementación de WAY-12 (plan `Planes/2026-11-13-tipos-y-descarte-de-errores-y-reapertura-de-tareas.md` v1, incremento 3), antes de publicar nada. ERR-6 en Wayfinder.
- **Reproducción:** reabrir desde la web una propuesta descartada (pasa a `proposed`) y volver a llamar a `POST /api/projects/:slug/tasks/:id/reopen` sobre ella con su `expectedUpdated` y una nota.
- **Salida observada:** 200 en lugar de 409; la tarea pasaba de `proposed` a `todo`, es decir, quedaba aprobada.
- **Causa confirmada:** la ruta calculaba el destino con `reopenTarget(task) ?? 'todo'`. Para una tarea que no está `done` ni `discarded`, `reopenTarget` devuelve `null` y el valor por defecto convertía la reapertura en una aprobación web.
- **Solución:** sin valor por defecto: si no hay destino, la ruta responde 409 (`store.invalidTransition`) sin escribir. `setStatus` comprueba además, bajo el bloqueo, que el destino de una reapertura es exactamente `reopenTarget(task)`.
- **Archivos modificados:** `src/server.ts`, `src/store/tasks.ts`, `test/server.test.ts`.
- **Validación:** `node --test test/server.test.ts` (caso «an open task cannot be reopened» → 409) y `test/store.test.ts`; `npm run typecheck`.
- **Resultado:** resuelto antes de cerrar el incremento; nunca llegó al plugin instalado.
