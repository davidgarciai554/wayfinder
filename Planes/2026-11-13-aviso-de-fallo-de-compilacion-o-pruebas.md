# Plan: aviso a Claude cuando falla un comando de compilación o pruebas (WAY-17)

> Estado: aprobado (por el usuario, 2026-11-13, «Apruebo los cuatro»; D4 según la recomendación: sin estado)
> Versión: v1
> Tarea: WAY-17
> Revisa: `Planes/2026-10-23-registro-de-errores.md`, que excluyó la detección automática por hooks. Esta tarea, aprobada por ti, la reabre de forma acotada: el hook solo avisa, no crea nada.

## Contexto y objetivo

- **Problema:** registrar errores depende de que Claude recuerde la skill.
- **Resultado esperado:** cuando una orden de compilación, pruebas o análisis termina con error, Claude recibe un recordatorio para buscar con `wf_search` y registrar con `wf_error`. El hook no crea nada ni bloquea.
- **Evidencia del sistema actual:**
  - Hay cuatro eventos de hook: `session-start`, `prompt`, `pre-tool` y `stop` (`src/hook.ts:16`, `plugin/hooks/hooks.json`).
  - `runHook` devuelve 0 sin texto ante cualquier fallo (`hook.ts:311-313`).
  - El SessionStart solo usa textos fijos (i18n) y títulos neutralizados.
- **Hechos de la documentación oficial de hooks** (code.claude.com/docs/en/hooks; consultada por un subagente el 2026-11-13):
  - Un comando de Bash o PowerShell que termina con código distinto de 0 dispara `PostToolUseFailure`, no `PostToolUse`.
  - La entrada trae `tool_name`, `tool_input.command`, `error` (la primera línea es «Exit code N»), `is_interrupt` y `cwd`.
  - `{"hookSpecificOutput":{"hookEventName":"PostToolUseFailure","additionalContext":"…"}}` añade contexto sin bloquear.
  - El matcher `Bash|PowerShell` es el ejemplo de la documentación.
  - **No verificado todavía en una sesión real de Windows.**

## Alcance

- **Incluido:**
  - El evento de hook `post-tool-failure` y su entrada en `hooks.json`.
  - La detección del comando y el texto fijo en es y en.
  - Pruebas, README, skill y `dist`.
- **Excluido:**
  - Crear errores automáticamente.
  - Guardar estado o limitar avisos por tiempo (D4).
  - Cambios en `pre-tool`.
  - Repetir en el aviso el comando o su salida.
  - Comandos de otros ecosistemas que no estén en la lista inicial (D3).
  - Commit y actualización del plugin.

## Decisiones de la mesa redonda

**Las marcadas con (P) necesitan tu confirmación**; si no dices nada, la aprobación del plan las acepta como están.

