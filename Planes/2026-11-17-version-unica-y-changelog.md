# Plan: Una sola versión para el paquete y el plugin, CHANGELOG y actualización del plugin instalado (WAY-25)

> Estado: aprobado (por la persona, 2026-11-18, «Apruebo plan v1», trasladado por la sesión principal)
> Versión: v1
> Tarea: WAY-25
> Fecha: 2026-11-17. Base: `feat/wayfinder-mvp` en `62d9072`.
> Síntesis: mediador-sintetizador, tras la mesa redonda del 2026-11-17. Las correcciones de hechos hechas al persistir están en «Notas del responsable al persistir».
> Decisiones de la persona: P1 a P6 con las recomendaciones tal como están escritas (P1 a, P2 a, P3 a, P4 b, P5 a y b si el ensayo la observa, P6 a).
> La aprobación no cubre: la copia del plan al checkout principal (ERR-10), la ejecución del ensayo de P4, el commit, la integración ni el push.

## Contexto y objetivo
- **Problema u oportunidad.** El objetivo de la 1.0 es «datos estables y actualizaciones previsibles». Hoy el número de versión está escrito a mano en tres archivos sin ninguna comprobación, no hay CHANGELOG y el README no explica cómo se actualiza el plugin (la línea 209 dice «actualiza Wayfinder» sin más).
- **Resultado esperado.**
  - Una comprobación que falla si el paquete, el lockfile y el plugin declaran versiones distintas.
  - `CHANGELOG.md` con lo que incluye la 1.0 respecto de lo que había.
  - Una sección del README que lleve un plugin instalado a la versión nueva, conservando la carpeta de datos, con cada paso marcado como verificado o no verificado.
- **Evidencia del sistema actual (`62d9072`).**
  - `<repo>/package.json` línea 3, `<repo>/package-lock.json` líneas 3 y 9 y `<repo>/plugin/.claude-plugin/plugin.json` línea 3 valen `0.1.0` desde el primer commit de código. `.claude-plugin/marketplace.json` no declara `version`.
  - `scripts/build.mjs` líneas 9 y 27 leen `package.json` y lo incrustan en el bundle. Es el único consumo. `src/cli.ts` lo imprime con `--version` y `src/mcp.ts` lo usa como versión del servidor MCP.
  - `scripts/check-dist.mjs` compara el bundle y `ALLOWED_SUBCOMMANDS`, pero no lee `plugin.json` ni el lockfile. `check:dist` no forma parte de `npm test`.
  - `test/cli.test.ts` línea 66 ejecuta `src/cli.ts` sin el `define`: ve `0.0.0-dev` y pasa con cualquier número.
  - Con `version` fija en `plugin.json`, Claude Code mantiene la copia en caché hasta que cambie la cadena (documentación oficial, leída el 2026-11-17). Un marketplace de directorio se lee in situ.
  - En la máquina de la persona (Claude Code 2.1.322) el marketplace es de tipo directorio, los servidores MCP arrancan desde `plugin/dist/` del checkout y la copia en caché `0.1.0` es de un commit anterior y no se usa.
  - La documentación no resuelve si `claude plugin update` hace algo en un marketplace de directorio ni si `pluginConfigs` sobrevive a desinstalar y reinstalar. No se ha ejecutado ningún `install`, `update` ni `uninstall`.

## Participantes de la mesa redonda
- **Intervinieron:** moderador, analista del repositorio, idealista, negador, representante funcional, técnico de solución mínima, calidad y validación, seguridad y datos, y mediador-sintetizador. El responsable de la sesión aportó la evidencia de Claude Code y del historial git.
- **Seguridad y datos, activado:** la tarea toca la configuración de Claude Code de la persona, la carpeta de datos que debe conservarse y operaciones install/update.
- **Accesibilidad y experiencia, no activado:** no hay cambio de interfaz web ni de salida visible. Se reactivaría si se añadiera un texto visible en la web o en la sesión (por ejemplo, mostrar la versión).

## Alcance
- **Incluido:**
  - Comprobación de versiones en `check:dist`, con la lógica en una función pura probada en `npm test`.
  - `CHANGELOG.md` inicial.
  - Sección «Actualizar el plugin» del README y enlace desde la línea 209.
  - Ensayo aislado del procedimiento, solo si la persona lo autoriza (P4).
  - Si P1 elige subir el número, el cambio de número y la reconstrucción de `plugin/dist/`.
