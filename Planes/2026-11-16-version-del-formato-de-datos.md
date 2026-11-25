# Plan: Versión del formato de datos y aviso cuando los datos son más nuevos que el plugin (WAY-24)

> Estado: aprobado el 2026-11-17. La persona escribió «Apruebo plan v2» en la sesión principal, que lo trasladó citado. La aprobación acepta las recomendaciones tal como están escritas: P1 B (solo lectura), P2 (a) (sin marca en las carpetas existentes), P3 formato 1 con aviso y sin bloqueo, P4 aviso completo cada vez, P5 sección «Otros estados», P6 sin variable para saltarse el bloqueo, P7 aceptado y documentado en el README, y P8 fuera de alcance. No cubre commit, integración en `feat/wayfinder-mvp`, push ni escritura en el checkout principal.
> Versión: v2
> Base de código: `feat/wayfinder-mvp` en `8c419d3`.
> Participantes de la mesa: analista del repositorio, idealista, negador, representante funcional, técnico de solución mínima, calidad y validación, seguridad y datos, y accesibilidad y experiencia. Moderó el responsable de la sesión y sintetizó el mediador-sintetizador.
> Historial: la v1 la sintetizó el responsable sin pasar por el mediador, en contra de `Proceso - Creación de planes.md`. Esta v2 la sustituye por completo con la síntesis del mediador, que el responsable ha persistido con dos correcciones de referencias (`sync.ts:40`; `app.js:1043-1055`).

## Contexto y objetivo
- **Problema u oportunidad.** El objetivo de la 1.0 pide «datos estables y actualizaciones previsibles», pero hoy los datos no llevan ninguna marca de versión del formato. Cuando un proceso con código antiguo lee datos escritos por código más nuevo, o los muestra como «ilegibles» o los reescribe y puede perder información.
  - El caso real es ERR-9: la web de una sesión arrancada el 12/11, con un bundle anterior a WAY-9, mostró como «ilegible» un error descartado que había escrito una sesión nueva. La causa está confirmada: el marketplace es de tipo directorio y cada sesión conserva en memoria el `plugin/dist/wayfinder.mjs` que había al arrancar.
  - El otro caso es Docker usando la misma carpeta que el host (README:239-243).
- **Resultado esperado (cierre de WAY-24):**
  - una carpeta creada con 0.1.0 se abre con la 1.0 sin perder ni reescribir nada;
  - una carpeta con un formato más nuevo produce un aviso accionable en SessionStart, MCP y web, en lugar de «ilegible»;
  - hay pruebas automáticas de los dos casos;
  - el README documenta el aviso y la regla de qué cambios se admiten en 1.x.
- **Evidencia del sistema actual (commit 8c419d3):**
  - **Inicialización.** `isInitialized` comprueba que existan `.git` y `projects/` (`src/store/init.ts:12-14,29-31`). Sobre una carpeta existente, `initHome` devuelve `created:false` sin escribir nada. Es una garantía documentada y probada: `init.ts:46-53` y `test/store.test.ts:30-41`, que compara `tree` y el número de commits.
  - **Carpeta nueva.** Recibe `.gitignore` y, solo con `--lang`, `config.json`, en el commit `wf: init` (`init.ts:62-73`). `config.json` solo lo lee `resolveLang`, y solo si existe `WAYFINDER_HOME` (`src/i18n/index.ts:19-32`).
  - **Escrituras.** Todas las escrituras de datos y de `.state/` pasan por `withLock` (`src/store/sync.ts:40`). Fuera de `withLock` solo escribe `initHome`, y solo en una carpeta nueva.
  - **Puntos de entrada.** No hay un punto de arranque común:
    - en MCP, `assertInitialized` se ejecuta en cada herramienta (`mcp.ts:90-92`);
    - en `serve`, una sola vez (`cli.ts:96`);
    - `startServer` no comprueba nada;
    - el hook usa `isInitialized`, lo envuelve todo en try/catch y devuelve 0 sin salida (`hook.ts:287-369`).
  - **Tareas con estado desconocido.** Dan `Unreadable{reason:'unknown status: X'}` (`src/store/tasks.ts:104`). `readTask` lanza, así que `setStatus`, `updateTask` y `logProgress` fallan para ese ID (`tasks.ts:131-157,376,429,513`).
  - **Errores con estado desconocido.** Ya se leen con tolerancia: se acepta cualquier estado que cumpla `STATUS_RE`, se conserva, y toda escritura lanza `store.errorUnknownStatus` (`error-records.ts:27,143-144,478-482`). Hay una prueba de que el fichero queda idéntico (`test/error-records.test.ts:303-318`).
  - **Riesgo de pérdida al reescribir.**
    - Las claves desconocidas de las tareas se conservan, pero `writeTaskUnlocked` sobrescribe `status` con `task.status` (`tasks.ts:215-230`). Si un estado desconocido se leyera sin un freno equivalente, una escritura lo perdería en silencio.
    - Fuera de `status`, los valores desconocidos de `priority` y `origin` se leen como `medium` y `user` (`tasks.ts:107-108`) y se perderían al reescribir.
  - **Hook y MCP.** El hook descarta las tareas ilegibles sin avisar (`hook.ts:336-346`). `wf_list` filtra con `z.enum(STATUSES)` (`mcp.ts:342`).
  - **Web.**
    - Solo vigila `projects/` (`server.ts:481-486`), así que un cambio que afecte solo al fichero de marca no dispara el evento `change`.
    - `/api/session` solo se pide al conectar (`web/app.js:1099,1185`); `/api/projects` se pide en cada refresco y navegación (`loadProjects`, `app.js:1043-1055`).
    - `fail()` responde 409 para las claves de `CONFLICT_KEYS` (`server.ts:85,378`).
  - **Versión.** La versión del plugin (0.1.0) solo llega a `runMcp` (`cli.ts:10-11`, `scripts/build.mjs:27`). No hay etiqueta git de 0.1.0 y `package.json` vale 0.1.0 en todo el historial, así que aquí «carpeta de 0.1.0» significa «carpeta escrita por el código actual».
  - **Bundle.** `plugin/dist/` está versionado y debe reconstruirse desde el checkout principal (ERR-11).

