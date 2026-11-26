# Plan: Documentación de la 1.0 en inglés y en español (WAY-29)

> Estado: aprobado el 2026-11-26 (la persona, a través del Captain: «1 apruebo»). P1: opción A, la recomendada, porque la persona no eligió otra (indicación del Captain).
> Versión: v1
> Fecha: 2026-11-25. Rama de destino: `main` (dab23aa). Tarea: WAY-29.

## Contexto y objetivo
- Problema: el README solo está en español, no explica cómo desinstalar ni cómo hacer una copia de seguridad, usa «desde esta versión» o «antes de esta versión» sin número y no nombra `wf_project`, `wf_web`, `wf_review` ni `wf_set_status`. `plugin/.claude-plugin/plugin.json:14` todavía pide ejecutar «wayfinder init» una vez.
- Resultado esperado: una persona que no conoce el proyecto instala, actualiza y desinstala Wayfinder siguiendo solo el README, en inglés (`README.md`) o en español (`README.es.md`), con el mismo contenido.
- Evidencia del sistema actual:
  - `README.md` (340 líneas, en español). Frases sin número: `README.md:69`, `:76`, `:82`, `:84`, `:245` y `CHANGELOG.md:12`.
  - `src/mcp.ts` registra 14 herramientas: `wf_project`, `wf_web`, `wf_list`, `wf_get`, `wf_create`, `wf_update`, `wf_set_status`, `wf_review`, `wf_log`, `wf_history`, `wf_search`, `wf_error`, `wf_errors` y `wf_attach`.
  - `src/store/paths.ts:14`: la carpeta de datos es `WAYFINDER_HOME` o `~/.wayfinder`. `src/hook.ts:60` la toma también de `CLAUDE_PLUGIN_OPTION_HOME`.
  - `CHANGELOG.md`: no hay ninguna versión publicada; todo se ha distribuido como `0.1.0`. WAY-31 subirá a 1.0.0.
- **Sonda ya hecha (solo lectura respecto al repositorio y a `~/.claude`)**, Claude Code 2.1.332, con `CLAUDE_CONFIG_DIR` y `WAYFINDER_HOME` en una carpeta de `%TEMP%`:
  - `claude plugin install wayfinder --marketplace davidgarciai554/wayfinder --config language=es` instala desde GitHub `wayfinder@wayfinder` 0.1.0 en `<config>/plugins/cache/wayfinder/wayfinder/0.1.0`. `node "<installPath>/dist/wayfinder.mjs" --version` imprime `0.1.0`.
  - `claude plugin marketplace update wayfinder` + `claude plugin update wayfinder@wayfinder` → «already at the latest version (0.1.0)».
  - `claude plugin uninstall wayfinder@wayfinder` + `claude plugin marketplace remove wayfinder`: `settings.json` queda con `enabledPlugins`, `extraKnownMarketplaces` y **`pluginConfigs` vacíos** (las opciones se borran al desinstalar). Queda la carpeta `plugins/cache/wayfinder/wayfinder/0.1.0`. La carpeta de datos no se toca.
  - `claude plugin configure wayfinder` falla («No installed plugin has the id "wayfinder"»): hace falta `wayfinder@wayfinder`. El README actual (`:40`, `:177`) lo escribe mal.
  - `~/.claude` del usuario sin cambios (mtime de `settings.json`, `installed_plugins.json` y `known_marketplaces.json` iguales antes y después).

## Alcance
- Incluido:
  - `README.md` pasa a inglés y es el principal; `README.es.md` nuevo en español, con el mismo contenido y las mismas secciones. Un enlace entre ellos en la primera línea.
  - Reordenar: requisitos, instalar, primer uso, actualizar, desinstalar, copia de seguridad y restauración, y después la referencia (herramientas MCP, reglas, web, CLI, formato, seguridad, desarrollo, Docker).
  - Sección nueva «Desinstalar»: comandos comprobados, qué se borra (plugin, marketplace, opciones) y qué queda (carpeta de datos y la carpeta de caché vacía, si se confirma). Para la CLI global: `npm uninstall -g @davidgarciai554/wayfinder`. Para Docker: `docker image rm wayfinder:dev`.
  - Sección nueva «Copia de seguridad y restauración» de `~/.wayfinder` (o la carpeta de `home`), sin remoto: cerrar las sesiones de Claude y la web, copiar la carpeta entera (incluye `.git`) o `git bundle create`, y restaurar copiando de vuelta o con `git clone` del bundle; comprobar con `git -C <carpeta> log` y abriendo la web. Cada comando se prueba con un `WAYFINDER_HOME` temporal.
  - Tabla de las 14 herramientas MCP con su propósito y sus límites (las que exigen orden escrita: `wf_project register`, `wf_web`, `wf_set_status` a `todo` desde propuesta; `wf_review` antes de aprobar). Cada fila se contrasta con `src/mcp.ts` y con `plugin/skills/wayfinder/SKILL.md`.
  - Frases «esta versión» → número de versión (ver P1). También en `CHANGELOG.md:12`.
  - Corregir `claude plugin configure wayfinder` → `claude plugin configure wayfinder@wayfinder`.
  - `plugin/.claude-plugin/plugin.json:14`: «Folder that holds the Wayfinder data repository. Created on first use when you ask to register a project. Default: ~/.wayfinder». Reconstruir `plugin/dist/` solo si `check:dist` lo exige (no debería: `plugin.json` no entra en el bundle).
  - Conservar íntegros, en los dos idiomas, los límites de seguridad de #8 (sección «Seguridad y privacidad»: turnos automáticos, mensajes de otras sesiones, tareas programadas, barreras de la clave de mejor esfuerzo, permisos automáticos, texto pegado).
  - `CHANGELOG.md` («Sin publicar»): una línea en «Cambiado» con el README en inglés y en español, desinstalar y copia de seguridad.