- **Excluido:**
  - Publicar en npm, etiquetas git, 1.0.0 y criterios de salida (WAY-31).
  - GitHub Actions (WAY-26).
  - Reestructurar el README, la versión en inglés y desinstalar (WAY-29).
  - Instalación limpia, actualización desde una versión publicada y sesión real (WAY-30).
  - Que el bundle no dependa de la carpeta de construcción (WAY-32).
  - Mostrar la versión en sitios nuevos, actualización automática, migración de datos y cambio de `FORMAT`.
  - Cualquier operación sobre la instalación real de la persona.
- **Supuestos y restricciones:**
  - La implementación se hace en un worktree de Claude Code. Su rama partía de `a088964` y ya está en `62d9072` (avance rápido hecho el 2026-11-17 con autorización; ver notas).
  - ERR-11: el bundle construido en un worktree puede diferir del del checkout principal.
  - ERR-10: `wf_update plan` busca el plan en `Planes/` del checkout principal.
  - Los mensajes del script y los identificadores van en inglés; el resto, en español.
  - Ningún texto nuevo lleva rutas personales, nombres de usuario ni IP.

## Archivos y componentes previsibles
| Ruta | Cambio | Condición |
| --- | --- | --- |
| `<repo>/scripts/versions.mjs` | Nuevo. Función pura `versionProblems`, sin efectos al importarse. | Siempre |
| `<repo>/test/versions.test.ts` | Nuevo. Casos de la función y una comprobación de los manifiestos reales. | Siempre |
| `<repo>/scripts/check-dist.mjs` | Lee los tres manifiestos y añade `problems.push(...versionProblems(...))`. | Siempre |
| `<repo>/CHANGELOG.md` | Nuevo. | Siempre |
| `<repo>/README.md` | Sección nueva tras la instalación y enlace desde la línea 209. | Siempre |
| `<repo>/scripts/versions.d.mts` | Declaración mínima de tipos. | Solo si `npm run typecheck` da TS7016, porque `tsconfig.json` no tiene `allowJs` |
| `<repo>/package.json`, `<repo>/package-lock.json`, `<repo>/plugin/.claude-plugin/plugin.json`, `<repo>/plugin/dist/` | Nuevo número y bundle reconstruido. | Solo si P1 sube el número |

No se tocan `scripts/build.mjs`, `src/`, `web/`, `test/cli.test.ts`, `.claude-plugin/marketplace.json` ni `Dockerfile`. Tampoco los «0.1.0» de `test/helpers.ts`, `test/format.test.ts` y `test/mcp.integration.test.ts`, que son etiquetas de «carpeta anterior a `FORMAT`».

