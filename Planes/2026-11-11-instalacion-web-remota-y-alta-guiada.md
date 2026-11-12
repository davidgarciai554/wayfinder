# Plan: Instalación con un comando, web desde otros dispositivos y alta guiada de proyectos (Claude Code)

> Estado: aprobado v4 (por la persona, 2026-11-12: «Apruebo el plan v4»). La v3 se aprobó el 2026-11-11 («apruebo el plan Planes/2026-11-11-instalacion-web-remota-y-alta-guiada.md v3») y sigue vigente en todo lo que la v4 no cambia.
> Versión: v4
> Referencia: tarea WAY-6. Este plan referencia y modifica el plan aprobado `Planes/2026-10-21-wayfinder-mvp.md` v3, que no se edita.
> Criterios de esa v3 que cambian:
> - línea 131: registro solo a petición; en repos no registrados, los hooks no emiten nada y el MCP no crea carpetas;
> - líneas 479 y 671: web en 127.0.0.1 por defecto; `--host` no loopback solo explícito y con aviso; GET sin credencial;
> - línea 657: criterio de aceptación equivalente a la línea 131.
> El resto de la v3 sigue vigente. Mientras este borrador no se apruebe, la v3 no cambia.
> Todas las preguntas que bloqueaban el plan están respondidas (2026-11-11). Queda pendiente la aprobación explícita de este archivo y versión.

## Cambios respecto a v3 (borrador, 2026-11-12)

**Origen.** La web se probó en un móvil real y carga. Tras la prueba, la persona pidió (literal): «tú deberías de poder dar la URL para que el usuario acceda desde el móvil haciendo un click sin tener que entrar un txt». Se le presentaron tres opciones: emparejar con un código, enlace con clave en el chat o dejarlo como está. Eligió **«Enlace con clave en el chat»**, conociendo el riesgo que se describía en la opción.

**Decisión 16, que sustituye a «La clave no pasa por el modelo».**
- `wf_web start` y `wf_web status` devuelven también el enlace con clave para otros dispositivos, cuando la web está abierta en la red.
- La skill le dice a Claude que se lo dé a la persona una vez, como enlace pulsable, y que nunca lo use con herramientas.
- Si la web solo está abierta en este PC, no se devuelve ningún enlace con clave.

**Riesgo que acepta la persona (reabre SEC-1).**
- El modelo conoce la clave, así que un agente manipulado podría usarla para escribir o aprobar desde la web, saltándose el control de órdenes del chat.
- La clave queda en el historial de la conversación. Caduca al cerrar la sesión de Claude.

**Barreras de SEC-1 que se mantienen.** La cabecera `Sec-Fetch` en `/api/share` y la denegación del hook `pre-tool` siguen como están. Ya no impiden que el modelo conozca la clave, y el README lo dirá. Quitarlas sería revertir una decisión de la persona, así que queda como pregunta abierta.

**Comportamiento confirmado, sin cambios.** Al entrar en un proyecto, la URL pierde `?k=`, pero el mismo navegador sigue entrando gracias a la cookie de sesión `HttpOnly`. Comprobado el 2026-11-12 desde la IP de la LAN:
- otro navegador sin clave → 401;
- el mismo navegador con la cookie → 200;
- una clave falsa → 401;
- la cookie de la sesión anterior tras rotar la clave → 401 `expired`.
El README lo explicará.

**Límite en este PC.** El filtro de secretos de la persona (el plugin `secret-redactor`) tapa información en lo que ve Claude, así que aquí el enlace aparecería tapado. No se toca ese filtro: es configuración de la persona.
- Comprobado el 2026-11-12: la clave `<gen>.<secreto>` no se tapa, porque es hexadecimal y no llega a su umbral de entropía. Lo que se tapa es la IP de la LAN (opción `redactIps`).
- En una sesión real con `webHost`, Claude no pudo dar el enlace y remitió a la página del PC.
- Para que funcione en este PC, la persona puede añadir su IP de la LAN a la opción `allowlist` del filtro.

**Archivos previstos.**
- `src/mcp.ts`: `wf_web` devuelve `remoteUrl` en start y status.
- `src/i18n/es.json` y `src/i18n/en.json`: texto del resultado con el enlace e instrucción de no usarlo con herramientas.
- `plugin/skills/wayfinder/SKILL.md`: dar el enlace una vez como enlace pulsable.
- `README.md`: seguridad y cookie de sesión.
- `test/mcp.integration.test.ts`: con un `webHost` válido el resultado lleva el enlace con clave; sin `webHost`, no.
- `plugin/dist/*`: compilado.

**Criterios de aceptación.**
- Con `webHost` válido, «abre Wayfinder» hace que Claude muestre un enlace pulsable que abre el tablero en el móvil sin pasar por un archivo.
- Sin `webHost`, Claude no muestra ninguna clave.
- El enlace deja de valer al cerrar la sesión.
- Pasan typecheck, `npm test`, e2e, `check:dist` y la validación del plugin.

**Reversión.** Volver a devolver solo la URL local y restaurar el texto de la skill.

