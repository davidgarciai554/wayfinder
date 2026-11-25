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
- **Recurrencia 2026-11-13 (WAY-1):** al revalidar la imagen con Docker 29.9.3, `test:docker` da 4/5: espera 13 herramientas y hay 14, porque `wf_errors` (WAY-10) se añadió solo a `test/mcp.integration.test.ts`. Causa de fondo: la lista estaba copiada en dos pruebas y `test:docker` no corre con `npm test`. Solución: una única lista `MCP_TOOLS` en `test/helpers.ts`, usada por las dos pruebas. Archivos: `test/helpers.ts`, `test/mcp.integration.test.ts`, `test/docker/image.docker.ts`. Validación: `npm run typecheck`, `npm run test:docker` 5/5 y `node --test test/mcp.integration.test.ts` 18/18.

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
- **Solución:** (WAY-18, plan `Planes/2026-11-13-varios-ids-dependencias-y-varias-tareas.md` v1) `extractOrders` acepta una lista. El primer ID necesita un verbo de aprobación como mucho 3 palabras antes, contadas desde el ID anterior para que los IDs previos no llenen la ventana, y sin negación. Los IDs unidos solo por una coma, «y», «e» o «and» heredan su veredicto, y cualquier otra cosa corta la lista («pero», «luego», otro prefijo, un rango, un espacio). Con más de 10 IDs en un mensaje no se registra ninguna orden.
- **Archivos modificados:** `src/store/mentions.ts`, `test/chat.test.ts`, `README.md`, `plugin/skills/wayfinder/SKILL.md`, `plugin/dist/wayfinder.mjs`.
- **Validación:** `node --test test/chat.test.ts` 21/21, con las frases de ERR-5, los casos de no-orden de la lista, el tope y tres aprobaciones extremo a extremo; `npm test` 153/153; `npm run check:dist` correcto.
- **Resultado:** resuelto. El hook `prompt` usa el bundle nuevo desde el siguiente mensaje.

## 2026-11-13 · La ruta web de reapertura aprobaba una tarea que no estaba terminada ni descartada

- **Contexto:** implementación de WAY-12 (plan `Planes/2026-11-13-tipos-y-descarte-de-errores-y-reapertura-de-tareas.md` v1, incremento 3), antes de publicar nada. ERR-6 en Wayfinder.
- **Reproducción:** reabrir desde la web una propuesta descartada (pasa a `proposed`) y volver a llamar a `POST /api/projects/:slug/tasks/:id/reopen` sobre ella con su `expectedUpdated` y una nota.
- **Salida observada:** 200 en lugar de 409; la tarea pasaba de `proposed` a `todo`, es decir, quedaba aprobada.
- **Causa confirmada:** la ruta calculaba el destino con `reopenTarget(task) ?? 'todo'`. Para una tarea que no está `done` ni `discarded`, `reopenTarget` devuelve `null` y el valor por defecto convertía la reapertura en una aprobación web.
- **Solución:** sin valor por defecto: si no hay destino, la ruta responde 409 (`store.invalidTransition`) sin escribir. `setStatus` comprueba además, bajo el bloqueo, que el destino de una reapertura es exactamente `reopenTarget(task)`.
- **Archivos modificados:** `src/server.ts`, `src/store/tasks.ts`, `test/server.test.ts`.
- **Validación:** `node --test test/server.test.ts` (caso «an open task cannot be reopened» → 409) y `test/store.test.ts`; `npm run typecheck`.
- **Resultado:** resuelto antes de cerrar el incremento; nunca llegó al plugin instalado.

## 2026-11-13 · El aviso de dependencias abiertas sale con el prefijo «Aviso:» repetido

