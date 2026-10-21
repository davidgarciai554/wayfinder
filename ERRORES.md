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