## Alcance
- **Incluido:**
  1. Una marca de versión del formato en un archivo propio, con una constante `FORMAT_VERSION = 1` en el código. Se escribe en las carpetas nuevas dentro del commit `wf: init`.
  2. Una función de lectura sin caché que clasifica la carpeta como `ok`, `newer` o `unreadable`. Se evalúa en cada operación MCP, en cada petición web a `/api/projects`, en cada SessionStart y al principio de cada escritura.
  3. Un aviso con la misma clave i18n (es/en) en SessionStart, MCP y web. El comportamiento al escribir con datos más nuevos depende de la decisión pendiente de la persona; la recomendación es solo lectura.
  4. Lectura tolerante de tareas con estado desconocido, equivalente a la de los errores: se muestran con su estado literal, no cuentan como ilegibles y toda escritura sobre ellas se rechaza sin tocar el fichero.
  5. Una regla escrita en el README sobre qué cambios de formato se admiten en 1.x y cuáles obligan a subir la marca, con una prueba pequeña que fija `FORMAT_VERSION` y las enumeraciones `PRIORITIES` y `ORIGINS`.
  6. Pruebas automáticas, actualización del README y de `docs/design/DESIGN.md`, y reconstrucción de `plugin/dist` desde el checkout principal.
- **Excluido**, según la tarea y la mesa:
  - migraciones automáticas;
  - base de datos o índice;
  - sincronización;
  - reparar o convertir datos;
  - proteger las versiones ya publicadas: 0.1.0 y las anteriores no leen la marca, y se documenta en el README;
  - detectar Docker con exactitud;
  - definir un formato 2 o reglas más allá de 1.x;
  - cambiar el comportamiento de las tareas realmente ilegibles (archivo roto), salvo lo indicado;
  - una variable de entorno para saltarse el bloqueo (ver P6).
- **Supuestos y restricciones:**
  - «Sin marca» equivale al formato 1.
  - La marca es un único entero decimal, no semver.
  - Las versiones ya publicadas ignoran la marca.
  - El estado no se guarda en caché por proceso, para no repetir el patrón de ERR-9.
  - El hook no puede lanzar, así que el aviso va como contexto normal.
  - Las pruebas usan literales congelados de una carpeta «0.1.0», no `initHome`.
  - Nada se prueba sobre `~/.wayfinder`.