- **Contexto:** prueba de aceptación de los últimos cambios (WAY-8 a WAY-19) sobre un proyecto de demostración con una carpeta de datos temporal, usando `plugin/dist/wayfinder.mjs` por MCP. Windows 11, Node 24.12.0. ERR-8 en Wayfinder, ligado a WAY-15.
- **Reproducción:** `wf_update` de una tarea con `depends_on` apuntando a otra que está en `todo`, y después `wf_set_status` de la primera a `in-progress` (con plan, o con `trivial` y nota).
- **Salida observada:** `TIE-2 ahora está en in-progress.` seguido de `Aviso: Aviso: TIE-2 depende de tareas que aún no están hechas: TIE-1 [todo].` En inglés, `Warning: Warning: …`.
- **Causa confirmada:** el texto `store.dependenciesOpen` (`src/i18n/es.json` y `en.json`) ya empieza por «Aviso:» / «Warning:», y el MCP envuelve todos los avisos con `cli.warning` («Aviso: {message}») en `ok()` de `src/mcp.ts`. Los demás avisos no llevan prefijo propio. `test/store.test.ts` solo comprueba la clave del aviso, no el texto final.
- **Solución:** el texto `store.dependenciesOpen` ya no lleva prefijo propio en ninguno de los dos idiomas; el prefijo lo pone quien muestra el aviso (`cli.warning` en el MCP), como en el resto de avisos. Era un defecto de texto: el estado cambiaba bien y los datos no se veían afectados.
- **Archivos modificados:** `src/i18n/es.json`, `src/i18n/en.json`, `test/mcp.integration.test.ts`, `plugin/dist/wayfinder.mjs`.
- **Validación:** la prueba «WAY-15: wf_update sets and clears depends_on…» comprueba ahora el texto completo que devuelve `wf_set_status`; fallaba con el bundle anterior (`Warning: Warning: …`) y pasa con el nuevo. `npm run typecheck`, `npm test` (173/173) y `npm run check:dist` en verde. Repetida la demo en español contra el bundle reconstruido: `Aviso: TIE-2 depende de tareas que aún no están hechas: TIE-1 [todo].`, con 370 comprobaciones correctas y ninguna fallida. `npm run test:e2e` y `npm run test:docker` no se repitieron tras el cambio: la web no recibe este texto.
- **Resultado:** resuelto. El servidor MCP de una sesión ya abierta sigue con el texto antiguo hasta que se reinicie.

## 2026-11-16 · Desde una sesión en worktree, `wf_update` rechaza un plan que existe en el worktree

- **Contexto:** planificación de WAY-13 en una sesión de Claude Code Desktop que trabaja en un worktree del repositorio. El borrador del plan se escribió en `Planes/` dentro del worktree, sin commit. Windows 11. ERR-10 en Wayfinder, ligado a WAY-13.
- **Reproducción:** abrir una sesión en un worktree del repositorio registrado, crear `Planes/AAAA-MM-DD-nombre.md` solo en el worktree y llamar a `wf_update` con ese `plan`. `wf_project` con `action: "get"` muestra como `consumerRoot` el checkout principal.
- **Salida observada:** «El plan «Planes/2026-11-16-bloqueo-de-tareas-con-motivo.md» no existe en el proyecto.»
- **Causa (hipótesis):** el servidor MCP del plugin arranca con `CLAUDE_PROJECT_DIR` (o el directorio de trabajo) en la carpeta del proyecto, no en el worktree de la sesión. `resolveProject` toma `consumerRoot` de ahí y `makePlanExists` comprueba el archivo en esa carpeta (`src/store/resolve.ts`). No se ha podido ver el entorno real del proceso MCP. La misma comprobación se usa al pasar de `todo` a `in-progress`.
- **Investigación:** leído `src/store/resolve.ts`. `findRepoRoot` devolvería la raíz del worktree si recibiera su carpeta, así que el valor de partida es el que apunta al checkout principal.
- **Archivos modificados:** ninguno. Queda fuera del plan de WAY-13.
- **Validación:** ninguna: sin corregir.
- **Resultado:** abierto. Salida usada, por orden de la persona: copiar el plan al checkout principal como archivo sin seguimiento. Deja dos copias que pueden divergir, y hay que quitar la del checkout principal antes de integrar una rama que confirme ese mismo archivo.

