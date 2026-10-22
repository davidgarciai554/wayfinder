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