| # | Decisión | Evidencia y motivo | Alternativas descartadas | Riesgo o consecuencia |
| --- | --- | --- | --- | --- |
| D1 | **Evento `PostToolUseFailure`** con matcher `Bash\|PowerShell`, y un evento nuevo `post-tool-failure` en `HOOK_EVENTS`. | La documentación oficial dice que un fallo con código distinto de 0 llega por ese evento. | `PostToolUse`: no recibe los fallos. | Un evento desconocido para una versión vieja del bundle sale con 0 sin texto. |
| D2 | **Condiciones del aviso:** proyecto registrado; `is_interrupt` distinto de `true`; la primera línea de `error` es `Exit code N` con N distinto de 0; y el comando, recortado a 2000 caracteres, contiene una orden de la lista (D3). Si no se cumple todo, no hay salida. | Seguridad y calidad: tipos comprobados con `typeof` y fallo silencioso como el resto de `runHook`. | — | — |
| D3 | **Lista inicial cerrada.** El comando se trocea por `&&`, `\|\|`, `;`, `\|` y saltos de línea, y cada trozo se compara (sin cuantificadores anidados) con: `npm`, `pnpm`, `yarn` o `bun` seguidos de `test`, o de `run` con un script que empiece por `test`, `build`, `typecheck`, `lint` o `check`; `npx` con `tsc`, `vitest`, `jest`, `playwright test` o `eslint`; `tsc`; `vitest`; `jest`; `playwright test`; `node --test`; `pytest`; `cargo` con `build`, `test`, `check` o `clippy`; `go` con `build`, `test` o `vet`; `dotnet` con `build` o `test`; `make`. | El negador y el técnico de solución mínima pedían una lista corta basada en el uso real. Esta cubre este repositorio y los ecosistemas habituales. | La lista larga del borrador (mvn, gradle, ruff, mypy…): se añade cuando haya un caso. | Un comando citado dentro de un `echo` puede dar un falso positivo. Solo genera ruido y nunca tiene efecto. |
| D4 (P) | **Sin estado**: un aviso por cada comando que falla. | La solución más simple. Un archivo en `.state` con límite por sesión es complejidad sin datos de ruido real (solución mínima). | Deduplicar por `session_id` en `.state` (negador). | En TDD, Claude recibe el aviso en cada fallo esperado. El texto lo aclara (D5) y es corto. Se revisará con el uso. |
| D5 | **Texto fijo** i18n, sin repetir nada de la entrada: «Wayfinder: ha fallado un comando de compilación o pruebas. Si es un fallo nuevo e inesperado, búscalo con wf_search y regístralo con wf_error ligado a la tarea en curso; si es un fallo esperado (por ejemplo, una prueba escrita antes del código), ignora este aviso.» | El comando y la salida son texto no confiable (seguridad). | Repetir el comando: abre una vía de inyección. | — |

## Preguntas que requieren decisión del usuario

- **D4 (P):** ¿aviso sin estado (recomendado) o como mucho uno por sesión y comando?

## Plan de implementación

1. `src/hook.ts`:
   - `post-tool-failure` en `HOOK_EVENTS`.
   - Función pura `isBuildOrTestCommand(command: string): boolean` con la lista de D3, exportada para las pruebas.
   - Rama en `runHook`, después de `projectFor` (solo proyectos registrados), con las condiciones de D2 y la salida de D1 con el texto de D5.
   - Validación: `npm run typecheck`.
2. `plugin/hooks/hooks.json`: entrada `PostToolUseFailure` con matcher `Bash|PowerShell` y `node ${CLAUDE_PLUGIN_ROOT}/dist/wayfinder.mjs hook post-tool-failure`.
3. `src/cli.ts`: comprobar que `hook <evento>` acepta el evento nuevo (usa `HOOK_EVENTS`).
4. `src/i18n/es.json` y `src/i18n/en.json`: `hook.postToolFailure.reminder`.
   - Validación: `test/i18n.test.ts`.
5. `test/hook.test.ts`:
   - Tabla de comandos positivos: `npm test`, `npm run build`, `npm run test:e2e`, `cd x && npm test`, `npx tsc --noEmit`, `node --test`, `pytest -q`, `cargo test` y `dotnet build`.
   - Tabla de negativos: `npm install`, `git status`, `npm run testimonial` (debe rechazarse), `ls` y `echo hola`.
   - Condiciones de D2:
     - `Exit code 0`, `error` ausente o de otro tipo;
     - `is_interrupt: true`;
     - proyecto no registrado;
     - JSON inválido.
   - Texto exacto en es y en, sin el comando aunque este contenga `<<<` o instrucciones.
   - Código 0 y nada escrito en la carpeta de datos.
   - Prueba del bundle por stdin y stdout, como las que ya hay.
   - Validación: `npm test`.
6. `README.md` (sección de hooks) y `plugin/skills/wayfinder/SKILL.md` (sección Errors: «un hook puede recordártelo; si el fallo es esperado, ignóralo»). `dist` y `plugin/dist` reconstruidos.
   - Validación: `npm run check:dist` y `claude plugin validate plugin`, si está disponible.

## Criterios de aceptación