## Decisiones de la mesa redonda
| Decisión | Evidencia y motivo | Alternativas descartadas | Riesgo o consecuencia |
| --- | --- | --- | --- |
| D1. La marca vive en un archivo propio en la raíz de la carpeta (nombre provisional `FORMAT`, contenido `1\n`), versionado en git y escrito por `initHome` en las carpetas nuevas dentro del commit `wf: init`. La constante `FORMAT_VERSION` está en `src/store/format.ts`, independiente de `__WAYFINDER_VERSION__`. | `config.json` no existe sin `--lang`, solo se lee con `WAYFINDER_HOME` y su JSON inválido se ignora en silencio (`i18n/index.ts:19-32`). La versión del plugin solo llega a `runMcp`; mezclarla con el formato obligaría a pasarla a hook, server y store. Técnico, negador y seguridad coinciden. | Marca en `config.json`. Marca en `.state/` (no versionado, no viaja con los datos). Usar la versión del plugin (semver). | Una carpeta copiada sin el archivo se interpreta como formato 1. Es lo deseado para las carpetas antiguas, pero hay que documentarlo. |
| D2. Una carpeta sin marca es formato 1: compatible y sin aviso. | Criterio de cierre (0.1.0 se abre con la 1.0 sin reescribir nada), `init.ts:46-53` y `store.test.ts:30-41`. | Marcarla al abrirla (rompe la garantía probada). | La marca no protege las carpetas que no la tienen. Es coherente: en 1.x la marca no sube. |
| D3. **Desvío del texto de WAY-24:** la marca no se escribe en las carpetas existentes (recomendación; ver P2). El texto de la tarea dice «añadida a carpetas existentes». | Escribirla choca con la garantía probada, crea un commit que nadie pidió, compite por el lock y cambia el árbol con solo mirar. El negador lo considera bloqueante; idealista, técnico, calidad y seguridad coinciden en que escribir durante una lectura no es aceptable. Una versión 2 futura escribirá su propia marca. | Escribirla desde `initHome`, el hook o MCP. Escribirla en la primera escritura legítima (carrera y commit ajeno). Un `wayfinder init` explícito con una función aparte `stampFormat(home)`: viable si la persona lo exige y no toca nada más. | Las carpetas antiguas no llevarán marca hasta que una versión futura la escriba. Si la persona exige marcarlas, el coste es una función y un commit en `cli.ts:136`. |
| D4. La marca se clasifica en cada operación, sin caché: ausente = `ok` (formato 1); entero decimal válido (`/^\d{1,6}$/`, mayor que 0) igual a la constante = `ok`; mayor = `newer`; cualquier otro contenido (vacío, `abc`, `0`, `-1`, `1.5`, enorme, JSON) = `unreadable`; un archivo que existe pero no se puede leer (permiso, directorio) = `unreadable`. | ERR-9 demuestra que comprobar solo al arrancar no sirve, porque la marca cambia mientras el proceso vive. Seguridad aporta la tabla de la marca y el negador pide una única `checkFormat(home)`. Una marca basura no debe ni bloquear ni declararse «más nueva». | Caché por proceso. Dos mecanismos de parada distintos. Tratar la marca ilegible como «más nueva» (técnico; ver D5). | Una lectura de un archivo pequeño por operación. Coste bajo, aceptado para cubrir el caso real. |
| D5. Una marca ilegible genera un aviso propio («marca ilegible, se asume formato 1») y no bloquea: lectura y escritura funcionan como con `ok`, con una clave i18n distinta de la de `newer`. | Seguridad y negador: fallar cerrado deja a la persona sin poder trabajar por un archivo corrupto o manipulado, y el hook se silencia. El técnico proponía fallar cerrado por prudencia. Con D1, la regla 1.x garantiza que en 1.x la marca no cambia de significado. | Fallar cerrado ante cualquier marca que no se entienda (técnico). | Una marca futura con otro formato (por ejemplo `2.0`) se leería como ilegible y no bloquearía. Se mitiga fijando en el README que la marca es siempre un único entero. Ver P3. |
| D6. Con marca `newer`, las escrituras se rechazan y toda la carpeta queda en solo lectura (variante B). La comprobación va al principio de `withLock`, antes de crear el directorio de bloqueo, con la clave `store.dataNewer`: como `WayfinderError` en las escrituras y como `Warning` en las lecturas. Recomendación pendiente de confirmar en P1. | Una marca más nueva solo sube con una ruptura que una versión vieja no puede leer ni escribir con seguridad; sin conocer la ruptura, lo único defendible es no escribir. B es la opción más fuerte y la más fácil de probar: todas las rutas lanzan la misma clave y `tree` y `commitCount` no cambian. Cubre todas las escrituras con unas 10 líneas porque todas pasan por `withLock` (comprobado). Técnico e idealista apoyan B. Los cambios aditivos dentro del mismo número no necesitan B: los cubren la lectura tolerante (D8) y el rechazo por elemento. | A (avisar y escribir): la peor para «datos estables», pierde campos de la versión nueva (idealista, seguridad). C (rechazar solo lo que no entiende): fina, pero ante una ruptura de formato no se sabe qué es «lo no entendido», no cubre directorios nuevos ni campos con otra semántica, y es más difícil de probar y explicar. D (negarse a abrir): contradice el cierre («aviso en lugar de ilegible»). Solo lectura parcial (negador): más superficie y casos intermedios. | Con B también se bloquean las escrituras de `.state/` (órdenes de `wf_web`, registro) y el hook falla en silencio. Una sesión vieja no puede registrar avances ni errores hasta reiniciarse. Es una limitación visible: se documenta y se acompaña de una vía de salida (D7). |
| D7. Vía de salida documentada: actualizar o reiniciar la versión que muestra el aviso; si la marca fuera errónea, restaurar el archivo desde el historial git o borrarlo (vuelve a formato 1). Sin variable de entorno para saltarse el bloqueo. | El negador pide una vía de salida, y seguridad exige distinguir una marca realmente más nueva de una corrupta (D4/D5, que no bloquea). Una variable añade configuración para un caso hipotético. | Variable `WAYFINDER_IGNORE_FORMAT` (ver P6). | Quien borre la marca de unos datos realmente más nuevos desactiva la protección. Es una acción manual y deliberada. |
| D8. Lectura tolerante del estado de tarea desconocido (variante 6b, la que pide la tarea). `toTask` acepta un estado que cumpla el patrón de `STATUS_RE` y lo conserva; la tarea va a `tasks`, no a `unreadable`; `Task.status` pasa a admitir texto. Toda escritura sobre ella (`setStatus`, `updateTask`, `logProgress` y cualquier otra que la toque) lanza una clave nueva sin tocar el fichero, como `readForWrite` en `error-records.ts:478-482`. `isBlocking` trata un estado desconocido como no cerrado, así que bloquea a las tareas que dependen de ella. | El punto 3 de WAY-24 lo pide explícitamente («como ya hacen los errores»). ERR-9 fue un estado añadido sin subir ninguna marca, que la marca nunca habría detectado: en ese caso protege la tolerancia. La piden idealista, funcional, accesibilidad, calidad y seguridad. Seguridad avisa de que, sin el freno de escritura, la tolerancia sobrescribe `status` en silencio (riesgo ALTO): el rechazo es inseparable de la tolerancia. | 6a mínima (técnico, negador): mantener `Unreadable` y solo mejorar el mensaje. Se desvía del texto de WAY-24 y no resuelve que hoy `wf_get` devuelva error y el hook calle (ver desacuerdo residual 3). Columna nueva en el tablero. | Coste medio-alto: `statusLabel` (`mcp.ts:122`), el filtro `z.enum(STATUSES)` de `wf_list` (`mcp.ts:342`, que no podrá pedir estados desconocidos; se documenta), los conteos del hook, `server.ts`, `memory.ts:139` y el tablero. Hay que probar que ninguna ruta de escritura sobrescribe el estado (sha idéntico). |
| D9. Web: el estado de la carpeta va en la respuesta de `/api/projects`, como campo nuevo con `state` y, si procede, el entero ya validado, calculado en cada petición. No se amplía `/api/session` ni se crea un endpoint. La interfaz repinta el aviso cada vez que obtiene `/api/projects`. | `/api/session` solo se pide al conectar; poner ahí el estado repetiría el patrón de ERR-9. `/api/projects` se pide en cada refresco y navegación (`app.js:1043-1055`). El vigilante solo mira `projects/` y un cambio que afecte solo a la marca no dispara `change`; vigilar la marca añadiría complejidad, así que la web mostrará el aviso en la siguiente navegación o refresco, no al instante (ver desacuerdo residual 5). Añadir un campo a la respuesta es compatible con los clientes antiguos. El aviso no incluye rutas ni `WAYFINDER_HOME` (LAN). | Campo en `/api/session`. Endpoint nuevo. Vigilar el archivo de marca para enviar el evento. Mostrarlo en cada vista (cada vista ya repinta al navegar). | La web no avisa «en vivo» si nadie navega ni se refresca; se declara como límite. Con B, los POST de escritura devuelven 409 con el mensaje de la clave (que se añade a `CONFLICT_KEYS`). |
| D10. Aviso web: elemento nuevo `#format-notice`, con la estructura visual del aviso de conexión pero separado de `#banner` (cuyo `hidden` controla la conexión, `app.js:1079,1091`). Lleva `role="status"`, es persistente (sin cerrar ni temporizador), usa los tokens existentes `--wf-flag-risk-*` sin crear tokens nuevos, tiene un texto en tres partes (qué pasa, consecuencia, acción) sin jerga, no añade paradas de tabulación y no roba el foco. Con `newer`, la web pone `canWrite` a falso para ocultar los controles y añade el motivo al texto «Solo lectura…» (`app.js:599`); no ofrece «Activar la escritura en este PC». | Accesibilidad y experiencia; `frontend-accesibilidad.md`; DESIGN.md:145 y :184 (no depender del color). Reutiliza el patrón existente de `.notice`. | `role="alert"` permanente (se repetiría). Reutilizar `#banner`. Un diseño propio nuevo. | Obliga a actualizar `docs/design/DESIGN.md` (inventario :145, tablero :151, texto de solo lectura :157) y a hacer una revisión visual según `frontend-visual-review.md`. |
| D11. Tarea con estado desconocido en la web: no se inventa una columna. Va en una sección «Otros estados» al final del tablero, con `h2` y recuento y las tarjetas de siempre. Lleva una píldora neutra con el texto literal («Estado desconocido: review»), insertado con `textContent` y nunca interpolado en `class="pill s-${status}"` (`app.js:258,643`). El detalle es de solo lectura, con una línea que lo explica, y sin Aprobar, Descartar ni Reabrir (se omiten, no se deshabilitan). | Accesibilidad y funcional; es coherente con la sección «Errores» (DESIGN.md:61) y con el texto sin color (:163). Poner un estado desconocido en una columna conocida sería falso. | Columna propia permanente. Dejarla solo en el aviso superior. | Ver P5 (ubicación). Las tareas realmente ilegibles siguen en `.notice role=note`. |
| D12. Aviso en SessionStart: una línea delante del contexto de tareas en cada SessionStart mientras persista la condición, con la instrucción «informa una vez y no intentes arreglar los datos», sin contador ni silenciado. Se reserva su espacio dentro de `MAX_CONTEXT=4000` (`hook.ts:119-176`). En MCP: una línea «Aviso:» en las lecturas (un único punto, en `run`, `mcp.ts:90-98`) y un error accionable en las escrituras rechazadas. El aviso va completo en cada respuesta; no hay lógica de «solo la primera vez». | Idealista: SessionStart es lo único que llega a Claude antes de actuar. Negador: un contador o un silenciado es complejidad evitable. El funcional propuso el aviso completo la primera vez y corto después, pero eso exige un estado por proceso que no existe. El aviso solo interpola del archivo el entero ya validado. | Silenciarlo tras la primera vez (funcional). Una variante corta para las repeticiones. | Ruido repetido mientras dure la condición. Se acepta porque es un estado que la persona tiene que resolver. Ver P4. |
| D13. Regla 1.x escrita en el README, con una prueba pequeña de apoyo (ver desacuerdo residual 6). Se admite en 1.x sin subir la marca: un campo o clave opcional nuevo, un valor nuevo de estado (de tarea o de error), un tipo de entrada nuevo; las versiones que no lo entienden lo conservan, lo muestran y no lo sobrescriben. Obliga a subir la marca, y por tanto a una 2.0: renombrar o quitar un campo, cambiar su significado, mover la estructura de carpetas o añadir valores a `PRIORITIES` u `ORIGINS` (hoy se normalizan a `medium` y `user` al leer y se perderían al reescribir). | Idealista (regla aditiva) y seguridad (el hallazgo de `priority`/`origin` en `tasks.ts:107-108`). La regla y D8 encajan: los estados nuevos son aditivos porque la lectura tolerante los protege. | Prohibir estados nuevos en 1.x (técnico): contradice lo ocurrido en ERR-9 y obligaría a subir la marca por cada estado. | La regla es un documento; la prueba solo fija las enumeraciones sensibles y la constante, y no detecta renombres ni cambios de significado. |
| D14. El README dice que las versiones publicadas antes de WAY-24, 0.1.0 incluida, no leen la marca y que el aviso solo protege desde la versión que lo implemente. | Lo muestran ERR-9 y que ninguna versión anterior lee la marca. Hay que aceptar ese límite para no prometer una garantía que no existe. | Prometer compatibilidad con 0.1.0. | Una sesión vieja puede seguir escribiendo en carpetas marcadas; el aviso solo existe para las que ya tengan este código. |

