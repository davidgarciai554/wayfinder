# Plan: Llevar Wayfinder a Codex (WAY-7, incremento 1) — v2

> Estado: aprobado el 2026-11-27 (Chidev, vía Captain: «tengo un amigo que usa codex puede hacer que pruebe el el apruebo el plan»). D6 sin elegir expresamente: se aplica la opción B recomendada (decisión comunicada por el Captain).
> Versión: v2
> Fecha: 2026-11-26. Plan anterior: `Planes/2026-11-26-wayfinder-en-codex-copilot-gemini-y-cursor.md`, versión v1, aprobado el 2026-11-26 con D1–D5. Este borrador recoge solo lo que cambia respecto a v1. El resto de v1 sigue vigente: matriz, orden, D1–D5, pasos 4 a 7 y 9, riesgos y reversión.
> Motivo: el paso 1 de v1 (captura real en Codex CLI 0.172.0, Windows 11) contradice un supuesto material. Codex no expande `${PLUGIN_ROOT}` ni `${CLAUDE_PLUGIN_ROOT}` en los servidores MCP de un plugin, así que el MCP no puede apuntar al bundle del plugin y a la vez arrancar en el repositorio de la sesión. Detalle en `ERRORES.md` (entrada del 2026-11-26, WAY-7).
> Rama de destino: `main`.

## Hechos del paso 1 (verificados)

- Codex ignora `args` en los hooks de comando y solo ejecuta `command` como cadena. Por eso `plugin/hooks/hooks.json` no hace nada en Codex.
- En los comandos de hooks de plugin, Codex sustituye `${PLUGIN_ROOT}`. Además exporta `PLUGIN_ROOT`, `CLAUDE_PLUGIN_ROOT` y `PLUGIN_DATA`, y no exporta `CLAUDE_PROJECT_DIR`. Los comandos corren con PowerShell (la política es RemoteSigned en este PC).
- Si existe `.codex-plugin/plugin.json` con `hooks` y `mcpServers`, Codex los usa en lugar de `hooks/hooks.json` y `.mcp.json`. Así, Claude Code y Codex conviven en el mismo directorio `plugin/`.
- En el MCP de un plugin no se expande ninguna variable, ni en `args` ni en `env`. Un `cwd` relativo se resuelve desde la raíz del plugin. Si no hay `cwd`, el proceso arranca en el repositorio de la sesión. Solo hereda unas pocas variables, y para el resto hacen falta `env_vars`.
- Un ejecutable del PATH (`.cmd` de npm) sí arranca como MCP, en el cwd de la sesión y con `env_vars`. Con `wayfinder.cmd hook prompt` como hook, la orden «registra este proyecto» quedó registrada.
- La continuación de `Stop` (`decision: block`) no pasa por `UserPromptSubmit` en 0.172.0. El marcador de D3 se mantiene como defensa, sobre todo pensando en Cursor.
- `apply_patch` llega como `tool_name: "apply_patch"`, con el parche en `tool_input.command` y cabeceras `*** Add File:`, `*** Update File:`, `*** Delete File:` y `*** Move to:`.

## Qué cambia respecto a v1

### Decisión nueva D6: cómo arrancan el MCP y los hooks en Codex

| Opción | Cómo funciona | Ventajas | Inconvenientes |
| --- | --- | --- | --- |
| **B (recomendada).** Binario global `wayfinder` para el MCP y los hooks | Requisito previo: `npm install -g @chinorris/wayfinder`. `plugin/.codex-plugin/plugin.json` apunta a `plugin/codex-mcp.json` (`command: "wayfinder"`, `args: ["mcp"]`, `env_vars` con `WAYFINDER_HOME`, `WAYFINDER_LANG`, `WAYFINDER_CAPTURES_DIR` y `WAYFINDER_WEB_HOST`) y a `plugin/hooks/codex-hooks.json` (`command: "wayfinder hook <evento>"`, `commandWindows: "wayfinder.cmd hook <evento>"`) | Una sola versión para MCP y hooks. El MCP arranca en el repositorio, así que la resolución del proyecto funciona igual que en Claude. Probado en 0.172.0. El paquete ya está instalado en este PC (1.0.0). Sin código nuevo de resolución | Dos pasos de instalación. Codex solo tiene `apply_patch` protegido y el marcador cuando se publique en npm la versión con este cambio, por ejemplo 1.1.0; hasta entonces el README lo indica. La prueba manual de Chidev usaría un `npm pack` local instalado globalmente y después volvería a 1.0.0 |
| C. Hooks desde el bundle del plugin (`node "${PLUGIN_ROOT}/dist/wayfinder.mjs" hook <evento>`), MCP desde el binario global | Igual que B para el MCP | Los hooks no dependen de npm | Hooks y MCP pueden quedar en versiones distintas; la instalación sigue teniendo dos pasos |
| A. Todo desde el bundle, con el MCP en `cwd: "."` | El MCP no conoce el repositorio. Habría que pasar `project` explícito en cada herramienta y añadir una ruta a `wf_project register`, validada contra la orden del hook | Un solo paso de instalación | Más código y superficie nueva en el registro. Los adjuntos y la comprobación del plan pierden la raíz del repositorio. Peor experiencia |

### Pasos sustituidos

- **Paso 2:** hecho. El resultado está arriba.
- **Paso 3 (sustituye a v1):** según D6, se añaden `plugin/.codex-plugin/plugin.json`, `plugin/hooks/codex-hooks.json` y `plugin/codex-mcp.json`. `plugin/hooks/hooks.json` y `.mcp.json` no cambian, porque Claude Code no se toca. Un test comprueba que `codex-hooks.json` declara los mismos eventos que `hooks.json` (salvo `PostToolUseFailure`, que Codex no tiene) y que su `PreToolUse` cubre `Bash` y `apply_patch`.
  - Validación: `npm test` y la reinstalación en un `CODEX_HOME` temporal con `codex plugin add`, comprobando que el hook de prompt registra una orden.
- **Paso 8:** además de lo previsto en v1, el README indica el requisito de `npm install -g @chinorris/wayfinder` (opciones B y C) y la versión mínima del paquete para Codex.
- **Paso 9:** el guion de Chidev instala primero el paquete local (`npm pack` y `npm install -g`) y al final restaura 1.0.0 con `npm install -g @chinorris/wayfinder@1.0.0`.

### Criterios de aceptación añadidos

- [ ] Con `CODEX_HOME` temporal, `codex plugin add` del marketplace local hace que `codex mcp list` muestre `wayfinder` sin placeholders sin expandir, y el hook de prompt registra órdenes.
- [ ] Claude Code sigue usando `plugin/hooks/hooks.json` y `.mcp.json` sin cambios.

## Preguntas que requieren decisión del usuario

- **D6.** ¿Opción B, C o A para el MCP y los hooks en Codex? **Recomendación: B.** Es la única que conserva la resolución del proyecto sin código nuevo, y una sola versión sirve a hooks y MCP. Su coste es un segundo paso de instalación y esperar a la publicación en npm para usarla de verdad.

## Estado del trabajo ya hecho (no depende de D6)

Los pasos 4 a 7 de v1 están implementados en la rama de trabajo y probados (68/68 en `test/codex.test.ts`, `test/hook.test.ts`, `test/chat.test.ts` y `test/i18n.test.ts`):
- `getHome` ignora `${…}`;
- `denyReason` reconoce `apply_patch`;
- marcador `[wayfinder-stop]`;
- fixtures reales de Codex y pruebas de contrato.
