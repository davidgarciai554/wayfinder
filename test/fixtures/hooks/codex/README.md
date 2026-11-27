Payloads de stdin capturados de Codex CLI 0.172.0 en Windows 11 (2026-11-26, WAY-7) con un hook que volcaba su entrada.
Se han sustituido por marcadores las rutas y los identificadores: `<CWD>` (la carpeta del repositorio), `<TRANSCRIPT>`, `<SESSION>`, `<TURN>` y `<TOOL_USE>`.
Hechos observados en la misma captura: Codex ignora `args` en los hooks (solo ejecuta `command` como cadena), sustituye `${PLUGIN_ROOT}` en los comandos de hooks de plugin, la continuación de `Stop` no pasa por `UserPromptSubmit` y no hay `CLAUDE_PROJECT_DIR`.