## Preguntas que requieren decisión de la persona
El borrador no se puede implementar hasta que se respondan P1 a P3, porque cambian el comportamiento o la integridad de los datos. Las demás tienen recomendación y basta con un «de acuerdo».

- **P1. Qué se puede escribir cuando la carpeta es más nueva que el plugin** (la decisión que WAY-24 ya dejaba abierta).
  - Impacto: decide si una sesión vieja puede seguir registrando avances y errores, y cuánto riesgo hay de perder o mezclar datos.
  - Opciones:
    - A: avisar y seguir escribiendo.
    - B: solo lectura de toda la carpeta.
    - C: rechazar solo lo que no se entiende (con aviso).
    - D: negarse a abrir (descartada: contradice el cierre de la tarea).
  - Recomendación: **B**. Es la garantía más fuerte y la más fácil de probar, y encaja con que la marca solo sube en una ruptura. Su coste: una sesión vieja no podrá registrar nada (ni `.state/` ni órdenes de `wf_web`) hasta reiniciarse o actualizarse. Los cambios aditivos dentro del mismo número quedan fuera de esta decisión: los cubre D8.
- **P2. Marca en las carpetas existentes** (desvío del texto de WAY-24).
  - Impacto: el texto pide que la marca se añada a las carpetas existentes «sin tocar tareas ni errores», pero eso rompe la garantía probada de que abrir no escribe y crea un commit que nadie pidió.
  - Opciones:
    - (a) sin marca = 1, y solo se marcan las carpetas nuevas;
    - (b) además, una orden explícita (`wayfinder init` sobre una carpeta existente, con una función aparte `stampFormat`) que escribe la marca con su propio commit;
    - (c) marcar al abrir (no recomendada).
  - Recomendación: **(a)**. Si quieres que las carpetas antiguas queden marcadas, (b) es el camino con menos riesgo, y nunca desde el hook ni desde MCP.