## 2026-11-16 · `check:dist` falla tras integrar un bundle construido en un worktree

- **Contexto:** implementación de WAY-23 en un worktree de Claude Code Desktop (`.claude/worktrees/…`) sin `node_modules` propio: las dependencias se resuelven en el `node_modules` del checkout principal, tres carpetas más arriba. `npm test` y `npm run check:dist` pasaron en el worktree. Windows 11, Node 24.12. ERR-11 en Wayfinder, ligado a WAY-23.
- **Reproducción:** en un worktree sin `node_modules` propio, ejecutar `npm run build` y confirmar `plugin/dist/wayfinder.mjs`; llevar ese commit al checkout principal y ejecutar allí `npm run check:dist`.
- **Salida observada:** `plugin/dist/wayfinder.mjs: content differs from a fresh build`. El commit `dea4e73` cambiaba 580 líneas del bundle; 382 eran comentarios de ruta, de `// node_modules/yaml/…` a `// ../../../node_modules/yaml/…`.
- **Causa confirmada:** esbuild escribe en el bundle la ruta de cada módulo relativa a la carpeta desde la que se construye. Desde el worktree esa ruta sube tres niveles, así que el bundle sale distinto del que se obtiene en el checkout principal. `check:dist` compara con un build hecho en el mismo sitio: por eso pasa en el worktree y falla fuera.
- **Solución:** reconstruir con `npm run build` desde el checkout principal y confirmar ese `plugin/dist/wayfinder.mjs`. No se ha tocado `scripts/build.mjs`: un bundle que no dependa de la carpeta de construcción queda como mejora aparte.
- **Archivos modificados:** `plugin/dist/wayfinder.mjs`.
- **Validación:** en el checkout principal, `npm run check:dist` coincide con un build limpio y `npm test` pasa 191/191 con el bundle reconstruido. Frente a `2a8dbdf`, el bundle cambia 52 líneas y ningún comentario de ruta.
- **Resultado:** corregido. Mientras el build dependa de la carpeta, el bundle que se confirma hay que construirlo desde un checkout con su propio `node_modules`; desde un worktree, `check:dist` no detecta la diferencia.
- **Actualización 2026-11-25 (WAY-32):** corregido en `scripts/build.mjs`. El build fija `absWorkingDir` en la raíz del paquete y quita el prefijo `../` delante de `node_modules/` antes de escribir el bundle. La ruta salía en los comentarios y también en las claves de `__commonJS`, que solo identifican el módulo. Validación: una copia del repositorio en una carpeta anidada sin `node_modules` propio genera `dist/` y `plugin/dist/` idénticos byte a byte al build del worktree y al bundle confirmado. El mismo build con el `build.mjs` anterior difería (264 rutas con `../` delante de `node_modules/`). Construido desde `scripts/` como directorio de trabajo, sale igual. `npm run check:dist` pasa en los dos sitios. Ya no hace falta construir el bundle desde el checkout principal.

## 2026-11-17 · Dos specs e2e fallan si la web espera `/api/projects` antes de pintar al navegar