## Decisiones de la mesa redonda
| Decisión | Evidencia y motivo | Alternativas descartadas | Riesgo o consecuencia |
| --- | --- | --- | --- |
| D1. `package.json` es la fuente única; el lockfile (`version` y `packages[""].version`) y `plugin.json` se comprueban, no se generan. | El build ya lee solo `package.json` (`build.mjs:9,27`). `claude plugin validate` y `plugin tag` comparan `plugin.json` con el marketplace, no con `package.json`. | Que el build escriba `plugin.json` (rompe la idempotencia de `buildAll(outRoot)` y agrava ERR-11). Un script de release o `npm version` encadenado. | `plugin.json` se edita a mano; si se olvida, la comprobación falla de forma visible. |
| D2. Función pura `versionProblems({ pkg, lock, plugin })` en `scripts/versions.mjs`, usada por `check-dist.mjs` y probada en `npm test`. | `check-dist.mjs` lanza un build al importarse, así que no se puede probar. Es la única forma repetible de demostrar «falla con versiones distintas». El técnico cambió su postura en el debate. | Solo `check-dist` con evidencia manual. Prueba que lance un build. Una prueba que sustituya a la comprobación. | El cableado de `check-dist.mjs` no tiene prueba automática; se cubre con una ejecución manual en rojo y verde. `check:dist` sigue sin vigilancia hasta WAY-26. |
| D3. No quitar `version` de `plugin.json`. | Sin versión, cada commit es una actualización, `--version` deja de coincidir con lo instalado y `plugin tag` (WAY-31) la necesita. Unanimidad de idealista, negador y técnico. | Versión = SHA del commit. | Cambia el contrato si se reabre; la persona puede pedirlo. |
| D4. Recomendación: no subir el número en WAY-25 (ver P1). | El ensayo puede probar un número distinto en una copia temporal. Subirlo reconstruye `plugin/dist/`, que esta máquina lee in situ. | Subir ya a una intermedia o a 1.0.0. | Mientras siga en `0.1.0`, quien instaló desde GitHub no recibe cambios aunque `main` avance. El README lo dice. |
| D5. CHANGELOG en español, Keep a Changelog, por tema con IDs WAY, con una sola sección `[Sin publicar]` y un bloque «Si vienes de una versión anterior». | `0.1.0` nunca se publicó: no hay etiquetas y la copia en caché llamada 0.1.0 es `01947bd`, no `70487e7`. | Sección `[0.1.0] - 2026-10-21`. Una entrada por commit. Generador de CHANGELOG. | Se redacta a mano y puede desfasarse; cada tarea posterior añade su línea. |
| D6. README: sección «Actualizar el plugin» tras la instalación, con los dos caminos, y cada paso marcado «verificado» o «según la documentación, no verificado». | La documentación oficial describe los comandos, pero Wayfinder no los ha ejecutado. Evita afirmar un camino no probado. | Dejarla antes de «Formato de los datos». Documentar solo un camino. | Puede solaparse con WAY-29: es un bloque autocontenido con un único encabezado. |
| D7. No documentar `uninstall` y reinstalar como método de actualización; añadir una línea informativa de reiniciar las sesiones abiertas. | No se sabe si `pluginConfigs` sobrevive. No hay conflicto destructivo hoy con `FORMAT_VERSION = 1`. Seguridad retiró la advertencia como obligación. | Advertencia obligatoria de cerrar las demás sesiones. | El riesgo real de mezclar versiones aparece cuando suba la marca. |
| D8. Ensayo aislado, solo con autorización y solo el camino de directorio (ver P4). | `CLAUDE_CONFIG_DIR` aísla el registro de plugins y marketplaces en 2.1.322 (comprobado con `list`). | Operar sobre la instalación real. Probar el camino de caché con un repositorio git local (no está confirmado que Claude Code lo admita). | Si no se autoriza o no es viable, el criterio queda no verificado y pasa a WAY-30 (P6). |
| D9. Sin prueba de `serverInfo.version`, sin `version` en el marketplace, sin `files` en `package.json`. | No es requisito, no hay consumidor, y añadir `version` al marketplace duplicaría la fuente (Claude Code usa `plugin.json` sin avisar). | Prueba de integración de `initialize`. | Se reconsidera si sube el número (ver validación) o en WAY-30/WAY-31. |

## Preguntas que requieren decisión de la persona
Se puede aprobar «con las recomendaciones» o cambiar solo la que se indique.

- **P1. Número de versión al cerrar WAY-25.**
  - Impacto: con `version` fija, solo los cambios que lleguen con otro número llegan a quien instaló desde GitHub. Subir el número cambia `--version`, el nombre de la carpeta de caché y el bundle (reconstrucción desde el checkout principal, que esta máquina lee in situ).
  - Opciones: (a) `0.1.0` hasta WAY-31; (b) una intermedia ahora (por ejemplo `0.2.0`); (c) `1.0.0` ya.
  - Recomendación de la mesa: **(a)**, y el README declara que la copia de GitHub solo cambia cuando cambia el número. (b) solo si hay gente instalando desde GitHub. (c) invade WAY-31.
- **P2. Camino principal del README.**
  - Impacto: decide qué se lee primero y qué se llama «soportado».
  - Opciones: (a) GitHub con copia en caché primero y el directorio leído in situ como segundo apartado; (b) el directorio primero; (c) igual peso.
  - Recomendación: **(a)**. Es el camino del comando de instalación actual. Queda marcado «no verificado» hasta WAY-30.