- Excluido: subir a 1.0.0 (WAY-31), sitio de documentación, `docs/` nuevo, traducir planes, CHANGELOG o la skill, y cualquier promesa de publicación en npm (el README sigue diciendo que no está publicado en npm). Ningún cambio de código.
- Supuestos y restricciones: Windows 11 sigue siendo la única plataforma verificada. Docker no se puede verificar en ChinorrisPC (Docker Desktop parado; CREW prohíbe arrancarlo).

## Decisiones de la mesa redonda (proporcional: analista, negador, solución mínima y calidad; seguridad por los límites de #8)
| Decisión | Evidencia y motivo | Alternativas descartadas | Riesgo o consecuencia |
| --- | --- | --- | --- |
| D1. Dos archivos completos (`README.md` inglés, `README.es.md` español), no un README con referencia en `docs/`. | Decisión del usuario; el criterio es «solo con el README». | Mover la referencia a `docs/` (WAY-29 lo dejaba abierto): más archivos que mantener en dos idiomas. | Dos textos que pueden divergir. Mitigación: mismas secciones y mismos anclajes en el mismo orden; la revisión compara encabezados con un `grep '^#'`. |
| D2. Las frases sin número pasan a «1.0.0» para lo nuevo y «0.1.0» para las copias anteriores (P1). | `CHANGELOG.md`: todo se ha distribuido como 0.1.0; el primer número que distingue algo es 1.0.0 (WAY-31). | Fechas o commits: no los ve quien instala. | Hasta que WAY-31 suba el número, el README habla de una 1.0.0 que aún no existe. |
| D3. Desinstalar documenta lo observado en la sonda, incluido que se pierden las opciones. Corrige la frase de `README.md:177` («no está comprobado»). | Sonda de este plan. | — | Si Claude Code cambia ese comportamiento, el README quedará viejo; se indica la versión con la que se comprobó. |
| D4. Copia de seguridad con copia de carpeta y `git bundle`, sin remoto. | La carpeta es un repositorio git sin remoto (`README.md:8`) y Wayfinder nunca hace push; `check:dist` exige git sin subcomandos de red en el bundle, no en la documentación. | Recomendar un remoto privado: contradice la regla «sin remoto». | Ninguno nuevo; se pide cerrar sesiones para no copiar a mitad de una escritura (el bloqueo es `.wayfinder.lock`). |
| D5. Sin cambios de código; `plugin.json` solo cambia una descripción. | Solución mínima. | — | — |

## Preguntas que requieren decisión del usuario
- **P1. Número de versión para «desde/antes de esta versión».** No hay ninguna versión publicada: todo se distribuyó como `0.1.0`, incluidas copias sin `FORMAT`, sin historial o sin errores descartados. Opciones:
  - **A (recomendada):** «1.0.0» para todo lo que está en «Sin publicar» y «copias 0.1.0» para las anteriores, aceptando que el número 1.0.0 llega con WAY-31.
  - B: describir por función, sin número («las copias que aún no leen `FORMAT`»).
  - C: esperar a WAY-31 para este punto.

## Plan de implementación
1. `README.es.md` (nuevo): el README actual reordenado, con las secciones nuevas, la tabla de herramientas, las frases con número (P1), `wayfinder@wayfinder` en `configure` y la sección de seguridad sin recortes.
   - Validación: cada comando y ruta se busca en `src/`, `plugin/`, `package.json` o en la salida de la sonda; los límites de #8 se comparan línea a línea con `git show dab23aa -- README.md`.
2. `README.md`: traducción al inglés con los mismos encabezados en el mismo orden. Primera línea de cada uno: `English | [Español](README.es.md)` y `[English](README.md) | Español`.
   - Validación: `grep -c '^#'` igual en los dos; los enlaces internos (`#anclas`) resuelven en cada archivo.
3. `plugin/.claude-plugin/plugin.json:14`: descripción de `home` sin «wayfinder init».
   - Validación: `npm run check:dist` y `npm test` (`test/` comprueba la versión de `plugin.json`).