- **P3. Marca ilegible.**
  - Impacto: decide si una marca corrupta o inesperada bloquea el trabajo.
  - Opciones: formato 1 con aviso propio y sin bloqueo (seguridad, negador), o fallar cerrado como si fuera más nueva (técnico).
  - Recomendación: **formato 1 con aviso**, con la regla de que la marca es siempre un único entero decimal. El riesgo es que una marca futura con otra forma se lea como ilegible y no bloquee.
- **P4. Frecuencia del aviso.**
  - Impacto: ruido frente al riesgo de que el aviso se pierda en una sesión larga.
  - Opciones: aviso completo en cada SessionStart y en cada respuesta MCP mientras dure, o solo la primera vez por proceso o sesión (exige guardar estado por proceso).
  - Recomendación: completo cada vez, sin contador (D12).
- **P5. Dónde aparece en la web una tarea con estado desconocido.**
  - Impacto: cambia la experiencia del tablero y DESIGN.md.
  - Opciones: sección «Otros estados» al final del tablero; solo en el bloque de avisos superior con su estado literal; columna propia permanente.
  - Recomendación: «Otros estados», sin acciones (D11).
- **P6. ¿Quieres una variable de entorno para saltarte el bloqueo de solo lectura si la marca fuera errónea?**
  - Impacto: añade configuración pública. Sin ella, la salida es borrar o restaurar el archivo de marca.
  - Opciones: sin variable (y documentar la vía manual) o con variable.
  - Recomendación: sin variable.
- **P7. Aceptar que 0.1.0 y las versiones anteriores a WAY-24 no quedan protegidas**, porque no leen la marca. Es una consecuencia de hecho; se pide confirmar que el README lo diga así. Recomendación: sí.
- **P8. Sanear el valor de `unknown status: X`.**
  - Contexto: hoy `translateReason` interpola el valor del archivo (`i18n/index.ts:41`) en MCP y en la web.
  - Opciones: dejarlo como está (el aviso nuevo no interpola nada del archivo) o sanearlo también.
  - Recomendación: dejarlo fuera de alcance, salvo que la persona lo pida.

## Plan de implementación
Los nombres de los archivos nuevos son provisionales hasta la aprobación. Cada paso deja el repositorio compilando y con las pruebas en verde.

1. `test/helpers.ts`: añadir `makeLegacyHome(t)`, que crea una carpeta «0.1.0» sin usar `initHome`. Contenido:
   - `git init` con `execFileSync`;
   - `.gitignore` y `projects/`;
   - un proyecto, tareas y un error con literales congelados;
   - un archivo con una clave desconocida;
   - un `config.json` con una clave extra;
   - el commit `wf: init`.

   La estructura se toma de un commit real del repositorio, no se inventa.
   - Validación: `node --test test/store.test.ts` con una prueba que abre la carpeta y comprueba que `tree`, `commitCount` y `git status --porcelain` quedan limpios.
2. `src/store/format.ts` (nuevo): `FORMAT_VERSION = 1`, con el comentario «súbela solo con un cambio incompatible; ver regla 1.x del README», y `checkFormat(home)`, que devuelve `ok | newer | unreadable` según la tabla de D4. Lee con `readFileSync`, sin caché y sin importar `sync.ts` (para evitar ciclos). Solo expone el entero ya validado.
   - Validación: `test/store.test.ts` con los casos ausente, vacía, `1`, `2`, `abc`, `0`, `-1`, `1.5`, número enorme y directorio en lugar de archivo.
3. `src/store/init.ts`: `initHome` escribe la marca en las carpetas nuevas dentro del commit `wf: init`. En las carpetas existentes sigue sin escribir; el docstring de `init.ts:46-53` se amplía con «tampoco escribe la marca». Si la persona elige P2(b), se añade `stampFormat(home)` aparte y solo se llama desde `cli.ts:136`.
   - Validación: `test/store.test.ts:30-41` sigue pasando sin cambios, y una prueba nueva comprueba que una carpeta nueva contiene la marca en el commit `wf: init`.