- **P3. CHANGELOG: idioma, granularidad y títulos.**
  - Opciones: (a) español, por tema con IDs WAY, una sola sección `[Sin publicar]`; (b) igual pero con `[0.1.0] - 2026-10-21` para el MVP; (c) inglés.
  - Impacto: (b) fija una fecha para un número que nunca se publicó; el inglés llega con WAY-29.
  - Recomendación: **(a)**. Se escribe para quien instala y actualiza, no solo para la autora.
- **P4. Autorización del ensayo aislado.**
  - Impacto: sin ensayo, el procedimiento solo cita la documentación y el criterio de cierre queda sin cumplir (P6). Un `install` y un `update` con efectos, aunque aislados, necesitan autorización escrita.
  - Opciones: (a) sin ensayo; (b) ensayo mínimo del camino de directorio; (c) (b) más el camino de caché con un repositorio git local, si Claude Code lo admite.
  - Recomendación: **(b)**, con los controles descritos en el paso 6.
- **P5. Cómo se declara la conservación de las opciones (`pluginConfigs`: `language`, `webHost`, `home`).**
  - Opciones: (a) declararla «no verificada» y remitir a `claude plugin configure wayfinder`; (b) afirmarla solo si el ensayo la observa.
  - Impacto: si se pierde un `home` personalizado, el plugin apuntaría a `~/.wayfinder`.
  - Recomendación: **(a), y (b) si el ensayo la observa**. No se promete en ningún caso lo no observado.
- **P6. Criterio de cierre si no hay ensayo o no es viable.**
  - Impacto: el cierre pide que un plugin en versión anterior pase a la nueva «siguiendo solo el README».
  - Opciones: (a) cerrar WAY-25 declarando ese criterio no verificado y trasladado a WAY-30, con su procedimiento; (b) mantener WAY-25 abierta.
  - Recomendación: **(a)**. La tarea nunca se anota como «cumplida» sin esa mención.

## Plan de implementación
Cada paso deja el repositorio compilando y con las pruebas en verde. Los pasos 1 a 5 no necesitan decisiones abiertas; el 6 depende de P4 y el 7 de P1.

0. **Preparación (hecha).** La rama del worktree está en `62d9072` por avance rápido (`git merge --ff-only 62d9072`).
   - Validación: `git rev-parse HEAD` devuelve `62d9072…`; `git status --porcelain` solo muestra este plan. Si el worktree no tiene dependencias propias, se informa (ERR-11) antes de seguir.
1. `<repo>/scripts/versions.mjs` (nuevo): exporta `versionProblems`. Esbozo acordado en el debate, no ejecutado:
   ```js
   export function versionProblems({ pkg, lock, plugin }) {
     const expected = pkg?.version;
     if (typeof expected !== 'string' || expected === '') return ['package.json: version is missing'];
     const found = [
       ['package-lock.json', 'version', lock?.version],
       ['package-lock.json', 'packages[""].version', lock?.packages?.['']?.version],
       ['plugin/.claude-plugin/plugin.json', 'version', plugin?.version],
     ];
     return found.flatMap(([file, field, value]) =>
       value === undefined ? [`${file}: ${field} is missing`]
       : value !== expected ? [`${file}: ${field} is "${value}" but package.json version is "${expected}"`] : []);
   }
   ```
   - Cada mensaje nombra archivo, campo y ambos valores, y se listan todas las discrepancias. Un campo ausente se informa sin lanzar.
   - Validación: paso 2.
2. `<repo>/test/versions.test.ts` (nuevo, `node --test`, sin build). Casos:
   - coincidencia (`[]`);
   - `plugin.json` distinto;
   - `lock.version` distinto;
   - `packages[""].version` distinto;
   - varias discrepancias a la vez;
   - campo ausente;
   - mensajes con archivo y ambos valores;
   - un caso que lea los tres manifiestos reales y afirme `[]`, sin literal de versión.
   - Validación: `node --test test/versions.test.ts` y `npm run typecheck`. Si da TS7016 por importar un `.mjs`, añadir `scripts/versions.d.mts`.
3. `<repo>/scripts/check-dist.mjs`: importar la función, leer los tres JSON con `readFile` y añadir `problems.push(...versionProblems({ pkg, lock, plugin }))` antes del bloque final. Sin tocar `buildAll`.
   - Validación manual en rojo y verde sobre una copia temporal del repositorio en `<scratchpad>`: con otro número solo en `plugin.json`, `npm run check:dist` sale con 1 y el mensaje nombra el archivo; sin cambios, sale con 0. En el worktree, `check:dist` solo es concluyente para las líneas de versión (ERR-11).