- **Contexto:** implementación de WAY-24 en un worktree, sin commit. Para refrescar el aviso de formato al navegar, el manejador de `hashchange` de `web/app.js` pasó a esperar `loadProjects()` antes de `render()`. Windows 11, Node 24.12, Playwright con un worker. ERR-12 en Wayfinder, ligado a WAY-24.
- **Reproducción:** con ese manejador (`await loadProjects(); await render();`), ejecutar `npm run test:e2e`.
- **Salida observada:** 2 fallos y 50 correctas. En `errors.spec.ts:10`, la pestaña «Errores» aún no tenía `aria-current` y el locator encontraba también una tarjeta del tablero anterior (`strict mode violation`). En `write.spec.ts:222`, tras Esc en el diálogo de reapertura, el botón «Reabrir» no recuperaba el foco.
- **Causa confirmada:** esperar la petición retrasaba el pintado de la navegación. La vista anterior seguía más tiempo en pantalla, y dos navegaciones seguidas pintaban dos veces el diálogo de la tarea, lo que reemplazaba el botón que tenía el foco. Además, con dos navegaciones muy seguidas, `keepBoard` conservaba el tablero con la escritura activada aunque la carpeta hubiera pasado a solo lectura.
- **Solución:** `hashchange` vuelve a pintar en el acto, como antes. `/api/projects` se pide en segundo plano y solo se repinta (con `keepFocus` y nunca sobre un formulario abierto) si cambia el modo de escritura. `paintFormat` marca `writeModeChanged` y `doRender` no conserva el tablero mientras esa marca esté activa.
- **Archivos modificados:** `web/app.js`.
- **Validación:** `npm run test:e2e` 52/52, incluidas `errors.spec.ts:10`, `write.spec.ts:222` y las cinco de `e2e/format.spec.ts`. `npm test` 205/205 y `npm run typecheck` en verde.
- **Resultado:** corregido antes de confirmar nada. La navegación de la web no debe esperar peticiones adicionales para pintar.

## 2026-11-25 · En el CI de Windows, `wf_attach` y el hook pre-tool rechazan rutas de la carpeta temporal

