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