4. `<repo>/CHANGELOG.md` (nuevo). Esqueleto y entradas, redactadas solo con lo comprobado en el historial y los planes:
   ```markdown
   # Registro de cambios
   Formato basado en Keep a Changelog. Aún no hay versión publicada.
   ## [Sin publicar]
   ### Si vienes de una versión anterior
   - Las versiones publicadas antes de WAY-24 (0.1.0 incluida) no leen la marca `FORMAT`; ver «Formato de los datos y actualizaciones» del README.
   - Las tareas anteriores al historial no se migran. Los errores sin tipo salen como «Sin clasificar».
   - Un plugin anterior muestra los errores descartados como «ilegibles» y conserva `blocked` sin mostrarlo.
   - Cómo actualizar: sección «Actualizar el plugin» del README.
   ### Añadido
   - Tareas en Markdown sobre un repositorio git sin remoto: CLI, servidor MCP, hooks, web local, plugin, imagen Docker (WAY-1), es/en (MVP, 2026-10-21).
   - Bitácora e historial por tarea: `wf_log`, `wf_history`, `wf_search` (2026-10-22; sin ID WAY).
   - Registro de errores con detector de secretos e instalación desde GitHub (2026-10-23; sin ID WAY).
   - Web desde otros dispositivos y alta guiada del proyecto (WAY-6).
   - Tipos de error, errores descartados y reabrir tareas desde la web (WAY-8, WAY-9, WAY-12).
   - Aprobar varios IDs, dependencias entre tareas y varias tareas por mensaje (WAY-18, WAY-15, WAY-19).
   - Filtros de `wf_errors` (WAY-10) y de `wf_list` (WAY-16); etiquetas (WAY-14); mover un error entre tareas (WAY-11).
   - Aviso tras un fallo de compilación o pruebas (WAY-17).
   - Bloqueo de una tarea con su motivo (WAY-13).
   - Marca `FORMAT` y modo de solo lectura ante datos más nuevos (WAY-24).
   ### Cambiado
   - Los listados usan dos procesos git en lugar de dos por tarea (WAY-23).
   - Versión única del paquete y el plugin, comprobada por `check:dist` (WAY-25).
   ### Corregido
   - La aprobación por chat acepta el ID en minúsculas y «apruebo» (sin ID WAY).
   - El aviso de dependencias abiertas sale con un único prefijo (WAY-15).
   ```
   - Validación: cada ID WAY de la lista aparece en `git log --oneline`; las notas coinciden con README líneas 69, 76, 84, 120 y 215; sin rutas locales ni IP. Una entrada que no pueda respaldarse se quita, no se inventa.
5. `<repo>/README.md`: nueva sección `## Actualizar el plugin` tras «Primer uso» (antes del siguiente `##`), y en la línea 209 («reinicia la sesión de Claude o actualiza Wayfinder») un enlace a ella. Esquema, en este orden:
   1. Qué versión tengo: `claude plugin list --json` y `--version` del bundle. **Verificado** en 2.1.322 (2026-11-17): campos `version`, `installPath`, `readFromFolder`.
   2. **Camino GitHub (copia en caché por versión):** `claude plugin marketplace update wayfinder`, luego `claude plugin update wayfinder@wayfinder`. *Según la documentación, no verificado.* Solo cambia si cambió `version` en `plugin.json`; «already at the latest version» no garantiza tener lo último de `main`.
   3. **Camino copia local (directorio leído in situ):** actualizar el repositorio (`git pull` o cambiar de rama) y abrir sesión nueva. **Observado** en 2.1.322: las sesiones cargan lo que haya en `plugin/` del checkout en ese momento, sea cual sea la rama. La caché queda sin uso. No exige subir la versión según la documentación.
   4. Reiniciar la sesión o `/reload-plugins` para cambiar el servidor MCP; una sesión viva sigue con el anterior. El texto de `claude plugin update --help` («restart required to apply») está **verificado**; `/reload-plugins`, *según la documentación, no verificado*.
   5. Qué se conserva: `~/.wayfinder` (o la carpeta `home`) queda fuera del plugin y de la caché y no se toca. Opciones (P5): declaradas según la decisión; remite a `claude plugin configure wayfinder`.
   6. Una línea: reinicia las sesiones abiertas tras actualizar, y si aparece el aviso de solo lectura, ver «Formato de los datos y actualizaciones».
   7. Enlace al CHANGELOG. CLI sin plugin y Docker: remisión a las secciones existentes, sin comandos nuevos.
   - Validación: cada comando citado responde a `claude plugin … --help` (solo lectura); barrido de rutas, usuario e IP en las líneas añadidas; la sección no contradice «Formato de los datos y actualizaciones».
