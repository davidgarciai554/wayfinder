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
- **Solución:** ninguna todavía; fuera del alcance de WAY-4. Opción mínima: medir el tiempo desde que aparece el mensaje y esperar solo hasta los 5 s.
- **Archivos modificados:** ninguno.
- **Validación:** pendiente.