4. `src/store/sync.ts` (`withLock`): al principio, antes de crear el directorio de bloqueo, lanzar `WayfinderError('store.dataNewer', {found, supported})` si `checkFormat` devuelve `newer`. Las rutas de solo lectura no usan el lock y siguen funcionando.
   - Validación: prueba parametrizada sobre cada ruta de escritura (`createTask`, `updateTask`, `setStatus`, `logProgress`, errores, `appendLog`, `attachCapture`, `approveByChat`, `reviewTask`, `createProject`, `registerByOrder`, `declineRegistration`, `writeState`, órdenes de `.state/`): todas lanzan la misma clave y `tree` y `commitCount` no cambian.
   - Validación: prueba de marca cambiada con `createWayfinderServer`/`startServer` vivo: primera llamada sin aviso, `writeFileSync` de la marca y segunda llamada con aviso y rechazo.
5. `src/store/errors.ts`, `src/i18n/es.json` y `src/i18n/en.json`: claves nuevas `store.dataNewer`, el aviso de marca ilegible y el rechazo de escritura sobre una tarea con estado desconocido. Cada texto dice qué pasa, qué no se hizo y qué hacer, y solo interpola del archivo el entero ya validado.
   - Validación: `node --test test/i18n.test.ts` (toda clave en los dos idiomas).
6. `src/store/tasks.ts` y sus consumidores (`src/mcp.ts`, `src/server.ts`, `src/hook.ts`, `src/store/memory.ts`): lectura tolerante del estado desconocido (D8).
   - `toTask` acepta el patrón de estado; `Task.status` admite texto; `isBlocking` bloquea; las escrituras sobre la tarea lanzan antes de reescribir.
   - `wf_list` y `wf_get` muestran el estado literal con la etiqueta «desconocido para esta versión», y `wf_list` deja de contarla como ilegible.
   - El hook no la cuenta entre los estados conocidos, pero la menciona.
   - Se ajustan `statusLabel` (`mcp.ts:122`) y el filtro `z.enum(STATUSES)` (`mcp.ts:342`), y se documenta que el filtro no puede pedir estados desconocidos.
   - Validación: pruebas en `test/store.test.ts`, `test/mcp.integration.test.ts`, `test/hook.test.ts` y `test/server.test.ts` con una tarea `status: snoozed`. Debe aparecer en `wf_list`, `wf_get` y la API. Tras intentar `wf_set_status`, `wf_update`, `wf_log` y los POST web de aprobar, descartar y reabrir, que fallan con su clave propia, el `sha` del archivo queda idéntico. Una tarea que depende de ella aparece como bloqueada.
7. `src/mcp.ts` (`run`, `mcp.ts:90-98`): tras `assertInitialized`, añadir el aviso de `checkFormat` como `Warning`, tanto en éxito como en `isError` (un único punto). La escritura rechazada se traduce con la clave de D6.
   - Validación: `test/mcp.integration.test.ts` parametrizado con `MCP_TOOLS`. Cada herramienta de lectura devuelve el aviso, cada una de escritura devuelve un `isError` accionable, y con una carpeta de `makeLegacyHome` ninguna avisa.
8. `src/hook.ts` (`sessionContext`, `hook.ts:119-176`): si `checkFormat` no devuelve `ok`, una línea de aviso delante de las tareas en cada SessionStart, más la instrucción «informa una vez y no intentes arreglar los datos». Se respeta `MAX_CONTEXT=4000` reservando el aviso antes de recortar. No lanza: queda dentro del try/catch existente.
   - Validación: `test/hook.test.ts`. El aviso está presente con muchas tareas y ausente con una carpeta 0.1.0; con una carpeta no inicializada no cambia nada; sobre una carpeta antigua, el hook no modifica `tree` ni los commits.
9. `src/server.ts` (`/api/projects` y `CONFLICT_KEYS`): campo nuevo con el estado de la carpeta, calculado en cada petición. `store.dataNewer` y la clave de tarea desconocida responden 409 en los POST. Sin campos nuevos en `/api/session` y sin endpoint nuevo.
   - Validación: `test/server.test.ts`:
     - la respuesta lleva el campo o no según la marca;
     - con el servidor vivo, si la marca cambia, la segunda petición trae el estado nuevo;
     - un POST de escritura responde 409 con el mensaje traducido;
     - el campo no contiene rutas ni `WAYFINDER_HOME`.
10. `web/index.html`, `web/app.js`, `web/styles.css` y `docs/design/DESIGN.md`:
    - `#format-notice` (D10), con `role="status"`, repintado cada vez que se obtiene `/api/projects` e independiente de `#banner`;
    - el texto «Solo lectura» ampliado con el motivo;
    - la sección «Otros estados» y la píldora de estado desconocido, con `textContent` y clase fija (D11);
    - el detalle de solo lectura;
    - en DESIGN.md: inventario (:145), «Tablero» (:151), «Solo lectura» (:157) y una fila nueva «Aviso de formato» con su severidad.
    - Validación: `npm run test:e2e` con escenarios nuevos, todos sobre un proyecto nuevo de `e2e/fixture-server.ts` para no alterar los recuentos existentes:
      - con marca más nueva: el aviso y el modo de solo lectura;
      - la tarea `foo` en «Otros estados», sin acciones, con el archivo intacto;
      - reconectar no oculta el aviso;
      - un texto hostil se muestra inerte;
      - la versión en inglés.
    - Validación: revisión visual según `frontend-visual-review.md` a 320, 768 y 1280 px, en claro y oscuro.
11. `test/format.test.ts` (nuevo, pequeño): fija `FORMAT_VERSION`, `PRIORITIES` y `ORIGINS` a literales, con un mensaje que remite a la regla 1.x del README. Puede incluir `STATUSES` y `ERROR_STATUSES` a modo de documentación (ver desacuerdo residual 6).
    - Validación: `npm test`.