6. **Ensayo aislado (solo con P4 b o c autorizado).** Controles, tomados de seguridad y calidad:
   - Carpeta nueva para `CLAUDE_CONFIG_DIR`, otra para `WAYFINDER_HOME` y una copia temporal del repositorio como marketplace, las tres en `<scratchpad>`. Nunca `~/.wayfinder` ni `~/.claude`.
   - Antes y después, `claude plugin list --json` de la instalación real no cambia.
   - Sin `login`, sin copiar credenciales y sin sesión interactiva con esa configuración mientras no se compruebe que no la pide.
   - Se borra solo lo creado en `<scratchpad>`; ningún `uninstall` sobre nada real.
   - Secuencia: `marketplace add` con la copia a 0.1.0; `install wayfinder@wayfinder --config language=es`; cambiar solo `plugin.json` de la copia a un número de prueba (por ejemplo `0.1.1`; no hace falta reconstruir para ver la versión que Claude Code detecta); `marketplace update wayfinder`; `plugin update wayfinder@wayfinder`; `list --json`.
   - Se observan `version`, `installPath`, `readFromFolder` y `folderVersion`, la respuesta de `update`, y una carpeta de datos de prueba intacta (`git rev-list --count HEAD`, `git rev-parse HEAD`, `git status --porcelain`, contenido de `FORMAT`). `pluginConfigs` solo si el `install` aislado funciona.
   - Precondiciones **no comprobadas**: que `install` y `update` funcionen en esa configuración sin iniciar sesión; que Claude Code admita el marketplace de directorio en una carpeta nueva; que `update` haga algo en un marketplace de directorio. Si alguna falla, se declara bloqueado/no verificado.
   - El resultado se refleja en las marcas del paso 5 y en la bitácora de la tarea. Lo observado manda sobre la documentación.
7. **Solo si P1 sube el número.** `npm version <x> --no-git-tag-version`, editar a mano la línea 3 de `plugin.json`, y desde el checkout principal `npm run build` seguido de `npm run check:dist` (ERR-11). `[Sin publicar]` pasa a llevar el número y la fecha. Así se cambia el número desde ahora, sin script nuevo.
   - Validación: `node plugin/dist/wayfinder.mjs --version` imprime el nuevo número; `claude plugin validate <repo>/plugin --strict` y `claude plugin validate <repo> --strict` siguen pasando.
8. **Cierre.** Comparar el resultado con los criterios de aceptación; informar de lo verificado, lo bloqueado y lo trasladado a WAY-30.

## Criterios de aceptación
- [x] Con un número distinto en `plugin.json`, `npm run check:dist` sale con 1 y nombra archivo, campo y valores; igual con cada campo del lockfile por separado.
  - Evidencia (WAY-30, 2026-11-26): `test/versions.test.ts` «versionProblems: each file and field that differs is reported with both values» (plugin y los dos campos del lockfile por separado) con ✔; `scripts/check-dist.mjs` añade esos problemas y fija `process.exitCode = 1` (lectura del código; no se ejecutó con un número alterado).
- [ ] Con los cuatro valores iguales, `check:dist` pasa; un bundle desfasado sigue fallando.
- [x] `node --test test/versions.test.ts` cubre los casos del paso 2, incluida la lectura de los manifiestos reales, y `npm test` y `npm run typecheck` pasan.
  - Evidencia (WAY-30, 2026-11-26): `test/versions.test.ts` (5 pruebas con ✔, incluida «the package, the lockfile and the plugin of this repository declare the same version», que lee los manifiestos reales); `npm test` 230/230 y `npm run typecheck` correcto.