- [ ] Un fallo con código distinto de 0 de un comando de la lista, en un proyecto registrado, produce `PostToolUseFailure` con el texto fijo.
- [ ] Cualquier otro caso (otro comando, código 0, interrupción, proyecto no registrado o entrada rara) no produce salida y sale con 0.
- [ ] El aviso nunca contiene texto del comando ni de su salida.
- [ ] El hook no escribe nada y nunca bloquea.
- [ ] `hooks.json` incluye el evento, y `npm run typecheck`, `npm test` y `npm run check:dist` están en verde.
- [ ] **Verificación real:** en una sesión de Claude Code en Windows con el plugin actualizado, un `npm test` que falla muestra el aviso (D1). Si no se puede hacer, la tarea se cierra como **no verificada en sesión real**.

## Estrategia de validación

- **Pruebas específicas:** `test/hook.test.ts`, con la función de detección y la prueba de stdin y stdout del bundle.
- **Validaciones amplias:** `npm run typecheck`, `npm test` y `npm run check:dist`. `test:e2e` y `test:docker` no aplican.
- **Verificación funcional:**
  - Ejecutar el bundle con un JSON de ejemplo por stdin.
  - La sesión real necesita actualizar el plugin instalado, que requiere tu autorización. Hasta entonces, queda **bloqueado/no verificado** que Claude Code entregue el evento con el formato documentado en Windows.
- **Seguridad:** texto fijo sin repetir la entrada, comando recortado, expresiones sin cuantificadores anidados y fallo silencioso. Sin escritura ni red.

## Riesgos y reversión

- **Riesgo:** ruido en ciclos de TDD. Mitigación: el texto aclara que el aviso se ignora si el fallo es esperado. Residual: aceptado y revisable (D4).
- **Riesgo:** que el evento no se dispare en Windows. Mitigación: la verificación real como criterio. Residual: la tarea no se cierra como verificada sin ella.
- **Riesgo:** falsos negativos con herramientas que no están en la lista. Mitigación: se amplía con evidencia.
- **Reversión:** quitar la entrada de `hooks.json` desactiva el aviso. No hay datos que revertir.

## Desacuerdos residuales

- **Ruido.** El negador proponía deduplicar por `session_id`; el técnico de solución mínima, nada de estado. Recomendación: sin estado, y medir antes de añadir estado (D4).
- **Reabrir la exclusión.** El negador pedía tu decisión para reabrir la exclusión del plan de errores. La propia tarea (aprobada por ti) lo propone y pide un plan propio. Lo dejo explícito aquí para que tu aprobación lo cubra.

## Notas de implementación

> Anotaciones posteriores a la aprobación. No cambian el alcance aprobado.

- **2026-11-13:**
  - `isBuildOrTestCommand` y `failureReminder` en `src/hook.ts`, rama `post-tool-failure` después de comprobar que el proyecto está registrado, y entrada `PostToolUseFailure` en `plugin/hooks/hooks.json`. `src/cli.ts` no cambia: valida contra `HOOK_EVENTS`.
  - Añadidos pequeños a la lista de D3, dentro de su espíritu: `npm t` (alias de `npm test`) y las asignaciones de variables delante del comando (`CI=1 npm test`), que se quitan de una en una sin cuantificadores anidados.
  - Las pruebas están en un archivo propio, `test/post-tool-failure.test.ts`, en lugar de `test/hook.test.ts`, para no alargar ese archivo.
  - Validación: `npm run typecheck`, `npm test` (173/173), `npm run check:dist` y `claude plugin validate plugin`.
  - **Verificación real (después de autorizarla):** sesión de Claude Code 2.1.322 en Windows 11, lanzada por la persona con `probar-way17.ps1`. Usó el plugin de desarrollo (`--plugin-dir plugin`), una carpeta de datos temporal con un proyecto registrado, ningún servidor MCP y un repositorio cuyo `npm test` falla. Resultados:
    - `npm test` con Bash y con PowerShell: los dos dan «Exit code 1» en la primera línea de `error` y disparan `PostToolUseFailure:Bash` y `PostToolUseFailure:PowerShell`;
    - el hook devuelve el texto fijo en español en los dos casos, y Claude confirma que lo recibió;
    - SessionStart, UserPromptSubmit, PreToolUse y Stop terminan sin error.
    - El criterio de verificación real queda cumplido. Lanzarla desde Claude no fue posible: el pre-tool del plugin instalado rechaza los comandos que mencionan la variable de la carpeta de datos (protección prevista, que no se eludió).