12. `README.md`: una sección sobre el aviso de datos más nuevos y la regla 1.x (D13), cómo salir de la situación (D7), qué hace una versión vieja y que las versiones publicadas antes de WAY-24 no leen la marca (D14). Las notas «Versiones anteriores» (líneas 69, 76, 84 y 120) solo se tocan si cambian de significado.
    - Validación: revisión del diff; las rutas y claves citadas existen en el código.
13. `plugin/dist/`: se reconstruye desde el checkout principal (ERR-11), no desde el worktree.
    - Validación: `npm run check:dist` ejecutado en el checkout principal.

## Criterios de aceptación
- [ ] Una carpeta «0.1.0» (`makeLegacyHome`) abierta con la CLI (`serve`, `init`), MCP (`wf_list`, `wf_get`, `wf_search`), el hook y la web (GET) no muestra aviso, conserva `tree` idéntico y el mismo número de commits, y deja `git status --porcelain` vacío.
- [ ] Una carpeta nueva contiene la marca en el commit `wf: init`, y abrir una carpeta existente no la escribe (`store.test.ts:30-41` sigue en verde).
- [ ] Con una marca más nueva y legible, el aviso aparece con su clave i18n (es/en), el formato encontrado, el soportado y la acción, en SessionStart, MCP y web (API y pantalla). Nunca dice «ilegible» por este motivo y las tareas se siguen listando.
- [ ] Con una marca más nueva, toda ruta de escritura (la lista del paso 4) falla con la misma clave sin modificar ningún archivo (`tree` y `commitCount` iguales). Si P1 no es B, este criterio se ajusta.
- [ ] Una marca ilegible (vacía, `abc`, `0`, `-1`, `1.5`, enorme) muestra su propio aviso, no bloquea y no se presenta como «más nueva».
- [ ] Si la marca cambia con un proceso MCP o web vivo, sin reiniciarlo, la siguiente llamada MCP avisa y la siguiente respuesta de `/api/projects` trae el estado; la pantalla lo muestra en el siguiente refresco o navegación.
- [ ] Una tarea con estado desconocido (`status: snoozed`):
  - se ve con su estado literal en `wf_list`, `wf_get`, la API y el tablero («Otros estados»), y no cuenta como ilegible;
  - `wf_set_status`, `wf_update`, `wf_log` y los POST web fallan con su clave propia y el archivo queda igual byte a byte (`sha`);
  - las tareas que dependen de ella figuran como bloqueadas.
- [ ] Ninguna operación permitida con datos más nuevos modifica claves, estados o archivos que la versión no entiende.
- [ ] El aviso web no depende del color, se anuncia como estado sin robar el foco, no añade paradas de tabulación, funciona en es/en y se ve a 320, 768 y 1280 px sin desbordamiento horizontal.
- [ ] El aviso no incluye rutas ni `WAYFINDER_HOME`; solo interpola el entero ya validado.
- [ ] El README documenta el aviso, la regla 1.x, la vía de salida y el límite de las versiones anteriores, y DESIGN.md está actualizado.
- [ ] `plugin/dist` está reconstruido desde el checkout principal y `npm run check:dist` pasa.

## Estrategia de validación
- **Pruebas específicas:**
  - Unidad en `test/store.test.ts`: tabla de la marca, `initHome`, `withLock` y tarea con estado desconocido.
  - `test/hook.test.ts`, `test/mcp.integration.test.ts`, `test/server.test.ts` y `test/i18n.test.ts`.
  - `test/cli.test.ts`: `serve` e `init` sobre una carpeta antigua y sobre una más nueva. Antes de escribir la prueba, confirmar cómo se prueba la CLI en ese archivo.
  - Proceso vivo: `createWayfinderServer`/`startServer`, una llamada, `writeFileSync` de la marca y una segunda llamada.
  - Matriz para distinguir A/B/C: una carpeta más nueva con una tarea que tiene una clave desconocida, y un `wf_update` sobre un campo conocido. Con B debe fallar dejando `tree` y `commitCount` iguales en cada ruta.
- **Validaciones amplias:**
  - `npm run typecheck`.
  - `npm test` (su `pretest` construye antes).
  - `npm run test:e2e`.
  - `npm run check:dist`, desde el checkout principal.
  - `npm run test:docker`, solo si hay Docker. Si no lo hay, se declara bloqueado o no verificado y se explica cómo reproducirlo.
- **Verificación funcional:**
  - Sesión real sobre una copia de una carpeta (nunca `~/.wayfinder`).
  - Repetición manual de ERR-9: abrir la web, cambiar la marca a mano, recargar y comprobar el aviso y el modo de solo lectura.
  - `git status` limpio en la copia después de solo mirar.
  - Revisión visual según `frontend-visual-review.md` y `DESIGN.md`. Las capturas de Playwright, solo con una aserción funcional previa y un baseline aprobado.
- **Seguridad:**
  - `sha` idéntico en las rutas rechazadas.
  - Marcas hostiles (basura, enormes, un directorio, un symlink): ni bloquean sin motivo ni copian su contenido al aviso.
  - La respuesta web no contiene rutas.
  - Un texto hostil en el estado literal se muestra inerte (`textContent`).
- **Accesibilidad:**
  - Teclado y foco: sin paradas nuevas y sin robar el foco.
  - Snapshot de accesibilidad: `status`, `h2` «Otros estados» y la píldora.
  - No depender del color.
  - Zoom y ventana reducida.
  - Español e inglés.
- **No verificable en esta fase:**
  - La compatibilidad real de 0.1.0 y de las versiones anteriores con carpetas marcadas (se declara en el README).
  - Lectores de pantalla y dispositivos reales.
  - El comportamiento en Docker si no hay Docker disponible.