4. `CHANGELOG.md`: `:12` con número (P1) y una línea en «Cambiado».
5. Recorrido de aceptación siguiendo solo el README inglés, con `CLAUDE_CONFIG_DIR` y `WAYFINDER_HOME` en `%TEMP%`:
   1. Instalar desde GitHub (`main`) y desde la copia local (`--marketplace <ruta>`), con `--config home=<temporal>`.
   2. `claude plugin list --json` y `--version`.
   3. Primer uso sin sesión de Claude: `hook prompt` con «register this project» y `wf_project register` por un cliente MCP contra el bundle instalado (como WAYF-2), para que exista la carpeta de datos.
   4. Copia de seguridad, borrado y restauración de esa carpeta; `git log` igual antes y después.
   5. Actualizar (los dos comandos).
   6. Desinstalar; comprobar qué queda en la configuración temporal y que la carpeta de datos sigue.
   7. CLI sin plugin: `npm install -g github:davidgarciai554/wayfinder` con `--prefix` temporal (para no tocar el npm global del usuario), `wayfinder --version`, `wayfinder init` y desinstalar con el mismo `--prefix`.
   8. `~/.claude`, `~/.wayfinder` y el npm global del usuario sin cambios (mtime antes y después).
6. Validación amplia: `npm run typecheck`, `npm test` y `npm run check:dist`. El e2e no se ejecuta: no hay cambios de código ni de web.

## Criterios de aceptación
- [x] `README.md` (inglés) y `README.es.md` (español) se enlazan en la primera línea y tienen los mismos encabezados en el mismo orden.
  - Evidencia (WAY-30, 2026-11-26): Primera línea de `README.md`: «English | [Español](README.es.md)» y de `README.es.md`: «[English](README.md) | Español»; ambos tienen 31 encabezados con la misma secuencia de niveles y las mismas 13 secciones `##` en el mismo orden (Requirements/Requisitos … Docker).
- [ ] Instalar, actualizar, desinstalar, copia de seguridad y restauración funcionan siguiendo solo el README, en el recorrido del paso 5.
- [x] Las 14 herramientas MCP aparecen, con `wf_project`, `wf_web`, `wf_review` y `wf_set_status`.
  - Evidencia (WAY-30, 2026-11-26): `README.md` y `README.es.md` líneas ~279-298 («MCP tools» / «Herramientas MCP»): tabla con `wf_project`, `wf_web`, `wf_list`, `wf_get`, `wf_create`, `wf_review`, `wf_set_status`, `wf_update`, `wf_log`, `wf_history`, `wf_search`, `wf_error`, `wf_errors` y `wf_attach` (14); `src/mcp.ts` registra 14.
- [x] Ninguna «esta versión» / «this version» sin número (`grep`).
  - Evidencia (WAY-30, 2026-11-26): `grep -n -i -E 'esta versión|this version' README.md README.es.md CHANGELOG.md plugin/.claude-plugin/plugin.json` sin coincidencias.
- [x] `plugin.json` ya no menciona «wayfinder init».
  - Evidencia (WAY-30, 2026-11-26): `grep -n -i init plugin/.claude-plugin/plugin.json` sin coincidencias.
- [ ] Los límites de seguridad de #8 están completos en los dos idiomas.
- [ ] Ningún texto promete publicación en npm.
- [x] `npm run typecheck`, `npm test` (salvo la prueba conocida de `test/server.test.ts` si vuelve a fallar) y `npm run check:dist` en verde.
  - Evidencia (WAY-30, 2026-11-26): `npm run typecheck` y `npm run check:dist` correctos (quality.txt); `npm test` 230/230 (test.txt), incluida `test/server.test.ts`.

## Estrategia de validación
- Pruebas específicas: recorrido del paso 5 con registro de comandos y salidas.
- Validaciones amplias: paso 6 y CI del PR.
- Verificación funcional: el recorrido real con Claude Code 2.1.332.
- Seguridad: comparar la sección de seguridad con la de `dab23aa`; ningún secreto ni ruta personal en los ejemplos.
- **Sin verificar (se dirá en el README y en el informe):** Docker (motor parado); una sesión interactiva de Claude Code con el plugin recién instalado (el primer uso se simula por stdin y MCP, como en WAYF-2); macOS y Linux.

## Riesgos y reversión
- Riesgo: la traducción cambia el sentido de una regla. Mitigación: misma estructura y revisión cruzada de las secciones de seguridad y de aprobar por chat.
- Riesgo: un enlace externo apunta a `README.md#seccion-en-espanol` y se rompe. Comprobado: hoy ningún archivo del repositorio (`.md`, `.json`, `.ts`) enlaza a un ancla de `README.md`; solo hay anclas internas del propio README. Mitigación: repetir el `grep` antes del PR.
- Reversión: revertir el commit del PR; no hay cambios de datos ni de código.

## Desacuerdos residuales
- Negador: dos README completos duplican mantenimiento. Se mantiene D1 porque es decisión del usuario; la mitigación es la estructura idéntica.