- [ ] `CHANGELOG.md` existe con el formato de P3; cada ID WAY aparece en el historial; no queda ninguna entrada sin respaldo; incluye que las versiones anteriores no leen `FORMAT`.
- [x] El README tiene la sección «Actualizar el plugin» con los dos caminos, el reinicio, la conservación de `~/.wayfinder`, la declaración de P5 y cada paso marcado como verificado o no verificado; la línea 209 la enlaza.
  - Evidencia (WAY-30, 2026-11-26): `README.es.md` líneas 57-84 («Actualizar el plugin»: copia local y GitHub, reinicio, conservación de `~/.wayfinder` y de las opciones, cada paso con *Comprobado* o *sin comprobar*) y enlace a ella desde la línea 323; equivalente en `README.md` («Updating the plugin»).
- [x] Con P4 autorizado y viable, el ensayo aislado muestra la versión nueva en `list --json`, deja intactas la carpeta de datos de prueba y la instalación real, y el README refleja lo observado.
  - Evidencia (WAY-30, 2026-11-26): `scripts/acceptance.mjs` pasos 2 y 6 (accept2.txt): actualización 0.1.0 → 1.0.0 en un perfil aislado con `CLAUDE_CONFIG_DIR` temporal, opciones y datos conservados, y `~/.wayfinder` e `installed_plugins.json` del usuario sin cambios. El README (líneas 57-84) recoge lo comprobado.
- [ ] Sin ensayo o con ensayo no viable, el criterio «un plugin instalado pasa a la nueva siguiendo solo el README» queda declarado no verificado y trasladado a WAY-30 (P6).
- [x] Sin cambio de número, `git diff` sobre `plugin/dist/` es vacío. Con cambio, el bundle se reconstruye y `check:dist` pasa desde el checkout principal.
  - Evidencia (WAY-30, 2026-11-26): El número cambió (0.1.0 → 1.0.0) y el bundle se reconstruyó: `npm run check:dist` correcto («dist/ and plugin/dist/ match a fresh build», quality.txt).
- [ ] Las líneas añadidas no contienen rutas personales, nombres de usuario ni IP.

## Estrategia de validación
- **Pruebas específicas (worktree):** `node --test test/versions.test.ts`; `npm run typecheck`; ejecución manual en rojo y verde de `npm run check:dist` en una copia temporal en `<scratchpad>`.
- **Validaciones amplias:**
  - Worktree: `npm test`. Su `pretest` reconstruye y puede dejar `plugin/dist/` modificado por ERR-11; ese diff no se incluye en ningún commit.
  - Checkout principal, solo tras la integración autorizada: `npm run check:dist`, que es la confirmación concluyente del bundle. No se ejecuta `npm test` allí.
  - No se prevé `npm run test:e2e` ni `npm run test:docker` (no cambian `src/` ni `web/`).
  - Si P1 sube el número: `claude plugin validate` del plugin y del marketplace.
- **Verificación funcional:** el ensayo del paso 6 (con autorización); `claude plugin list --json` y `--help` de solo lectura.
- **Seguridad y datos:** control de la instalación real antes y después; carpetas de datos de prueba, nunca la real; barrido de datos personales en lo nuevo. Sin superficie de seguridad en la comprobación de versiones.
- **Estado previsto al cierre:** `update` sobre la instalación real y la supervivencia de `pluginConfigs` quedan bloqueados/no verificados salvo observación en el ensayo. El camino de caché con GitHub real, la instalación limpia y la sesión real son de WAY-30. La comprobación de `check:dist` en el worktree no es concluyente para el bundle.