## Riesgos y reversión
- **Lectura tolerante:** una ruta de escritura que no pase por el freno podría sobrescribir `status` en silencio.
  - Mitigación: guardián en todas las escrituras que leen una tarea, y una prueba parametrizada por ruta con `sha`.
  - Reversión: revertir el commit. Esta función no cambia ningún dato de las carpetas existentes.
- **Solo lectura (B):** una sesión vieja se queda sin poder escribir, también las órdenes de `wf_web` y el registro de `.state/`.
  - Mitigación: aviso accionable, vía de salida documentada y distinción entre marca real y marca ilegible (D5).
  - Reversión: borrar o restaurar el archivo de marca a mano devuelve la carpeta al formato 1.
- **Marca manipulada o corrupta.**
  - Mitigación: la tabla de D4 (una marca ilegible no bloquea) y un aviso que no copia el contenido.
- **Falsa sensación de protección en las versiones ya publicadas.**
  - Mitigación: el README (D14) y P7.
- **El aviso web no aparece hasta navegar o refrescar.**
  - Mitigación: documentarlo. La marca no se vigila.
- **Reconstruir `plugin/dist` desde el worktree (ERR-11).**
  - Mitigación: construir y ejecutar `check:dist` en el checkout principal.
- **Ruido del aviso repetido en cada SessionStart.**
  - Mitigación: una única línea corta. Aceptado (P4).
- **El cambio de tipo de `Task.status` rompe a sus consumidores.**
  - Mitigación: `npm run typecheck` y revisión de cada consumidor (`hook.ts:337,358`, `mcp.ts:123,356`, `server.ts:98,230,245,307`, `memory.ts:139`).
- **Recuperación:** no hay migración ni cambios en los datos persistentes. Si algo se escribiera mal, se recupera con el historial git y con autorización explícita. Todas las operaciones sensibles (commit, publicación, `plugin/dist`) siguen `git-y-operaciones-sensibles.md` y no se ejecutan sin autorización.

## Desacuerdos residuales
1. **Qué hacer al escribir con datos más nuevos.**
   - Posturas: técnico e idealista, B. Seguridad, C con aviso, por su mejor relación entre daño y bloqueo y porque es un patrón que ya existe. El negador, solo lectura parcial.
   - Evidencia: la marca solo sube con una ruptura, y ante una ruptura no se sabe qué es «lo no entendido». Por eso C no se puede probar ni explicar, mientras que B se prueba con una sola clave en todas las rutas. El caso aditivo que C quiere cubrir ya lo cubre la lectura tolerante (D8).
   - Recomendación: B (P1). Lo decide la persona.
2. **Marca ilegible.**
   - Posturas: el técnico, fallar cerrado. Seguridad y el negador, formato 1 con aviso.
   - Evidencia: bloquear por una marca corrupta deja atrapada a la persona y el hook se silencia.
   - Recomendación: formato 1 con aviso propio (P3), con la regla de que la marca es un único entero.
   - Nota del responsable: en la v1, sin mediador, el responsable había recomendado fallar cerrado. Esta v2 adopta la recomendación del mediador y deja constancia de esa postura.
3. **Estado de tarea desconocido.**
   - Posturas: el técnico y el negador, 6a (mantener `Unreadable` y mejorar el mensaje: cuesta menos, y con B no se pierden datos). Idealista, funcional, accesibilidad, calidad y seguridad, 6b.
   - Evidencia: el texto de WAY-24 pide lectura tolerante «como los errores». ERR-9 fue un estado añadido sin cambio de marca, que B no habría detectado. Hoy `wf_get` devuelve `isError` y el hook calla.
   - Recomendación: 6b con freno de escritura, como parte de WAY-24.
   - Hallazgo del negador: `isBlocking` trata una dependencia ilegible como no bloqueante (`tasks.ts:317-319`). Con 6b queda resuelto para los estados desconocidos; el caso de los archivos realmente rotos queda fuera de alcance y se registra como hallazgo aparte.
4. **Marca en las carpetas existentes.**
   - Posturas: el texto de WAY-24 pide escribirla; técnico, negador, idealista, seguridad y calidad, no escribirla.
   - Evidencia: `init.ts:46-53` y `store.test.ts:30-41`.
   - Recomendación: no escribirla (P2), con `stampFormat` explícito como alternativa. Es un desvío del texto que decide la persona.
5. **Dónde expone la web el estado.**
   - Posturas: funcional y accesibilidad dan por hecho que el aviso llega con «la siguiente petición»; el negador pide no ampliar la API más de lo necesario.
   - Evidencia: `/api/session` solo se pide al conectar y el vigilante solo mira `projects/`.
   - Recomendación: un campo en `/api/projects`, sin caché. El aviso aparece en el siguiente refresco o navegación, no al instante. Vigilar la marca aumentaría la complejidad y no se recomienda.
6. **Regla 1.x: solo documento o también prueba.**
   - Posturas: el negador, solo documento, porque una prueba sería teatro. El técnico, una prueba que fije las constantes.
   - Evidencia: con la regla aditiva elegida, fijar `STATUSES` haría fallar cambios legítimos; fijar `FORMAT_VERSION`, `PRIORITIES` y `ORIGINS`, en cambio, protege contra una pérdida silenciosa real.
   - Recomendación: el documento más una prueba pequeña limitada a esas constantes. No detecta renombres ni cambios de significado, y el README lo dice.
7. **Repetición del aviso.**
   - Posturas: el funcional, completo la primera vez y corto después. El idealista, en cada SessionStart. El negador, sin contador.
   - Evidencia: no existe un estado por proceso con el que saber cuál es «la primera vez».
   - Recomendación: completo cada vez (P4).