**Implementación y verificación (2026-11-12).**
- Validaciones: typecheck, `npm test` 137/137, e2e 41/41, `check:dist` y validación del plugin y del marketplace, todo correcto.
- Sesión real con `webHost`: Claude dio «[Abrir Wayfinder en el móvil](http://<IP>:4747/?k=…)».
- La persona pulsó el enlace en su móvil y se abrió («Sí, se abre»).
- Para que funcione en este PC, por orden de la persona se añadió su IP de la LAN a la `allowlist` de `secret-redactor`.

**Pregunta abierta.** ¿Se mantienen o se retiran las barreras de SEC-1, que ya no protegen la clave frente al modelo? La recomendación es mantenerlas hasta que la persona decida.

## Cambios respecto a v2

La persona pidió (2026-11-11, literal): «Podemos hacer que la web rote con un hash en la URL que cambie cada sesión y la anterior la invalide para añadir ahí cierta seguridad y que si entra en una web con un hash antiguo avise que ya no está ahí y que busque uno nuevo y Claude podría iniciar la web automáticamente si el usuario le dice que sí».

Se hizo una ronda breve con el técnico, seguridad y el negador, y la persona respondió a tres preguntas nuevas:
- **Q6 → frase siempre.** Para abrir la web, tanto en el PC como en la red, la persona escribe una frase que detecta el hook.
- **Q7 → solo enlace para copiar.** No se genera QR.
- **Q8 → web solo con Claude.** No hay modo permanente; `serve` queda solo para Docker y desarrollo.

Consecuencias en el plan:
- **La web se abre dentro de la sesión.** La herramienta nueva `wf_web` arranca la web dentro del proceso MCP de la sesión. Muere con la sesión, sin procesos aparte.
- **La clave rota en cada arranque.** Tiene el formato `<gen>.<secreto>` y la anterior deja de valer. Un enlace con otra generación muestra «este enlace ya no es válido».
- **Sin clave estable.** Desaparecen `.state/web-token` y `--rotate-token`.
- **La clave no pasa por el modelo.** La web escucha siempre en 127.0.0.1, sin clave, y ahí muestra el enlace con clave para otros dispositivos. El modelo solo recibe la URL local.
- **La red sale de la configuración.** La interfaz de red viene de una opción nueva de userConfig, `webHost`, nunca de un parámetro del agente.
- **Decisiones afectadas:** sustituye las decisiones 6, 8 y 10 de la v2, elimina la Q4 y añade las decisiones 13 a 15.
- **Incrementos afectados:** reorganiza los incrementos 4 y 5.

Cambios que ya estaban en la v2 respecto a la v1:
- Q1 → leer y escribir en la LAN por HTTP, con aviso (riesgo aceptado por la persona).
- Q2 → registrar con una frase concreta.
- Q3 → recordar el «no» con `wf_project decline`.

## Desviaciones durante la implementación

- **Incremento 4: frase única para abrir la web** (decisión de la persona, 2026-11-11).
  - Por qué: en una sesión real, en un repositorio que también es una web, «abre la web» hizo que Claude abriera el `index.html` del proyecto en lugar del tablero.
  - La persona decidió: «Siempre que se abra wayfinder será en la red así unificamos la frase».
  - Una sola orden, «abre Wayfinder» / «open Wayfinder», que abre en este PC y en `webHost`. Sustituye a «abre la web» y «abre la web en la red» de las decisiones 10 y 11.
  - Si `webHost` está vacío, abre solo en este PC y el resultado explica cómo configurarlo. Lo propuso el responsable al aplicar la decisión, y la persona puede objetarlo.
- **Incremento 4: enlace con escritura para este PC.** `/api/share` (solo loopback) devuelve también el enlace con clave para escribir desde este PC, además del enlace para otros dispositivos. Sin él, la persona no podría aprobar desde su propio PC, porque el modelo solo recibe la URL sin clave. Queda dentro de la decisión 12: loopback ya podía leer la clave.

- **Incremento 5: la cookie de la clave pasa de `SameSite=Strict` a `Lax`.**
  - Motivo: la revisión visual encontró que, al abrir el enlace para otros dispositivos desde otra web (un chat, el correo o la propia página del PC), el navegador no enviaba la cookie en la redirección a `/` y aparecía «Esta web necesita la clave».
  - Con `Lax`, la cookie viaja en las navegaciones normales. Las escrituras siguen protegidas por la comprobación de Origin, el cuerpo solo JSON y la clave.
  - Lo cubre la prueba `e2e/access.spec.ts`, y está registrado en ERRORES.md y como error de WAY-6.
- **Incremento 5: si la conexión en vivo se cierra,** la app consulta la API. Si recibe 401 recarga y muestra la página de acceso, y si no, reconecta. Ante un 401, `EventSource` se cierra para siempre, y sin esto el aviso de «enlace caducado» tardaba hasta el refresco de 30 s.

- **Incremento 6: ajustes tras la auditoría independiente** (`/auditar-seguridad-datos`, 2026-11-11: P0 0, P1 0, P2 1, P3 1).
  - `webHost` solo se acepta como IP literal de una interfaz concreta, como dice la decisión 6: ni nombres ni `0.0.0.0` / `::`. Si no es válida, la web se abre solo en este PC con un aviso.
  - `wf_web` cierra el servidor si la sesión terminó mientras arrancaba (observación 1; no se pudo forzar la carrera en una prueba).
  - El README describe las órdenes como protección de mejor esfuerzo frente a un agente manipulado con acceso a comandos (SEC-2).
  - La descripción de `webHost` en `plugin.json` cita la frase vigente (observación 6).
  - SEC-1: un cliente de loopback, incluido el agente con Bash, podía pedir la clave a `/api/share` mientras la web estaba abierta. La persona decidió «Añade un control» (2026-11-11), y se añadieron dos barreras de mejor esfuerzo:
    - `/api/share` solo responde a peticiones con `Sec-Fetch-Site: same-origin`, `Sec-Fetch-Mode: cors` y `Sec-Fetch-Dest: empty`. El navegador las pone en el `fetch` de la página y una página no puede cambiarlas; si no están, responde 403 sin la clave.
    - El hook `pre-tool` deniega los comandos Bash o PowerShell que mencionan `/api/share` o cabeceras `sec-fetch-`.
    - Límite residual: un agente decidido puede ofuscar el comando, o manejar un navegador real hacia la página local. Queda documentado en el README.

## Contexto y objetivo

### Problema u oportunidad
- Instalar Wayfinder exige hoy dos comandos de plugin más un `init` manual (README.md:18-23).
- El tablero solo es accesible en 127.0.0.1 y hay que arrancarlo a mano.
- Un repositorio nuevo no se registra salvo que la persona lo pida con precisión.

### Resultado esperado (decisiones de la persona, 2026-11-11)
- **D1:** la web se puede abrir desde otros dispositivos (móvil, otros equipos).
- **D2:** en un repositorio no registrado, Claude PREGUNTA si crear el proyecto. Nunca lo registra automáticamente.
- **D3:** solo Claude Code. Codex, Copilot, Gemini y Cursor quedan para WAY-7, sin cerrar puertas.
- **Instalación:** un solo comando, y el primer uso sin `init` manual.
- **Web por sesión:** Claude abre la web cuando la persona lo ordena. La clave del enlace cambia en cada sesión, y un enlace antiguo avisa de que ya no vale.

### Evidencia del sistema actual

**Instalación y carpeta de datos**
- El comando único existe en Claude Code 2.1.318 (verificado en local): `claude plugin install wayfinder --marketplace davidgarciai554/wayfinder --config language=es`.
- `mcp` y `serve` fallan con `serve.notInitialized` si no existe la carpeta de datos (src/cli.ts:103-104).
- Solo `wayfinder init` la crea (src/store/init.ts:50-70).
- `initHome` rechaza una carpeta no vacía que no sea un home (init.ts:54).

**Registro y órdenes de la persona**
- `wf_project register` (src/mcp.ts:145-180) no verifica que la persona lo haya pedido.
- En un repo no registrado, el hook sale sin salida (src/hook.ts:200-201; test/hook.test.ts:49-59).
- Ya existe un control de órdenes explícitas de la persona:
  - `extractOrders` y `recordOrders`, con TTL de 15 min (src/store/mentions.ts:22-70);
  - `approveByChat` consume la orden (src/store/approve.ts:59-61, 93).

**Web**
- Arranque:
  - `startServer` está exportado y devuelve `close()` (src/server.ts:96, 440-446). No escribe en stdout y acepta `port: 0` (:410, :426, :432).
  - `runMcp` solo conecta stdio (src/mcp.ts:496-503) y ya aplica `hookEnv` (:498).
- Escucha y clave:
  - Escucha en 127.0.0.1 por defecto.
  - El token es efímero, uno por proceso (:99).
  - La cookie lleva el token y su nombre incluye el puerto (:127, :262).
  - Un `?k=` incorrecto redirige en silencio a `/` (:260-263).
- Acceso:
  - Ninguna GET exige clave (:144-282).
  - Las escrituras exigen Host, Origin, JSON y cookie (:295-300).
  - Con una IP concreta, el host propio entra en allowedHosts (:103-109).
  - Solo HTTP.
  - `portAnswers` solo sondea 127.0.0.1, y Windows comparte puertos (ERRORES.md:53-61).

**Configuración**
- Los `default` de userConfig llegan al MCP por `.mcp.json`, pero no a los hooks si no hay un valor guardado (ERRORES.md:23-31).
- El aviso de host no loopback dice «solo en un contenedor» (cli.ts:117, es.json:153).

**Diseño y plataforma**
- Móvil: DESIGN.md:10 solo exige que no se rompa.
- Hay un diseño compacto por debajo de 720 px con objetivos de 44 px (DESIGN.md:143-147). Entre 720 y 1099 px no llegan a 44 px (web/styles.css:135-144).
- Solo está verificado Windows 11 (README.md:12).

## Alcance

### Incluido
- Instalación con un comando, documentada y validada en un `CLAUDE_CONFIG_DIR` aislado.
- Creación perezosa de la carpeta de datos al registrar o al decir «no».
- Pregunta de alta en SessionStart con texto fijo. El registro exige una orden de la persona. Se recuerda el «no».
- Web de sesión con `wf_web`:
  - arranque por orden de la persona, dentro del proceso MCP;
  - en 127.0.0.1 sin clave, y en `webHost` con clave;
  - clave por arranque y aviso de enlace caducado.
- Autenticación de todas las rutas fuera de loopback; lectura y escritura remotas con clave (Q1).
- Pantalla de acceso, mensajes de enlace caducado o clave incorrecta, panel «Abrir en otro dispositivo» con botón de copiar, ajuste táctil en tablet y DESIGN.md para móvil.
- Documentación y verificación real.

### Excluido
- Otros agentes (WAY-7), Linux y macOS, acceso desde Internet, túneles, cuentas, npm.
- Registro automático.
- Modo permanente de la web con Claude cerrado (Q8). `serve` queda para Docker y desarrollo.
- QR (Q7), HTTPS autofirmado y emparejamiento de un solo uso.
- Carpetas que no son repositorio git (ni pregunta ni salida).
- Reglas del cortafuegos de Windows (solo se documentan).
- Commits, push, publicación y cambios en el `~/.claude` real: requieren autorización aparte.

### Supuestos y restricciones
- Una sola persona en Windows 11 con móvil (inferencia, no confirmada).
- `dist/` y `plugin/dist/` deben coincidir con un build limpio (`npm run check:dist`).
- No se añaden dependencias.
- La instalación desde GitHub solo se prueba de extremo a extremo con la rama publicada, y publicar requiere autorización. Hasta entonces se usa `--marketplace <ruta local>`.
- No está verificado que Claude Code termine el proceso MCP al cerrar la sesión en Windows. Se mitiga y se verifica en el incremento 4.

## Decisiones de la mesa redonda

| Decisión | Evidencia y motivo | Alternativas descartadas | Riesgo o consecuencia |
| --- | --- | --- | --- |
| 1. **Un comando.** Se usan `--marketplace` y `--config` nativos y se documentan en el README. | Verificado en Claude Code 2.1.318; es una capacidad existente. | Instalador propio: código sin necesidad. | Depende de la versión de Claude Code; se documenta la probada. |
| 2. **Carpeta de datos.** Se crea con `initHome` (idempotente y sin sobrescribir) solo cuando la persona da la orden de registrar o abrir la web, o cuando dice que no. `mcp` arranca sin carpeta; las demás herramientas devuelven `serve.notInitialized`. SessionStart no escribe nada. | `mcp` fallaba sin carpeta (cli.ts:103-104), y D2 necesita el MCP para preguntar. `initHome` protege las carpetas ajenas (init.ts:54). Cambia la línea 131 de la v3. | Init perezoso en cada arranque; que la cree SessionStart; mantener `init` manual. | `register`, `decline` y `wf_web` ganan el efecto de crear la carpeta. Lo acotan la orden y que no sobrescribe. Si falta git, `git.missingForInit` dice qué hacer. |
| 3. **Confirmación del registro (Q2).** `wf_project register` exige una orden de registro reciente (TTL 15 min, de un solo uso, ligada a la raíz del repo). La registra el hook `prompt` a partir del último mensaje de la persona, con frases cerradas («registra este proyecto», «register this project»). Un «sí» suelto no vale. | Reutiliza el patrón de `extractOrders` (src/store/mentions.ts:22-70) con una función hermana, porque la actual va ligada a `idPrefix` y a verbos de aprobación. El hook sale antes de esa rama en repos no registrados (hook.ts:200-201), así que hay que adelantarla. Es un control que corre fuera del agente. | «Sí» del chat; código en systemMessage; solo el permiso nativo. | La persona escribe una frase concreta, y Claude se la indica. Al detectar la orden, el hook crea la carpeta si falta y guarda la orden. Un mensaje normal no dispara nada (se prueba). |
| 4. **Pregunta D2.** En SessionStart, solo en un repo git con raíz identificable, no registrado y no rechazado. El `additionalContext` es fijo, sin el nombre de la carpeta ni el remoto, e incluye la frase de registro. Sustituye el aviso de `init`. | Evita la inyección: no se incluyen datos que controla el repositorio. El nombre sugerido lo calcula `register` después (resolve.ts:106-113). Cambia las líneas 131 y 657 de la v3 y SKILL.md:22. | Incluir el nombre o el remoto (abre una vía de inyección); preguntar fuera de git. | No se puede verificar de forma determinista que Claude pregunte bien; se valida en sesión real, varias veces. |
| 5. **Memoria del «no» (Q3).** `wf_project decline` guarda la raíz normalizada en `<home>/.state/declined.json` (fuera de git) y crea la carpeta si falta. SessionStart no pregunta en un repo rechazado. `register` con orden lo quita de la lista. | Evita preguntar una y otra vez; reutiliza `readState`/`writeState`. | Preguntar una vez por sesión. | Un agente manipulado podría silenciar la pregunta: el impacto es bajo, porque la persona siempre puede registrar con la frase. Un «no» crea la carpeta vacía si no existía. |
| 6. **Interfaz de red.** Nueva opción de userConfig `webHost` (IP de LAN o de Tailscale; vacía = solo este PC), que llega al MCP por `.mcp.json`. El agente no puede pasar un host. | El agente no debe elegir dónde se expone la web (seguridad). El MCP recibe los `default` de userConfig (ERRORES.md:23-31 solo afecta a los hooks). Una IP literal en Host no sufre DNS rebinding. | Un parámetro `host` en la herramienta; `0.0.0.0`; comodines. | La IP puede cambiar por DHCP; se documenta. Cambia `plugin.json` y `.mcp.json`. |
| 7. **Autenticación fuera de loopback.** En un listener que no es loopback, todas las rutas (`/api/*`, SSE, assets) exigen la clave en cookie o en `?k=`, comparada con `timingSafeEqual`. En loopback se mantiene la lectura sin clave. | Las lecturas exponen tareas, historial, errores, capturas y bitácora (server.ts:144-282). El Host se puede falsificar, así que el criterio es el listener y no la cabecera. Mantener loopback evita regresiones (playwright.config.ts:17; test/server.test.ts:102-175). | Exigir la clave siempre. | Docker (0.0.0.0) también exige clave; se adaptan el README y `test:docker`. |
| 8. **Clave por arranque y aviso de caducado.** La clave es `<gen>.<secreto>`: `gen` es un identificador público de 6 caracteres por arranque y el secreto son 24 bytes aleatorios. No se guarda nada. Con `?k=` o cookie de otra `gen` → «Este enlace ya no es válido: pide a Claude que abra la web y copia el enlace nuevo». Con la `gen` actual y un secreto distinto → «Clave incorrecta». Un `?k=` válido pone la cookie y redirige sin `?k=`; uno no válido devuelve 401 con la pantalla de acceso, en lugar de la redirección silenciosa. | Cumple la petición: rota en cada sesión, invalida la anterior y avisa. Cada arranque genera una clave nueva (server.ts:99). La cookie lleva el puerto en el nombre (:127). No hay estado entre procesos (técnico y seguridad). | Clave estable en `.state` con `--rotate-token` (v2): sustituida a petición de la persona. Lista persistente de hashes: más estado. | Sin una sesión con la web abierta no hay servidor, y el navegador muestra «no se puede conectar», no el aviso: es un límite documentado. El móvil necesita el enlace nuevo en cada sesión (aceptado por la persona). |
| 9. **Transporte y escrituras (Q1).** Fuera de loopback, con clave, la web permite leer y escribir (crear, aprobar, descartar) por HTTP. Las escrituras siguen exigiendo cookie, Host permitido, Origin exacto y JSON. | Riesgo aceptado expresamente por la persona. | Solo lectura salvo `--writable`; solo VPN. | **Riesgo aceptado:** en una red no confiable, quien capture la clave o la cookie podría aprobar propuestas. Mitigación: orden para abrir, rotación por sesión, aviso y recomendación de usar la red de casa o una VPN. |
| 10. **Web de sesión (Q8).** La herramienta MCP `wf_web` (`start`, `status`, `stop`) llama a `startServer` dentro del proceso MCP. No se lanzan procesos aparte. Si se cierra stdin, la web se cierra y el proceso termina. Prueba el puerto 4747 y, si está ocupado, `port: 0`, y devuelve el puerto real. No hay modo permanente; `serve` queda para Docker y desarrollo, y su aviso actual sigue siendo válido. | stdio y HTTP conviven: server.ts no toca stdout. La rotación y el cierre salen de la vida del proceso. Con `port: 0` se evita la trampa de `portAnswers` (ERRORES.md:53-61). | Lanzar la web desde un hook o como proceso desacoplado: dejaría huérfanos. `serve` permanente con el Programador de tareas: la persona no lo quiere. | No está verificado que Claude Code termine el MCP en Windows: el cierre por stdin se prueba con el SDK y en sesión real. Dos sesiones usan puertos y claves distintos, y el enlace de una aparece como caducado en la otra. Con Claude cerrado no hay web. |
| 11. **Orden para abrir la web (Q6).** `wf_web start` exige una orden reciente de la persona, detectada por el hook con frases cerradas: «abre la web» (solo este PC) y «abre la web en la red» (este PC y `webHost`). Mismas exclusiones, TTL y uso único que el registro. Sin `webHost` configurado, la orden «en la red» devuelve un error que dice cómo configurarlo. | La persona eligió frase siempre. Reutiliza el mecanismo de órdenes. Un agente manipulado no puede abrir la web por su cuenta. | «Sí» en el chat; «sí» solo para el PC. | Más fricción: Claude indica la frase exacta al ofrecer la web. |
| 12. **La clave no pasa por el modelo.** `wf_web start` devuelve solo `http://127.0.0.1:<puerto>/` y el estado. La página local (loopback, sin clave) muestra el panel «Abrir en otro dispositivo» con el enlace completo y un botón de copiar (Q7). | La URL con clave no llega al proveedor ni al transcript (seguridad y negador). Quien accede a loopback ya puede leer la carpeta de datos. | Devolver la URL con clave en el chat. Un QR (descartado por la persona). | El enlace se pasa al móvil copiándolo, como prefiera la persona. Requiere que el servidor escuche en dos interfaces con una clave compartida (incremento 4). |
| 13. **Accesibilidad y diseño.** El 401 de navegación sirve una pantalla de acceso estática sin JS: h1, mensaje (caducado o incorrecta) con `role=alert` y la acción a seguir. La interfaz distingue 401, 403 y «sin conexión». Objetivos de 44 px también entre 720 y 1099 px. El panel de copiar tiene botón con texto y confirmación con `aria-live`. DESIGN.md pasa a cubrir móvil y tablet (Q5). | DESIGN.md:10 solo exige que no se rompa; D1 cambia esa premisa. | Dejar DESIGN.md sin tocar. | Cambio visual en tablet; se revisa con Playwright. |
| 14. **Plan aparte.** Plan nuevo que no toca la v3, en incrementos del 1 al 6. | Un plan aprobado no se reescribe. | Editar la v3. | Cada incremento se valida por separado. |

## Preguntas que requieren decisión del usuario

Todas están respondidas por la persona (2026-11-11). Se conservan como registro:
- **Q1** transporte → (b) leer y escribir en la LAN por HTTP, con aviso.
- **Q2** confirmación del registro → (a) frase concreta.
- **Q3** recordar el «no» → (b) sí, con `wf_project decline`.
- **Q4** quién arranca la web tras reiniciar → sustituida: la abre Claude en cada sesión (Q8).
- **Q5** DESIGN.md para móvil y tablet → sí (recomendación aceptada salvo objeción).
- **Q6** confirmación para abrir la web → frase siempre.
- **Q7** cómo llega el enlace al móvil → solo enlace para copiar.
- **Q8** modo permanente → no; la web solo existe con una sesión de Claude abierta.

No quedan preguntas abiertas. Se puede objetar cualquier decisión antes de aprobar.

## Plan de implementación

### Incremento 1: instalación con un comando
1. `README.md`: el comando único; `init` pasa a ser opcional; la versión de Claude Code probada y la limitación a Windows.
   - Validación:
     - instalación aislada con `$env:CLAUDE_CONFIG_DIR=<carpeta temporal>` y `claude plugin install wayfinder --marketplace <ruta local del repo> --config language=es`;
     - salida con código 0, el plugin aparece en la lista y el `~/.claude` real no cambia;
     - con `davidgarciai554/wayfinder`, **solo al publicar** (requiere autorización).
2. Validación: `npm run check:dist`.

### Incremento 2: registro con orden verificada, «no» recordado y carpeta de datos perezosa
1. `src/store/mentions.ts`: `extractRegisterOrder(prompt)` con frases cerradas en español e inglés, las mismas exclusiones que `extractOrders` y fallo cerrado; un almacén por raíz de repo, reutilizando `ORDER_TTL_MS`, el consumo de un solo uso y el lock.
   - Validación en `test/chat.test.ts`:
     - positivos;
     - «no registres», preguntas, código y citas;
     - otra raíz;
     - TTL caducado y orden de un solo uso;
     - una orden de aprobación no cuenta como orden de registro, ni al revés.
2. `src/hook.ts`, rama `prompt`: en un repo git no registrado, solo si hay orden, crear la carpeta con `initHome` si falta (sin sobrescribir) y guardar la orden. Un mensaje sin orden no escribe nada.
   - Validación en `test/hook.test.ts`:
     - dividir el caso de las líneas 49-59 en «nada sin orden» (sin `.state`) y «con orden: carpeta creada y orden guardada»;
     - Stop y PreTool siguen sin emitir nada.
3. `src/cli.ts` (:103-104) y `src/mcp.ts`:
   - `mcp` arranca sin carpeta de datos.
   - Todas las herramientas salvo `wf_project register` y `decline` devuelven `serve.notInitialized`.
   - `register` exige la orden reciente de esa raíz, crea la carpeta si hace falta, registra con la sugerencia y quita la raíz de `declined`.
   - `decline` guarda la raíz en `.state/declined.json` (idempotente, sin commit) y crea la carpeta si falta.
   - `serve` sigue fallando con un mensaje claro.
   - Validación en `test/cli.test.ts` (la línea 37 se reescribe a propósito para `mcp`).
   - Validación en `test/mcp.integration.test.ts`, con el cliente SDK real:
     - `register` sin orden da error y no escribe nada; con orden crea PROJECT.md y un commit en el repo de datos, y ninguno en el repo consumidor;
     - `decline` no hace commit y no duplica la raíz;
     - fuera de git, error claro.
4. `src/i18n/es.json` y `en.json`: mensajes con resultado, causa y acción, y paridad de claves en `test/i18n.test.ts`.
5. Validación del incremento: `npm run typecheck`, `npm test`, `npm run check:dist`.

### Incremento 3: pregunta de alta en SessionStart y skill
1. `src/hook.ts`, rama `session-start`, antes de `projectFor`: en un repo git con raíz identificable, no registrado y no rechazado, emitir el `additionalContext` fijo con la pregunta y la frase de registro. Sustituye el aviso de `init` (:192-198). Fuera de git, sin salida.
   - Validación en `test/hook.test.ts`:
     - con un nombre de carpeta y un `origin` hostiles, el contexto es idéntico a la constante;
     - una carpeta no git, un repo rechazado y un subdirectorio de un repo rechazado no producen salida;
     - un repo registrado se comporta igual que hoy.
2. `plugin/skills/wayfinder/SKILL.md` (:22), con estas reglas:
   - En un repo no registrado: preguntar una vez, indicar la frase exacta y, si la persona dice que no, llamar a `wf_project decline` y no insistir. Registrar solo con su frase.
   - Para la web: ofrecerla indicando las frases «abre la web» o «abre la web en la red»; no abrirla sin esa orden; dar a la persona solo la URL local.
   - El resto queda como hoy.
   - Validación: `npm test` y revisión del texto.
3. **Solo verificable en una sesión real de Claude Code:**
   - (a) `CLAUDE_PROJECT_DIR` llega al MCP;
   - (b) Claude formula la pregunta de forma fiable (al menos 3 repeticiones);
   - (c) tras un «no», Claude llama a `decline` y una sesión nueva en ese repo no pregunta;
   - (d) «registra este proyecto» en otro repo crea PROJECT.md y un commit en el repo de datos.
4. Validación del incremento: `npm run typecheck`, `npm test`, `npm run check:dist`.

### Incremento 4: web de sesión, clave por arranque y autenticación
1. `src/server.ts`:
   - Clave `<gen>.<secreto>` por arranque.
   - Escuchar en 127.0.0.1 y, si se pasa, en un segundo host (`webHost`), con la misma clave. Dos listeners con una sola clave, o la clave pasada como opción.
   - En el listener que no es loopback, todas las rutas exigen la clave (`timingSafeEqual`). Sin clave: 401 con pantalla de acceso en la navegación y JSON sin datos en la API.
   - Una `gen` distinta muestra «enlace no válido, pide uno nuevo»; con la misma `gen`, «clave incorrecta».
   - Un `?k=` válido pone la cookie y redirige sin `?k=`.
   - Las escrituras remotas, con la clave y los controles de Host, Origin y JSON (Q1).
   - Endpoint local (solo loopback) con el enlace para otros dispositivos.
   - La clave nunca aparece en logs ni en errores.
   - Validación en `test/server.test.ts`, con una IP no loopback de `os.networkInterfaces()` (se omite con aviso si no hay):
     - GET sin clave = 401 sin datos; con cookie = 200;
     - una `gen` antigua da el mensaje de caducado y la misma `gen` con otro secreto, el de incorrecta;
     - Host ajeno = 403;
     - POST sin cookie u Origin, rechazado; POST válido, aceptado y con commit;
     - el endpoint del enlace no responde por el listener remoto;
     - loopback no cambia.
2. `src/store/mentions.ts` y `src/hook.ts` (rama `prompt`): las órdenes «abre la web» y «abre la web en la red» (y en inglés), con las mismas exclusiones, TTL y uso único. Se reutiliza el almacén del incremento 2.
   - Validación en `test/chat.test.ts`: positivos y negativos; no se confunden con órdenes de registro ni de aprobación.
3. `src/mcp.ts`: la herramienta `wf_web` (`start`, `status`, `stop`).
   - `start` exige la orden; con «en la red» exige además `webHost`.
   - Crea la carpeta si falta y llama a `startServer` en el mismo proceso, probando 4747 y luego `port: 0`.
   - Devuelve solo la URL local, el puerto y si hay acceso en red.
   - Si se cierra stdin, se cierra la web y termina el proceso.
   - `plugin/.mcp.json` y `plugin/.claude-plugin/plugin.json`: la opción `webHost` (texto, vacía por defecto = solo este PC).
   - Validación en `test/mcp.integration.test.ts`:
     - `start` sin orden da error y no escucha nada;
     - con orden, GET local = 200 y el resultado no contiene `k=`;
     - con «en la red» sin `webHost`, error;
     - `stop` y el cierre del cliente sin `stop` liberan el puerto y el proceso termina;
     - dos instancias a la vez usan puertos distintos.
4. `Dockerfile` y `README.md`: `serve` dentro del contenedor (0.0.0.0) exige clave también para leer; el README explica de dónde sacarla. Se sigue publicando solo en `127.0.0.1:4747`.
   - Validación: `npm run test:docker` (con la sonda adaptada). Si no hay Docker, **bloqueado/no verificado**.
5. **Solo verificable en una sesión real:** al cerrar la sesión de Claude Code en Windows, el puerto queda libre y no queda ningún proceso `node` de Wayfinder.
6. Validación del incremento: `npm run typecheck`, `npm test`, `npm run test:e2e`, `npm run check:dist`.

### Incremento 5: interfaz de acceso, enlace para otros dispositivos y tablet
1. `web/app.js` (:173, :880-900) y `web/styles.css`:
   - La pantalla de acceso, con los mensajes de enlace caducado o clave incorrecta y su acción.
   - Mensajes distintos para 401, 403 y «sin conexión»; este último, en la LAN, añade que la sesión de Claude puede estar cerrada.
   - Panel «Abrir en otro dispositivo» solo en loopback: enlace completo seleccionable, botón «Copiar enlace» con confirmación por `aria-live` y aviso de que el tráfico no va cifrado.
   - SSE se reconecta al volver a primer plano.
   - Objetivos de 44 px entre 720 y 1099 px.
   - Solo tokens de DESIGN.md.
   - Validación con `npm run test:e2e`:
     - 320, 390 y 768 px y zoom al 200 %;
     - aria snapshot de la pantalla de acceso y del panel;
     - copiar con teclado;
     - 401 y 403 distintos de «sin conexión»;
     - objetivos ≥ 44 px.
2. `docs/design/DESIGN.md`: premisa de móvil y tablet, pantalla de acceso y panel de copiar (Q5).
   - Validación: revisión visual según `.claude/rules/frontend-visual-review.md`.
3. Validación del incremento: `npm run typecheck`, `npm test`, `npm run test:e2e`, `npm run check:dist`.

### Incremento 6: revisión de seguridad, documentación y verificación real
1. Revisión independiente con `/auditar-seguridad-datos` de `src/server.ts`, la clave, `wf_web`, las órdenes, el registro y el hook. Los hallazgos vuelven como cambios que hay que aprobar.
2. `README.md`:
   - flujo de la web por sesión, con las frases, la opción `webHost` y cómo copiar el enlace al móvil;
   - cortafuegos de Windows (solo perfil Privado; Wayfinder no toca reglas);
   - VPN/Tailscale;
   - límites: HTTP en claro, web solo con Claude abierto, IP por DHCP, solo Windows.
   - Anotar en `ERRORES.md` cualquier error nuevo.
   - Validación: instalación aislada desde cero; `npm run typecheck`, `npm test`, `npm run test:e2e`, `npm run check:dist`, `npm run test:docker`.
3. **Solo verificable con un móvil real o en la LAN:**
   - (a) acceso con `webHost` y el cortafuegos;
   - (b) copiar el enlace y abrirlo en el móvil;
   - (c) un enlace de una sesión anterior muestra el aviso de caducado;
   - (d) los mensajes son legibles en pantalla pequeña.
   - Si no hay móvil disponible, se declara **bloqueado/no verificado** y se deja la guía para reproducirlo.

## Criterios de aceptación

**Instalación**
- [ ] Un único comando instala el plugin en un `CLAUDE_CONFIG_DIR` aislado (código 0, plugin en la lista), sin `init` manual y sin tocar el `~/.claude` real.

**Alta de proyectos**
- [ ] En un repo git no registrado, la sesión muestra una pregunta fija (idéntica aunque el nombre o el remoto sean hostiles). No escribe nada: ni PROJECT.md, ni commit, ni `.state`, ni carpeta de datos.
- [ ] Con la frase de registro de la persona, se crea la carpeta si falta y el proyecto se registra con la sugerencia. `register` sin orden falla sin efectos. La orden caduca a los 15 minutos y solo se puede usar una vez.
- [ ] Tras un «no», `decline` guarda la raíz y las sesiones siguientes no preguntan, sin PROJECT.md ni commit. Un `register` posterior con orden funciona y quita la raíz de la lista.
- [ ] En un repo registrado, el comportamiento es el actual. En una carpeta no git, no hay salida. `mcp` arranca sin carpeta de datos.

**Web**
- [ ] `wf_web start` solo abre la web con la orden «abre la web» (este PC) o «abre la web en la red» (también `webHost`). Sin orden, no escucha nada.
- [ ] El resultado de la herramienta no contiene la clave. El enlace con clave solo aparece en el panel local de copiar.
- [ ] Cada arranque genera una clave nueva. Con un enlace de otra generación se ve «este enlace ya no es válido, pide uno nuevo»; con la generación actual y otro secreto, «clave incorrecta».
- [ ] Al hacer `stop` o cerrar la sesión, el puerto queda libre y no quedan procesos (probado con el SDK y en sesión real en Windows).
- [ ] Con la clave, todas las rutas responden desde otro dispositivo. Sin ella, 401 sin datos. Un Host ajeno da 403.
- [ ] Las escrituras remotas exigen cookie, Host, Origin y JSON, y generan su commit.
- [ ] En loopback la lectura sigue funcionando sin clave.
- [ ] Hay una pantalla de acceso accesible y el panel de copiar se usa con teclado. 401 y 403 se distinguen de «sin conexión». No hay scroll horizontal a 320 px y los objetivos miden 44 px también entre 720 y 1099 px.

**Cierre**
- [ ] El README documenta la instalación, la web por sesión, `webHost`, los riesgos y los límites. DESIGN.md cubre móvil y tablet.
- [ ] La revisión de seguridad independiente no deja hallazgos abiertos sin decisión.
- [ ] Los puntos de sesión real y de móvil quedan verificados o declarados **bloqueado/no verificado**, con su forma de reproducirlos.

## Estrategia de validación

- **Pruebas específicas:**
  - `test/chat.test.ts`: órdenes de registro y de web, sin interferir con las de aprobación;
  - `test/hook.test.ts`, `test/server.test.ts`, `test/cli.test.ts`, `test/mcp.integration.test.ts` (con el cliente SDK real) y `test/i18n.test.ts`.
- **Validaciones amplias:**
  - `npm run typecheck`, `npm test` (el pretest hace el build), `npm run test:e2e`, `npm run check:dist`;
  - `npm run test:docker`, o declarado bloqueado;
  - la instalación aislada con `CLAUDE_CONFIG_DIR`.
- **Verificación funcional en una sesión real de Claude Code:**
  - la pregunta de alta, el «no», «registra este proyecto», «abre la web» y «abre la web en la red»;
  - que `CLAUDE_PROJECT_DIR` llegue al MCP;
  - que al cerrar la sesión no queden procesos;
  - el móvil en la LAN.
- **Seguridad y accesibilidad:**
  - `/auditar-seguridad-datos`;
  - Playwright a 320, 390 y 768 px y con zoom al 200 %;
  - teclado y foco en la pantalla de acceso y en el panel de copiar;
  - CLI sin ANSI;
  - no se declara cobertura de lectores de pantalla ni de dispositivos reales hasta probarlos.

## Riesgos y reversión

- **HTTP en claro en la LAN** (riesgo aceptado por la persona, Q1): quien capture la clave o la cookie puede leer y aprobar mientras dure esa sesión.
  - Mitigación: orden para abrir en la red, clave que cambia por sesión, aviso y recomendación de usar la red de casa o una VPN.
  - Reversión: `wf_web stop` o cerrar la sesión.
- **La web no se cierra con la sesión en Windows** y deja un proceso huérfano con el puerto ocupado.
  - Mitigación: cierre al cerrarse stdin, prueba con el SDK y verificación en sesión real; si falla, se registra en `ERRORES.md` y se revisa antes de seguir.
- **Una frase ambigua dispara una orden** de registro o de web.
  - Mitigación: frases cerradas, fallo cerrado, TTL, un solo uso y pruebas con texto hostil.
- **Un hook o una herramienta crean la carpeta de datos.**
  - Mitigación: solo con una orden de la persona o un «no», con `initHome` y sin sobrescribir.
  - Reversión: borrar la carpeta creada, que no contenía datos.
- **Claude no formula la pregunta o no indica la frase.**
  - Mitigación: texto fijo y la skill, verificados en sesión real. Escribir la frase a mano sigue funcionando.
- **Regresión en Docker, e2e o check:dist.**
  - Mitigación: ejecutarlos en cada incremento; la sonda sin clave en loopback no cambia.
- **Opción `webHost`:** llega al MCP, pero no a los hooks si no está guardada (ERRORES.md:23-31). Los hooks no la usan; se prueba el MCP con y sin valor guardado.
- **Reversión general:**
  - cada incremento es un cambio de código aislado en la rama, reversible antes de publicar;
  - revertir después de publicar, o hacer commits, requiere autorización aparte;
  - los proyectos registrados viven en el repo de datos, fuera de este plan.

## Desacuerdos residuales

- **Escribir por HTTP en la LAN.** Seguridad recomienda escribir solo por un canal cifrado o privado. La persona eligió leer y escribir en la LAN (Q1) y asume el riesgo.
- **Usabilidad móvil de la rotación por sesión.** El negador advierte que hará falta copiar un enlace nuevo en cada sesión y que con Claude cerrado no habrá web. La persona lo aceptó al pedir la rotación y elegir Q7 y Q8.
- **Recordar el «no» de forma persistente** frente a preguntar una vez por sesión (negador). La persona eligió recordarlo (Q3).
- **Distinguir «caducado» de «incorrecta».** El negador propuso un único mensaje sin estado. Se adopta la `gen` pública en la clave, que no guarda estado y cumple la petición literal de avisar de un enlace antiguo.
- **Fuera de alcance, declarado:**
  - un repo clonado con el mismo `origin` que uno registrado casa con él (src/store/resolve.ts:78-82);
  - QR, HTTPS y modo permanente, descartados por la persona o por coste.
