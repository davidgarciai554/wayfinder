# Plan: Llevar Wayfinder a Codex, Copilot, Gemini CLI y Cursor (WAY-7)

> Estado: aprobado
> Versión: v1
> Aprobación: Chidev, 2026-11-26 15:43 (vía Captain): «esta aprobada way-7 trabaja en ella». D1–D5 aprobadas tal como se recomiendan.
> Tarea: WAY-7 (propuesta). Base: `main` en cece1a1 (1.0.0, `@chinorris/wayfinder`).

## Contexto y objetivo

- Problema u oportunidad: Wayfinder solo funciona completo en Claude Code, con un servidor MCP stdio, cinco hooks (SessionStart, UserPromptSubmit, PreToolUse, PostToolUseFailure, Stop) y una skill. La persona usa también otros agentes; en ChinorrisPC están instalados Codex CLI 0.172.0, GitHub Copilot CLI 1.0.6-1, Gemini CLI 0.56.0, Antigravity 1.107.0 y Claude Code 2.1.332 (Cursor no).
- Resultado esperado: Wayfinder utilizable en otros agentes con su mecanismo de instalación propio, sin debilitar en silencio ninguna garantía. Lo que no se pueda conservar en un agente se declara en la documentación y falla cerrado.
- Evidencia del sistema actual:
  - `plugin/.claude-plugin/plugin.json` (`userConfig`: home, capturesDir, webHost, language), `plugin/.mcp.json` (`node ${CLAUDE_PLUGIN_ROOT}/dist/wayfinder.mjs mcp`, `WAYFINDER_HOME=${user_config.home}`), `plugin/hooks/hooks.json` (formato Claude: `"command": "node"` + `"args": [...]`), `plugin/skills/wayfinder/SKILL.md`, marketplace en `.claude-plugin/marketplace.json`.
  - `src/hook.ts` lee stdin con nombres de Claude (`prompt`, `cwd`, `tool_name`, `tool_input.file_path/command`, `error` «Exit code N», `stop_hook_active`); proyecto = `CLAUDE_PROJECT_DIR || cwd`; `denyReason` solo reconoce `Edit`, `Write`, `NotebookEdit`, `Bash`, `PowerShell` y algunas herramientas MCP.
  - `src/store/approve.ts` (`approveByChat`) exige una orden fresca (15 min) que solo escribe el hook `prompt` a partir del texto literal de la persona (`src/store/mentions.ts`); sin hook falla cerrado con `chat.noOrder`. `wf_project register` y `wf_web` dependen igual de órdenes del hook.
  - `isAutomatedTurn` (`src/store/mentions.ts:77`) solo reconoce prefijos de Claude (`<task-notification|agent-message|scheduled-task`).
  - `getHome` (`src/store/paths.ts:14`) acepta un valor `${...}` sin expandir; `hookEnv` (`src/hook.ts`) sí lo descarta.
  - Con un cwd no registrado (p. ej. `/`), `resolveProject` devuelve `resolve.notRegistered` y `wf_project` exige un repositorio git: falla cerrado.

### Garantías de Wayfinder que dependen de hooks

| Id | Garantía | Mecanismo actual |
| --- | --- | --- |
| G1 | Aprobación de ideas por chat solo por la persona | Hook `prompt` registra la orden; `approveByChat` la exige |
| G2 | Registro del proyecto y apertura de la web solo por orden de la persona | Hook `prompt` (órdenes de registro y web) |
| G3 | Avance registrado antes de terminar | Hook `stop` con `decision: block` |
| G4 | No editar la carpeta de datos ni pedir la clave web (heurística) | Hook `pre-tool` con `deny` |
| G5 | Contexto de tareas, historial y errores al iniciar | Hook `session-start` con `additionalContext` |
| G6 | Recordatorio de registrar fallos de build/test | Hook `post-tool-failure` |
| G7 | Los turnos automáticos no dan órdenes | `isAutomatedTurn` |

## Matriz por agente (documentación oficial leída el 2026-11-26, sin probar)