- **Contexto:** primer CI en GitHub Actions (WAY-26, PR #2), `windows-latest` con Node 22 y 24. En ChinorrisPC estas pruebas pasan.
- **Reproducción:** `npm test` en el runner con su `TEMP` por defecto (`C:\Users\RUNNER~1\AppData\Local\Temp`, nombre corto 8.3).
- **Salida observada:** 205/210 en los dos Node. Fallan «data from a newer format is read only…», «a task status from a newer version…», «pre-tool denies direct edits of WAYFINDER_HOME…», «wf_attach only copies real images…» y «WAY-24: the live MCP sees the data format change…», con `attach.symlink` («… is or goes through a symbolic link or junction») sobre rutas bajo `RUNNER~1`, o una aserción `false` en el hook pre-tool.
- **Causa (confirmada):** `src/store/attach.ts` comparaba `realpathSync.native(ruta)` con la ruta pedida para detectar enlaces; `realpath` expande los nombres cortos 8.3 (`RUNNER~1` → `runneradmin`), así que un archivo normal daba una ruta distinta y se tomaba por enlace. En `src/store/paths.ts`, `isWithin` canonicalizaba con `realpath` y, si la ruta aún no existía (el archivo que un Edit o Write va a crear), dejaba la ruta tal cual: un lado quedaba expandido y el otro en 8.3, y el hook pre-tool no reconocía rutas dentro de `WAYFINDER_HOME`. Afecta a cualquier usuario cuya ruta llegue en forma 8.3.
- **Reproducción en ChinorrisPC (2026-11-25):** `TEMP`/`TMP` apuntando al nombre corto de una carpeta de nombre largo (`…\Temp\WA42F6~1`) y `npm test`: fallan las mismas 5 pruebas que en el CI, con `attach.symlink` y la aserción del hook pre-tool.
- **Mitigación previa en el CI:** el workflow fijaba `TEMP` y `TMP` a `RUNNER_TEMP` (ruta larga). Se retira con la corrección.
- **Solución:** `attachCapture` ya no compara con la ruta real: recorre la ruta pedida segmento a segmento con `lstat` y rechaza cualquier enlace simbólico o junction (también en directorios intermedios); las comprobaciones de carpetas permitidas y denegadas siguen usando la ruta real. `isWithin` canonicaliza una ruta inexistente con la ruta real de su antecesor existente más cercano más el resto, de modo que los dos lados quedan en forma larga.
- **Archivos modificados:** `src/store/attach.ts`, `src/store/paths.ts`, `plugin/dist/wayfinder.mjs` (reconstruido), `test/store.test.ts` (prueba con ruta 8.3 real, que se salta con motivo si el volumen no tiene nombres 8.3), `.github/workflows/ci.yml` (sin el paso de `TEMP`/`TMP`).
- **Validación:** la prueba nueva falla con el código anterior (`attach.symlink` sobre `…\WA3B4E~1\shot.png`) y pasa con la corrección, incluido el rechazo de una junction real bajo la ruta 8.3. `npm test` con `TEMP` en 8.3 en ChinorrisPC: 209/211; los dos fallos son `test/server.test.ts:139` (169.254 de Tailscale, conocido) y un `ECONNRESET` intermitente en «errors: list and detail…», que pasa al repetir `test/server.test.ts` (25/26, solo falla la de 169.254). CI del PR sin el paso de `TEMP`.
- **Resultado:** resuelto.

## 2026-11-25 · La prueba WAY-23 de `test/server.test.ts` falla a veces con `ECONNRESET`

- **Contexto:** implementación de WAY-34/WAY-35 en un worktree de ChinorrisPC (Windows 11, Node 24.12, git 2.55). Mientras tanto, otros hilos ejecutaban pruebas en el mismo PC (los puertos 4555/4556 del e2e estaban ocupados).
- **Reproducción:** `node --test --test-name-pattern="WAY-23" test/server.test.ts` varias veces seguidas.
- **Salida observada:** `Error: read ECONNRESET` (`errno -4077`) en una de las peticiones `get`, tras 10–20 s. En la base sin cambios (5c5bae6) falló 1 de cada 4 ejecuciones y con el cambio de WAY-34/35 2 de cada 4 (una de ellas dentro de `npm test` completo); las ejecuciones correctas tardan entre 5 y 11 s.
- **Causa:** hipótesis, sin confirmar. La prueba crea 20 tareas (un commit de git cada una) con el PC cargado, y el socket de alguna petición se cierra antes de la respuesta. No depende de WAY-34/35: falla igual en la base.
- **Investigación:** comparación de base y cambio con la misma orden. No se ha investigado más porque queda fuera del alcance de WAY-34/35.
- **Archivos modificados:** ninguno.
- **Validación:** ninguna; queda abierto.
- **Resultado:** sin resolver. Si se repite en CI (WAY-26), hay que reproducirlo con el PC sin carga y revisar los tiempos de espera del servidor y del cliente `get`.
- **Recurrencia (2026-11-25, WAYF-8):** el mismo `ECONNRESET` en «errors: list and detail are read-only…» (otra prueba de `test/server.test.ts`) durante un `npm test` completo con `TEMP` en forma 8.3 y el PC cargado por otros hilos; al repetir `node --test test/server.test.ts` pasó. Sigue sin resolver.
- **Recurrencia (2026-11-25, WAYF-7, rama `fix/way-33-36-ordenes-y-clave`):** la prueba WAY-23 falló con `read ECONNRESET` en un `npm test` completo y en 1 de 2 ejecuciones aisladas, sobre la base 7ed1969, que aún no tenía la corrección de WAY-32 (`agent: false`). Tras rebasar sobre `origin/main` (f26d5c3, con la corrección), `npm test` completo pasó 223/223.
- **Actualización 2026-11-25 (WAYF-4, WAY-32):** causa confirmada y corregida en la entrada siguiente: el agente HTTP reutiliza un socket keep-alive que el servidor ya ha cerrado mientras el git síncrono bloquea el proceso; las peticiones de `test/server.test.ts` pasan a usar `agent: false`.

## 2026-11-25 · `npm test` en rojo en `test/server.test.ts`: segunda dirección en 169.254 y ECONNRESET en sockets reutilizados

- **Contexto:** ChinorrisPC, Windows 11, Node 24.12. Tailscale desconectado deja la interfaz con la IP link-local `169.254.83.107`. Varios hilos ejecutaban pruebas a la vez en el mismo PC, así que la máquina iba cargada. Detectado en la revisión WAYF-2.
- **Reproducción:** `npm test` completo en ese PC. También se reproduce con el archivo `test/server.test.ts` original de `5c5bae6`.
- **Salida observada:** (1) «a second address needs the key…» falla con `Error: timeout` 3 de 3 veces. (2) Con la IP corregida aparece otro fallo intermitente, «WAY-23: the task list flags…» (en una pasada fue la propia prueba de la segunda dirección): `Error: read ECONNRESET` a los 10–12 s. Falló en las 3 pasadas completas con la IP corregida y también en una pasada de la base sin cambios. Ejecutado solo, el archivo pasa 26/26.
- **Causa confirmada:** (1) la prueba tomaba la primera IPv4 no interna, que aquí es la link-local de Tailscale. La primera conexión a esa IP tarda unos 5 s y la prueba corta a 3 s. (2) El agente HTTP de Node 24 reutiliza conexiones keep-alive por defecto. Con trazas temporales (`reusedSocket`), la petición que falla reutiliza un socket que llevaba 20 s inactivo: `createTask` hace llamadas síncronas a git en el mismo proceso y bloquea el bucle de eventos más allá del keep-alive del servidor (5 s), así que el cliente escribe en una conexión que el servidor ya ha cerrado. Un intento aislado con `Atomics.wait` de 5,5 a 8 s no lo reprodujo; la traza de la pasada real sí lo muestra.
- **Solución:** solo en la prueba, sin cambiar el servidor. (1) Se descartan las direcciones 169.254/16 al elegir la segunda dirección; si no queda ninguna, la prueba se salta con el motivo. (2) Todos los `request()` de `test/server.test.ts` usan `agent: false`, con una conexión nueva por petición.
- **Archivos modificados:** `test/server.test.ts`.
- **Validación:** `npm test` completo 210/210, dos pasadas seguidas en ChinorrisPC; la prueba de la segunda dirección se ejecuta (no se salta) contra `192.168.68.50`. `npm run typecheck` en verde.
- **Resultado:** corregido.

## 2026-11-25 · `concurrency.test.ts` falla con `store.lockTimeout` en una pasada completa con el PC cargado

- **Contexto:** validación de WAY-32 (WAYF-4) tras rebasar sobre `main` (d0e21eb) en ChinorrisPC, Windows 11, Node 24.12. Mientras tanto, otros hilos ejecutaban pruebas en el mismo PC.
- **Reproducción:** `npm test` completo con el PC cargado. No se reproduce con el archivo solo.
- **Salida observada:** 211/212. Falla «20 concurrent progress entries and description edits lose nothing» a los 27,8 s con `WayfinderError: store.lockTimeout` (`src/store/sync.ts:70`, desde `logProgress` en `test/fixtures/worker.ts:14`).
- **Causa (hipótesis):** con la máquina cargada, 20 procesos que confirman cada uno con git no terminan de pasar por el candado dentro de `LOCK_TIMEOUT_MS` (20 s). No se ha medido cuánto tiempo pasa cada proceso con el candado tomado.
- **Investigación:** `node --test test/concurrency.test.ts` solo: 6/6 dos veces. La pasada completa siguiente da 212/212. El cambio de WAY-32 no toca `src/store`.
- **Recurrencia (2026-11-25, WAYF-9):** en la validación del PR #7 (WAY-40) tras rebasar sobre `d0e21eb`, con la suite en 230 s, fallan «20 concurrent processes create 20 distinct IDs and 20 commits» y «20 concurrent progress entries…» con `store.lockTimeout` a los 26-29 s. `node --test test/concurrency.test.ts` solo: 7/7 tres veces; la pasada completa siguiente da 214/214. Ninguna prueba ha visto un bloqueo huérfano con el archivo `owner` de WAY-40, aunque no se ha descartado del todo que influya.
- **Archivos modificados:** ninguno.
- **Validación:** ninguna; queda abierto.
- **Resultado:** sin resolver. Si se repite en el CI o sin carga, hay que medir cuánto tiempo se retiene el candado antes de decidir entre subir el tiempo de espera de la prueba o cambiar el candado.

## 2026-11-25 · `withLock` comprobaba el formato de datos antes de esperar el bloqueo, pero no después

- **Contexto:** hallazgo repetido en las revisiones automáticas de los PR #4, #5 y #6 sobre `withLock` (`src/store/sync.ts`, WAY-24). Windows 11, Node 24.
- **Reproducción:** con el bloqueo tomado por otro proceso, ese proceso escribe `FORMAT` = 2 y suelta el bloqueo; `withLock` lo toma y ejecuta la escritura. Prueba «a newer format written while waiting for the lock is refused under the lock, and the lock is released» en `test/format.test.ts`.
- **Salida observada:** antes de la corrección, `AssertionError [ERR_ASSERTION]: Missing expected exception.`: la escritura se hacía sobre datos de un formato más nuevo.
- **Causa (confirmada con la prueba):** `assertFormatWritable` solo se llamaba al entrar, antes del bucle de espera; lo que cambiara durante la espera no se volvía a mirar.
- **Solución:** repetir `assertFormatWritable` justo después de tomar el bloqueo, dentro del `try/finally`, para que el bloqueo se libere también cuando se rechaza. Se mantiene la comprobación de entrada para no esperar en vano.
- **Archivos modificados:** `src/store/sync.ts`, `test/format.test.ts`, `plugin/dist/wayfinder.mjs` (bundle).
- **Validación:** la prueba nueva falla sin el cambio y pasa con él; `node --test test/format.test.ts test/concurrency.test.ts` 14/14; `npm run typecheck`.
- **Resultado:** resuelto.

## 2026-11-25 · Bloqueo del almacén sin dueño: quien lo pierde por antigüedad borra el del nuevo titular (WAY-40)

- **Contexto:** hallazgo S27-8 (P3) de la auditoría WAY-27, tarea WAY-40 aprobada por el usuario. Windows 11, Node 24.
- **Reproducción:** el proceso A toma el bloqueo; su operación dura más que `LOCK_TTL_MS` (10 s, simulado envejeciendo el mtime del directorio); el proceso B lo da por huérfano, lo borra y lo toma; A termina y libera. Prueba «WAY-40: a process whose lock was taken as orphaned does not release the new holder's lock» en `test/concurrency.test.ts` (modo `hold` de `test/fixtures/worker.ts`).
- **Salida observada:** antes de la corrección, `AssertionError [ERR_ASSERTION]: the new holder keeps its lock`: A borraba el bloqueo de B y un tercer proceso podía entrar mientras B escribía.
- **Causa (confirmada con la prueba):** el bloqueo (`.wayfinder.lock`) no guardaba quién lo tomó, y `withLock` lo borraba siempre en su `finally`.
- **Solución:** cada titular deja un token propio (PID y bytes aleatorios) en `.wayfinder.lock/owner` y solo borra el bloqueo si aún lleva su token. Límite documentado en el código: leer el token y borrar son dos pasos, y una toma que caiga justo entre ambos no queda cubierta; cerrarlo exige un bloqueo del sistema operativo. Tampoco evita que A y B escriban a la vez cuando A supera los 10 s; eso queda fuera de esta corrección mínima.
- **Archivos modificados:** `src/store/sync.ts`, `test/concurrency.test.ts`, `test/fixtures/worker.ts`, `plugin/dist/wayfinder.mjs` (bundle).
- **Validación:** la prueba nueva falla sin el cambio y pasa con él; `node --test test/format.test.ts test/concurrency.test.ts` 15/15; `npm run typecheck`; `npm run check:dist`; `npm test` completo (ver PR).
- **Resultado:** resuelto en lo que pide WAY-40 (quien pierde el bloqueo no borra el del nuevo titular).