## Riesgos y reversión
- **Riesgo:** el README afirma un camino no probado. **Mitigación:** marcas por paso y el ensayo del paso 6. **Reversión:** corregir el texto.
- **Riesgo:** sin cambio de número, quien instaló desde GitHub no recibe novedades y `update` no se lo dice. **Mitigación:** el README lo declara (P1).
- **Riesgo:** `check:dist` no vigila nada hasta que alguien lo ejecute (WAY-26). **Mitigación:** la prueba de `npm test` cubre la lógica y la lectura de los manifiestos reales; el cableado se cubre con la ejecución manual.
- **Riesgo:** el ensayo toca la configuración de la persona. **Mitigación:** autorización escrita y los controles del paso 6. **Recuperación:** borrar las carpetas creadas en `<scratchpad>`; si cambiara la lista real, se informa y la persona decide.
- **Riesgo:** el CHANGELOG se desfasa o lleva una entrada sin respaldo. **Mitigación:** validación del paso 4 y una línea por tarea futura.
- **Riesgo:** al subir el número, las sesiones siguientes de esta máquina cargan el bundle nuevo. **Mitigación:** avisar antes de reconstruir y hacerlo al integrar.
- **Reversión general:** revertir el commit con autorización. No hay migración ni datos persistentes afectados.

## Desacuerdos residuales
- **Subir el número en WAY-25.** El representante funcional lo pedía porque la copia de GitHub no recibe nada con `0.1.0`; el negador y el técnico, no, porque roza WAY-31 y reconstruye el bundle. El representante concedió que el ensayo en copia temporal basta para probar el procedimiento. Recomendación: P1 (a); decide la persona.
- **Cuánta actualización se verifica.** El idealista pedía un `update` real observado; seguridad, negador y técnico, nada sin autorización; calidad, también el camino de caché con un repositorio git local. Recomendación: ensayo mínimo del camino de directorio. El camino de GitHub, la fuente de la mayoría de instalaciones, queda sin verificar y pasa a WAY-30.
- **Dónde va la sección del README.** El técnico, justo tras la instalación; el representante, antes de «Formato de los datos». Recomendación: tras la instalación, enlazada desde la línea 209. Riesgo de solaparse con WAY-29.
- **Prueba de `serverInfo.version`.** Calidad la quería; el moderador la descartó para WAY-25. Recomendación: no añadirla ahora; si sube el número, basta `--version` del bundle y se reconsidera en WAY-30.
- **Advertencia de cerrar sesiones.** Seguridad la retiró como obligación tras comprobar que no hay conflicto destructivo con `FORMAT_VERSION = 1`; queda una línea informativa.

## Operaciones que necesitan autorización aparte
- Commit en el worktree.
- Integración en `feat/wayfinder-mvp`.
- Copia de este plan a `Planes/` del checkout principal para poder usar `wf_update plan` (ERR-10).
- El ensayo aislado del paso 6 y cada uno de sus comandos `claude plugin …`.
- Si P1 sube el número, la reconstrucción de `plugin/dist/` en el checkout principal.
- Cualquier operación sobre la instalación real (`install`, `update`, `uninstall`, `marketplace add|update`): este plan no la propone.
- El push no lo hace la sesión de implementación; la publicación en npm y las etiquetas git son de WAY-31.

## Notas del responsable al persistir
Correcciones de hechos sobre el texto del mediador; no cambian ninguna decisión de la mesa.

- **Avance de la rama (paso 0).** El mediador lo listaba como pendiente de autorización. Se hizo el 2026-11-17, con el árbol limpio y sin commit ni push, con las palabras de la persona trasladadas por la sesión principal: «Sí, que avance».
- **WAY-1 en el CHANGELOG.** El mediador la marcó «sin evidencia». Comprobado con `wf_get`: WAY-1 es «Imagen Docker de la web y del MCP (incremento 6)», hecha; ya está cubierta por la entrada del MVP, donde se ha anotado el ID.
- **Riesgo de `typecheck`.** Leído `tsconfig.json`: `strict`, sin `allowJs`, y ningún `.ts` importa hoy un `.mjs` del repositorio. El TS7016 del paso 2 es probable; no se ha ejecutado.
- **`--version` para quien solo usa el plugin.** El ejecutable `wayfinder` solo está en el PATH con la instalación por npm. El README ya usa la forma `node "<carpeta del plugin>\dist\wayfinder.mjs" …` (línea 182); la sección nueva debe usar esa.
- **Qué instala hoy el camino de GitHub.** `origin/main` está en `a088964`, 8 commits por detrás de `feat/wayfinder-mvp`. Este plan no decide cuándo llegan los cambios a `main`.
- **Sin verificar por el mediador:** que `npm version --no-git-tag-version` actualice los dos campos del lockfile (solo importa si P1 sube el número) y que en el ensayo baste cambiar `plugin.json` sin reconstruir.