Fuentes: learn.chatgpt.com/docs/hooks y developers.openai.com/plugins/build/plugins (Codex); docs.github.com/en/copilot/reference/hooks-reference, la referencia de plugins de la CLI y code.visualstudio.com/docs/agent-customization/hooks (Copilot); geminicli.com/docs/hooks/reference y /extensions/reference, blog de Google del 19-05-2026 (Gemini); antigravity.google/docs/hooks y /plugins (Antigravity); cursor.com/docs/hooks, /reference/plugins y /reference/third-party-hooks (Cursor).

| Aspecto | Codex (CLI y escritorio) | Copilot CLI / VS Code | Gemini CLI | Antigravity CLI (sustituto de Gemini) | Cursor |
| --- | --- | --- | --- | --- | --- |
| MCP stdio | Sí (`config.toml` o `mcp.json` del plugin). Codex Desktop arranca MCP con cwd `/` (issue #16390) | Sí (`.mcp.json`/`mcp.json` del plugin) | Sí (`gemini-extension.json`, `${extensionPath}`, `${workspacePath}`) | Sí (plugin) | Sí (`mcp.json` del plugin, `${CURSOR_PLUGIN_ROOT}`/`${CLAUDE_PLUGIN_ROOT}`) |
| Hook de prompt (G1, G2) | `UserPromptSubmit` con `prompt` y `additionalContext`; formato Claude | `userPromptSubmitted` con `prompt`; la salida de hooks de comando se descarta (el efecto lateral de escribir la orden sí funciona) | `BeforeAgent` con `prompt` y `additionalContext` | No hay; solo `lastUserInput` en `PreInvocation` (cada llamada al modelo) | `beforeSubmitPrompt` con `prompt`; solo bloquear, sin inyectar contexto |
| Hook de parada (G3) | `Stop` con `decision: block`; el `reason` se reenvía como **nuevo prompt de usuario**; `stop_hook_active` | `agentStop` con `decision: block`; guardia de 8 continuaciones | `AfterAgent` con `deny` (reintento con `reason` como prompt) | `Stop` con `decision: "continue"` | `stop` con `followup_message`, enviado como **mensaje de usuario**; `loop_limit` 5 |
| Bloqueo de herramientas (G4) | `PreToolUse` deny; `apply_patch` como Edit/Write; «guardrail, no frontera completa» | `preToolUse` deny; formato PascalCase usa nombres de herramienta de Claude | `BeforeTool` deny (`run_shell_command`, `write_file`, `replace`) | `PreToolUse` deny | `preToolUse`/`beforeShellExecution` deny; Bash→Shell, Edit→Write; `failClosed` opcional |
| Contexto inicial (G5) | `SessionStart` | `sessionStart` | `SessionStart` | `SessionStart` | `sessionStart` (fire-and-forget) |
| Fallo de herramienta (G6) | No hay `PostToolUseFailure` | `postToolUseFailure` | `AfterTool` (`tool_response.error`) | `PostToolUse` | `postToolUseFailure` |
| Skill / instrucciones | Skills en plugin; `AGENTS.md` | Skills en plugin | `skills/`, `contextFileName` | Skills y reglas en plugin | Skills y reglas en plugin |
| Distribución | `codex plugin marketplace add owner/repo` + `/plugins`; lee `.claude-plugin/marketplace.json` y manifiestos Claude (legacy); hooks de plugin exigen revisión y confianza en `/hooks`; plugins con hooks no entran en el directorio público | `copilot plugin marketplace add` + `copilot plugin install`; acepta `.claude-plugin/` (legacy); issue abierto: hooks de plugins fallan en Windows (#3659 → #2540) | `gemini extensions install <repo>` | `/plugin` o carpeta local | Marketplace con revisión; sin CLI de instalación documentada; carga hooks de Claude de `settings.json`, no documenta los de plugins Claude |
| Estado | Activo | Hooks en preview en VS Code | **Desde el 18-06-2026 solo para licencias Code Assist Standard/Enterprise** | Activo, sustituto | Activo; no instalado en ChinorrisPC |

### Garantías que se conservan o pierden (previsión, a verificar por agente)

| Garantía | Codex | Copilot | Gemini CLI | Antigravity | Cursor |
| --- | --- | --- | --- | --- | --- |
| G1/G2 órdenes solo de la persona | Se conserva si el hook está confiado; si no, falla cerrado | Se conserva (efecto lateral); se pierde el aviso de «apruebo» ambiguo | Se conserva | **No por chat**: solo web hasta verificar `lastUserInput` | Se conserva si carga el hook; si no, falla cerrado |
| G3 avance antes de terminar | Se conserva; el reenvío como prompt exige el marcador de D3 | Se conserva (tope 8) | Se conserva | Se conserva (sin verificar) | Degradada: `loop_limit` la desactiva en silencio al agotarse |
| G4 protección de datos | Solo si `denyReason` reconoce `apply_patch` | Se conserva con formato PascalCase | Requiere mapear nombres | Requiere mapear nombres | Requiere mapear Shell/Write |
| G5 contexto | Se conserva | Se conserva | Se conserva | Se conserva | Se conserva (puede llegar tarde) |
| G6 recordatorio de fallos | **Se pierde** (solo recordatorio) | Se conserva adaptando `error` | Adaptar | Adaptar | Adaptar |
| G7 turnos automáticos | Necesita marcador (D3) | No aplica | Necesita marcador | Sin verificar | Necesita marcador |

## Orden recomendado

1. **Codex primero.** Es el único donde el plugin actual se reutiliza casi tal cual: lee `.claude-plugin/marketplace.json` y el manifiesto Claude, define `CLAUDE_PLUGIN_ROOT`, sus hooks usan los mismos nombres y salidas (`hookSpecificOutput`, `decision: block`, `permissionDecision`), tiene hook de prompt completo y hook de parada que bloquea, y está instalado en ChinorrisPC (0.172.0), así que se puede verificar de verdad.
2. **Copilot CLI** después: acepta el manifiesto Claude y el formato PascalCase con nombres de Claude; su hook de prompt sirve para G1 aunque descarte la salida. Queda segundo por el fallo abierto de hooks de plugins en Windows, que hay que comprobar antes.
3. **Cursor**: hooks de plugin compatibles, pero G3 limitado por `loop_limit` y no está instalado, así que hoy no se puede verificar.
4. **Google, como Antigravity CLI y no Gemini CLI**, al final: Gemini CLI ya no atiende a usuarios gratuitos ni Pro/Ultra, y Antigravity no tiene hook de prompt, así que la aprobación por chat quedaría desactivada (solo web) hasta verificarla.

Cada agente posterior a Codex es un incremento con su propio plan. Este plan solo autoriza el primero.

## Alcance

- Incluido (incremento 1, Codex CLI en Windows): el plugin actual instalable en Codex desde el marketplace del repo; correcciones mínimas para que G1–G5 y G7 funcionen o fallen cerrado; pruebas con fixtures reales de Codex; documentación (inglés y español) con la matriz de garantías.
- Excluido: Copilot, Cursor, Gemini CLI y Antigravity; un instalador propio (`wayfinder install <agente>`); una capa genérica de adaptadores; Codex Desktop y la extensión de IDE (solo se intenta si el cwd del MCP resulta correcto; si no, se declara no soportado); publicación en el directorio público de OpenAI (excluye plugins con hooks); simular G6 con `PostToolUse`; cambiar `userConfig` para Claude.
- Supuestos y restricciones: las pruebas usan `WAYFINDER_HOME` en una carpeta temporal y nunca tocan `~/.wayfinder`; instalar el plugin en el Codex de la persona y confiar sus hooks requiere su autorización (D4); `test/server.test.ts:139` falla ya en este PC (IP de Tailscale). Sin verificar: que Codex ignore `args`, el formato del stdin de `apply_patch`, si el texto de continuación de `Stop` pasa por `UserPromptSubmit`, y el cwd del MCP en la CLI.

## Decisiones de la mesa redonda

Mesa proporcional: analista (responsable), negador y técnico de solución mínima, seguridad y datos y calidad y validación (subagentes de solo lectura), y síntesis.

| Decisión | Evidencia y motivo | Alternativas descartadas | Riesgo o consecuencia |
| --- | --- | --- | --- |
| Empezar por Codex, y solo Codex | Formato más cercano a Claude; lee manifiestos Claude; está instalado | Los cuatro a la vez (alcance grande sin verificación posible) | Los demás esperan a sus incrementos |
| Instalación con el mecanismo nativo | `codex plugin marketplace add` lee `.claude-plugin/marketplace.json` | Instalador propio con copia de seguridad y desinstalación (código que mantener sin necesidad hoy) | La persona hace a mano `/hooks`; es intencionado y no se automatiza |
| Reutilizar `plugin/hooks/hooks.json` si Codex respeta `args`; si no, una forma de `command` común verificada en ambos agentes; en último caso un `hooks.json` propio de Codex | Codex documenta `command` como cadena de shell (con `commandWindows`) y no documenta `args` | Duplicar el plugin | Un segundo fichero de hooks puede divergir; un test comprobaría que coinciden |
| `getHome` ignora valores con `${` | `paths.ts:14` frente a `hookEnv`; si un agente no expande `${user_config.home}`, el MCP escribiría en otra carpeta que el hook (división silenciosa de datos) | Ninguna; es el cambio mínimo | Ninguno para Claude, que sí expande |
| `denyReason` reconoce `apply_patch` de Codex extrayendo las rutas del parche | Sin esto, G4 pasa a no hacer nada en silencio en Codex | Declarar G4 no soportado en Codex | El formato exacto se confirma con un fixture real antes de codificar |
| Marcador fijo al inicio del `reason` de Stop, reconocido por `isAutomatedTurn` (D3) | En Codex el `reason` vuelve como prompt de usuario; hoy se trataría como humano y **borraría** la orden pendiente (`recordOrders` sustituye las anteriores) | Confiar en que el texto no contiene órdenes (cierto hoy, pero sigue borrando) | Cambio visible en Claude (el modelo ve el marcador en el motivo del bloqueo) |
| Sin hook de prompt confiado, G1/G2 fallan cerrado; no se relajan | `approveByChat` → `chat.noOrder` | Permitir aprobar por chat sin orden (debilita la garantía principal) | La persona aprueba desde la web |
| Antigravity en lugar de Gemini CLI, aplazado y sin aprobación por chat hasta verificar | Gemini CLI limitado a licencias de empresa desde el 18-06-2026; Antigravity no tiene evento de prompt | Invertir en Gemini CLI | Cambia el título de WAY-7 (lo decide la persona) |

## Preguntas que requieren decisión del usuario

- D1. Alcance: ¿apruebas que el primer incremento sea solo Codex CLI en Windows, y que cada uno de los demás agentes tenga su propio plan? Recomendación: sí.
- D2. Gemini: ¿se sustituye Gemini CLI por Antigravity CLI en WAY-7 y se aplaza, con la aprobación por chat desactivada allí hasta verificarla? Depende de si tienes licencia Code Assist Standard/Enterprise, la única con la que Gemini CLI sigue funcionando. Recomendación: sustituir y aplazar.
- D3. Marcador en el motivo del hook Stop: ¿se añade un prefijo fijo (p. ej. `[wayfinder-stop]`) que `isAutomatedTurn` trate como turno automático, para que la continuación no dé ni borre órdenes en Codex? Claude también verá el prefijo. Recomendación: sí.
- D4. Prueba en tu Codex: ¿autorizas instalar el plugin en tu Codex (añadir el marketplace y confiar los hooks en `/hooks`) para la verificación manual, con `WAYFINDER_HOME` temporal, y desinstalarlo después? La alternativa es que hagas tú esos pasos con un guion. Recomendación: que hagas tú `/hooks`, porque es el paso de confianza.
- D5. Configuración en Codex, que no tiene `userConfig`: ¿se aceptan los valores por defecto (`~/.wayfinder`; idioma de `config.json` o `es`) y se documentan `WAYFINDER_HOME`/`WAYFINDER_LANG` como variables de entorno para cambiarlos? Recomendación: sí.

## Plan de implementación (incremento 1, tras la aprobación)

1. Capturar payloads reales de Codex 0.172.0 en Windows. En un repositorio git temporal, un hook de proyecto `.codex/hooks.json` vuelca stdin a una carpeta temporal para SessionStart, UserPromptSubmit, PreToolUse (Bash y apply_patch), Stop y la continuación de Stop. También se registra el cwd con que Codex arranca el MCP (`codex mcp` con un servidor de eco temporal). Los volcados se anonimizan en `test/fixtures/hooks/codex/*.json`.
   - Validación: los fixtures existen, no tienen rutas personales ni secretos, y responden a los supuestos de Alcance. Si alguno contradice materialmente el plan, se detiene el trabajo y se eleva.
2. Comprobar el formato de `command`. En ese repositorio temporal, ver si Codex ejecuta `"command": "node", "args": [...]`. Si no, probar la cadena `node "${CLAUDE_PLUGIN_ROOT}/dist/wayfinder.mjs" hook <evento>` (más `commandWindows` si hace falta) en Codex y en Claude Code 2.1.332.
   - Validación: cada hook escribe su efecto en un `WAYFINDER_HOME` temporal en ambos agentes.
3. `plugin/hooks/hooks.json`: solo si el paso 2 lo exige, pasar a la forma común verificada. Si no hay forma común, añadir un `hooks.json` de Codex referenciado desde `plugin/.codex-plugin/plugin.json`, con un test que compare los eventos de ambos.
   - Validación: `npm test` (test nuevo de coherencia de hooks) y Claude Code sigue registrando órdenes en la prueba manual.
4. `src/store/paths.ts` (`getHome`): ignorar valores vacíos o con `${` y caer a `~/.wayfinder`, igual que `hookEnv`.
   - Validación: test unitario nuevo en `test/` con `WAYFINDER_HOME="${user_config.home}"`.
5. `src/hook.ts` (`denyReason` e `inspectableText`): reconocer `tool_name: apply_patch`, extraer las rutas de las cabeceras del parche con el formato del fixture del paso 1, y aplicar la regla de Edit/Write.
   - Validación: tests con el fixture real; denegar un parche sobre `WAYFINDER_HOME` y permitir uno fuera.
6. Solo si D3 se aprueba: `src/i18n/es.json` y `en.json` (`hook.stop.reason`) y `src/store/mentions.ts` (`AUTOMATED_TURN`) con el prefijo fijo y su reconocimiento.
   - Validación: tests de que la continuación de Stop (fixture de Codex) ni crea ni borra órdenes, y de que ningún texto de Stop en `es`/`en` produce órdenes (`extractOrders`, `isBareApproval`).
7. Tests de contrato de hooks con los fixtures de Codex en `test/`, con el patrón actual de `runHook` + `HookIo` y `WAYFINDER_HOME` temporal:
   - cada fixture de evento produce la salida esperada;
   - `approveByChat` sin orden lanza `chat.noOrder`;
   - un MCP con cwd `/` falla cerrado (`resolve.notRegistered`, sin registrar nada).
   - Validación: `npm test`.
8. `README.md`, `README.es.md` y `CHANGELOG.md`:
   - sección «Codex»: instalación (`codex plugin marketplace add davidgarciai554/wayfinder` y `/plugins`), revisión en `/hooks` (y otra vez tras cada actualización), `WAYFINDER_HOME`/`WAYFINDER_LANG` y desinstalación;
   - matriz de garantías del agente, marcando como soportado solo lo verificado;
   - limitaciones: sin G6, G4 heurística, Codex Desktop solo si el paso 1 lo confirma;
   - entrada en el registro de cambios.
   - Validación: revisión del diff; los comandos documentados se ejecutaron en el paso 9.
9. Verificación manual en Codex CLI, con la autorización de D4, `WAYFINDER_HOME` temporal y un repositorio de prueba:
   1. instalar desde el marketplace local;
   2. confiar los hooks;
   3. comprobar el contexto de inicio;
   4. escribir «registra este proyecto»;
   5. crear una propuesta, aprobarla con «aprueba WAY-1» y comprobar que sin orden se rechaza;
   6. con una tarea in-progress sin avance, comprobar que Stop bloquea una vez y no entra en bucle;
   7. comprobar que se deniega editar `WAYFINDER_HOME` con `apply_patch` y con la shell;
   8. desinstalar.
   - Validación: versión exacta de Codex y resultado de cada paso en el informe de cierre.

## Criterios de aceptación

- [ ] El plugin se instala en Codex CLI 0.172.0 en Windows con el marketplace del repo, sin instalador propio, y se desinstala sin dejar configuración de Wayfinder.
- [ ] Con los hooks confiados, «registra este proyecto» registra el repo y «aprueba WAY-n» aprueba una propuesta revisada. Sin hooks confiados, la aprobación falla con `chat.noOrder`.
- [ ] Stop bloquea una vez si hay una tarea in-progress sin avance de hoy, y la continuación no crea ni borra órdenes.
- [ ] Editar la carpeta de datos con `apply_patch` o con la shell se deniega en Codex.
- [ ] Un `WAYFINDER_HOME` con `${...}` sin expandir no crea carpetas literales: se usa `~/.wayfinder`.
- [ ] El MCP con cwd `/` no registra ni escribe en un proyecto adivinado.
- [ ] Claude Code 2.1.332 sigue funcionando igual (órdenes, Stop, deny).
- [ ] El README en ambos idiomas documenta la matriz de garantías de Codex, y nada sin verificar aparece como soportado.
- [ ] Copilot, Cursor y Antigravity quedan como tareas aparte (las crea la persona) con su previsión de garantías.

## Estrategia de validación

- Pruebas específicas: `node --test` con los fixtures de Codex (`npm test` incluye `pretest` → `npm run build`).
- Validaciones amplias: `npm run typecheck`, `npm test` (fallo conocido en `test/server.test.ts:139`), `npm run check:dist` tras regenerar `plugin/dist`, y `npm run test:acceptance` si toca el bundle.
- Verificación funcional: el paso 9 en Codex CLI y una prueba de regresión en Claude Code, ambas con `WAYFINDER_HOME` temporal.
- Seguridad:
  - el texto de Stop es fijo y no da órdenes (test);
  - G1 falla cerrado sin hook (test);
  - no quedan `${` sin expandir (test);
  - los fixtures están anonimizados;
  - no se tocan `~/.wayfinder` ni `~/.codex` sin D4.

## Riesgos y reversión

- Riesgo: Codex cambia su formato de hooks o de plugins (el producto evoluciona deprisa). Mitigación: los fixtures fijan la versión probada y el README la nombra.
- Riesgo: la confianza de `/hooks` se pierde en cada actualización del bundle; Codex pide revisar de nuevo y, mientras tanto, G1 falla cerrado. Mitigación: documentarlo en «Actualizar».
- Riesgo: el marcador de D3 se ve en Claude. Mitigación: es un cambio de texto inocuo y reversible.
- Riesgo: el hook y el MCP resuelven proyectos distintos. Mitigación: la prueba de contrato del paso 7. Si en la CLI el cwd del MCP no es el repo, se detiene el trabajo y se eleva la decisión (`roots/list` o `project` explícito).
- Reversión: los cambios son aditivos y pequeños (`paths.ts`, `hook.ts`, `mentions.ts`, i18n, README y, si hace falta, un manifiesto de Codex). Basta revertir el commit; los datos de la persona no cambian de formato.

## Desacuerdos residuales

- Copilot y G1: el negador sostuvo que G1 se pierde porque Copilot descarta la salida de `userPromptSubmitted`. Seguridad respondió que G1 solo necesita el efecto lateral del hook (escribir la orden), que sigue funcionando. Recomendación: prevalece seguridad, pendiente de verificar en su incremento. Solo se pierde el aviso de «apruebo» ambiguo.
- Marcador de Stop (D3): hay acuerdo en que es útil, pero queda como decisión de la persona porque cambia un texto visible también en Claude.
