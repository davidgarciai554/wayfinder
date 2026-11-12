# Wayfinder

Gestor de tareas personal en Markdown que Claude Code usa como "Jira personal" y como memoria de cada proyecto.

- Claude consulta lo pendiente, propone ideas, mueve estados y registra cada avance en el historial de la tarea; la bitácora del día enlaza a esos avances.
- Tú sobre todo miras, creas tareas y apruebas o descartas ideas, desde la web local o pidiéndoselo a Claude en el chat.

Los datos viven en una carpeta privada (`~/.wayfinder`): un repositorio git **sin remoto** con un commit por cada escritura. Nada de Wayfinder se guarda en `.claude/`, `AGENTS.md` ni `CLAUDE.md` de tus proyectos.

## Requisitos

- Windows 11 (es la única plataforma verificada).
- Node.js 22 o superior y git.
- Claude Code 2.1.271 o superior, para el plugin. La instalación con un solo comando está probada con Claude Code 2.1.318.

## Instalación del plugin de Claude Code

Desde GitHub, con un solo comando:

```powershell
claude plugin install wayfinder --marketplace davidgarciai554/wayfinder --config language=es
```

Añade el marketplace de Wayfinder si aún no lo tienes e instala el plugin. Desde una copia local de este repositorio, cambia `davidgarciai554/wayfinder` por la ruta, por ejemplo `--marketplace D:\ruta\a\wayfinder`.

Si tu versión de Claude Code no acepta `--marketplace`, usa los dos pasos:

```powershell
claude plugin marketplace add davidgarciai554/wayfinder
claude plugin install wayfinder@wayfinder --config language=es
```

Al terminar, Claude Code puede avisar de que hay opciones sin configurar: son `home`, `capturesDir` y `webHost`, que son opcionales y puedes dejar así.

- `language`: `es` o `en`. Idioma de los mensajes, de la web y de las respuestas de Claude sobre Wayfinder.
- `home` (opcional): carpeta de datos. Por defecto, `~/.wayfinder`.
- `capturesDir` (opcional): carpeta extra desde la que se pueden adjuntar capturas, además del repositorio actual.
- `webHost` (opcional): la IP de este PC en tu red o en Tailscale (una IP, por ejemplo `192.168.1.20`; no un nombre ni `0.0.0.0`), para abrir la web también en otros dispositivos. Vacía o no válida, la web solo se abre en este PC.

Puedes cambiarlas después con `/plugin` o con `claude plugin configure wayfinder`.

### Primer uso

1. En el repositorio que quieras seguir, escribe tú en el chat: «registra este proyecto» (o «register this project»).
   - Tiene que ser esa frase, escrita por ti: un «sí» no basta. Así Claude no puede registrar un repositorio por su cuenta.
   - La orden vale 15 minutos y para un solo registro.
   - Si aún no existe la carpeta de datos (`~/.wayfinder`), se crea en ese momento. Ya no hace falta `wayfinder init`, aunque sigue disponible.
2. Si no quieres seguir un repositorio, díselo a Claude: lo anota y Wayfinder deja de preguntar en él. Puedes registrarlo más adelante con la misma frase.
3. A partir de ahí, cada sesión empieza con la lista de pendientes y las propuestas sin aprobar.
   - Claude mueve los estados mientras trabaja.
   - Cada avance queda en el historial de la tarea y en una línea de la bitácora que enlaza a él (ver «Historial y memoria»).
   - Antes de terminar, si hay tareas en curso y hoy no se ha registrado ningún avance, Claude lo registra.
   - Las tareas no triviales necesitan un plan en `Planes/` antes de pasar a «En curso».

### Historial y memoria

Cada tarea tiene una sección `## Historial` al final de su archivo. Nace con una entrada de creación y crece con cada avance que Claude registra con `wf_log` y el ID de la tarea:

- **En la tarea:** fecha y hora, qué se hizo, decisiones, archivos, siguiente paso y bloqueos.
- **En la bitácora del día:** una línea «WAY-3 · título — Avanzamos en…» que enlaza a esa entrada. El trabajo menor sin tarea (por ejemplo, revisar el repositorio) va solo a la bitácora.
- **En la web:** desde la bitácora llegas a la entrada concreta del historial, y desde cada entrada al día de la bitácora en que se escribió.
- **Para Claude:** al empezar la sesión recibe el último avance de hasta dos tareas en curso. Bajo demanda, `wf_history` da el índice del historial de una tarea, una entrada completa o la línea temporal de los últimos días, y `wf_search` busca texto literal en errores, tareas, historiales y bitácora.

Reglas del historial:

- Solo Wayfinder escribe en él. Editar la descripción de la tarea nunca lo toca, y una descripción no puede contener la línea `## Historial`.
- Tiene su propio límite de 100 000 caracteres por tarea. Avisa al pasar del 80 % y, al llegar al límite, rechaza la entrada con un mensaje claro.
- Lo que Claude lee del historial se trata como dato no confiable, igual que las descripciones.
- Las tareas creadas antes de esta versión no se migran: muestran el historial vacío hasta su primer avance.

### Registro de errores

Cuando algo falla (compilación, pruebas, análisis, ejecución o un comportamiento inesperado), Claude lo registra con `wf_error`, ligado a la tarea en la que trabaja. Es el equivalente, dentro de Wayfinder, del `ERRORES.md` que piden las instrucciones base.

- **Un archivo por error:** `projects/<slug>/errors/ERR-n-<título>.md`, con contexto, reproducción, salida observada, causa (hipótesis o confirmada), solución, validación, resultado y archivos. Estado abierto o resuelto. El prefijo `ERR` está reservado: ningún proyecto nuevo puede usarlo.
- **Acciones:** `create` (necesita la tarea, que debe existir, y el contexto), `update` (causa, solución, validación, resultado y archivos; también reabrir con una nota), `note` (una recurrencia o una corrección) y `resolve` (exige solución y validación). El contexto, la reproducción y la salida no se cambian: se corrigen con una nota.
- **Antes de investigar:** `wf_search` muestra primero hasta 5 errores, y al crear uno Claude ve los posibles duplicados abiertos. Si es el mismo fallo, añade una nota en lugar de crear otro.
- **Para Claude:** `wf_get ERR-n` da el error completo y `wf_get` de una tarea lista sus errores. Al empezar la sesión recibe hasta 5 errores abiertos (solo ID, tarea y título), si caben.
- **En la web:** pestaña «Errores» con abiertos y resueltos, una página por error y la sección «Errores (n)» en cada tarea. Solo lectura.
- **Secretos:** un campo que parece contener un secreto se rechaza y no se guarda nada. El detector es heurístico y no reconoce datos personales (por ejemplo, carpetas de usuario o correos): resume la salida en vez de pegarla entera.
- El texto de los errores se trata como dato no confiable, igual que el de las tareas.

### Aprobar ideas desde el chat

Escribe la orden con el ID, por ejemplo «aprueba WAY-4».

1. Claude revisa la propuesta antes de aprobarla.
2. Si ve algo sospechoso (instrucciones ocultas, peticiones de secretos, comandos de red…), te explica el motivo y no la aprueba hasta que repitas la orden, por ejemplo «aprueba WAY-4 igualmente».
3. Solo se aprueban por chat las propuestas creadas por Claude, y quedan marcadas como «Aprobada por chat».

## Web

Escribe en el chat **«abre Wayfinder»** (o «open Wayfinder»). Como en el registro, tiene que ser esa frase, escrita por ti: un «sí» no basta.

- Claude abre la web para esa sesión y te da una dirección de este PC, por ejemplo `http://127.0.0.1:4747/`. Ábrela en el navegador del PC.
- Si la web se abre también en la red (opción `webHost`), Claude te da además el enlace para el móvil, que se abre con un toque. Si usas Claude desde el móvil (Remote Control), púlsalo ahí mismo.
- En esa página:
  - **«Activar la escritura en este PC»** habilita crear, aprobar y descartar en ese navegador.
  - **«Abrir en otro dispositivo»** muestra el enlace para el móvil u otro equipo, con un botón para copiarlo.
- Para usarla en otros dispositivos, configura la opción `webHost` del plugin con la IP de este PC en tu red o en Tailscale. Sin `webHost`, la web solo se abre en este PC.
- Fuera de este PC, todo pide la clave del enlace, también leer.
- Cada vez que se abre la web hay una clave nueva, y la anterior deja de valer. Un enlace antiguo muestra «Este enlace ya no es válido».
- Al abrir el enlace, la clave se guarda en una cookie de ese navegador y desaparece de la dirección. Por eso, ese navegador puede volver a entrar sin el enlace mientras dure la sesión. Otros navegadores y dispositivos siguen necesitando el enlace, y la cookie deja de valer cuando cambia la clave.
- La web se cierra al terminar la sesión de Claude.
- El tráfico no va cifrado: úsala en tu red de casa o con Tailscale.
- **La primera vez que abras Wayfinder en la red, acepta en el PC el aviso del cortafuegos.** Si no lo aceptas, el móvil no podrá conectar. Wayfinder no cambia las reglas del cortafuegos.
  - Windows pregunta si permite que Node.js acceda a la red: marca solo **redes privadas** y pulsa «Permitir». Tu red de casa tiene que estar marcada como privada.
  - En Mac el cortafuegos viene desactivado por defecto. Si lo tienes activado, macOS pregunta si permite conexiones entrantes a `node`: pulsa «Permitir».
  - Si cerraste el aviso sin aceptarlo, en Windows puedes crear la regla a mano desde «Firewall de Windows Defender» › «Permitir una aplicación a través del firewall» › «Cambiar la configuración». Las dos vías piden permisos de administrador. Si usas el comando, abre PowerShell con «Ejecutar como administrador»; si no, Windows responde «Acceso denegado». En un equipo de empresa puede que solo pueda hacerlo el departamento de IT.

    ```powershell
    New-NetFirewallRule -DisplayName "Wayfinder (Node) - red privada" -Direction Inbound -Action Allow -Protocol TCP -Program "C:\Program Files\nodejs\node.exe" -LocalPort 4747 -Profile Private
    ```
- Límites:
  - La web solo existe mientras dura la sesión de Claude que la abrió. Con Claude cerrado, el móvil no puede conectar, y un enlace antiguo no puede mostrar el aviso de caducado.
  - Si tu router asigna otra IP al PC (DHCP), actualiza `webHost`. Con Tailscale, la IP de la red de Tailscale no cambia.
  - Si otra sesión de Claude ya usa el puerto 4747, la web se abre en otro puerto libre, con su propia clave.

Para desarrollo o Docker sigue existiendo `wayfinder serve`:

```powershell
node "<carpeta del plugin>\dist\wayfinder.mjs" serve
```

- Imprime un enlace con clave, `http://127.0.0.1:4747/?k=…`, que también cambia en cada arranque. Sin la clave, en este equipo la web es de solo lectura.
- Opciones:
  - `--port <n>` (o `WAYFINDER_PORT`): el puerto. Si está ocupado por otra aplicación, `serve` lo dice y no arranca.
  - `--poll`: detecta los cambios por sondeo, para unidades de red.

## Línea de comandos sin el plugin

El paquete no está publicado en npm. Se instala desde GitHub, que lo construye al instalarlo:

```powershell
npm install -g github:davidgarciai554/wayfinder
wayfinder init
wayfinder serve
```

El paquete incluye un único archivo `dist/wayfinder.mjs` sin dependencias, la web y `THIRD_PARTY_NOTICES.md` con las licencias de las bibliotecas que lleva dentro.

## Seguridad y privacidad

- Nunca guardes secretos ni datos personales en tareas, bitácoras o capturas. Wayfinder rechaza los patrones de secreto más comunes, pero es una ayuda, no una garantía.
- Mantén la carpeta de datos privada y sin remoto. Wayfinder nunca hace `push`.
- El contenido de las tareas se trata como datos no confiables: Claude no sigue instrucciones escritas dentro de ellas.
- Para registrar un repositorio, aprobar una propuesta o abrir la web hacen falta tus propias palabras en el chat: «registra este proyecto», «aprueba WAY-n», «abre Wayfinder». El hook las detecta en tu mensaje, así que un «sí», o el texto de una tarea que Claude lea, no bastan.
  - Es una protección de mejor esfuerzo, como el detector de secretos.
  - Un Claude manipulado que pueda ejecutar comandos podría saltársela escribiendo directamente en el estado de Wayfinder. Y cuando la web se abre en la red, Claude recibe el enlace con la clave para dártelo, así que también podría usarlo para escribir o aprobar desde la web. La skill le prohíbe usarlo, pero eso no es una barrera técnica.
  - Siguen dos barreras de antes: la página local solo entrega la clave a peticiones del propio navegador, y el hook bloquea los comandos que la piden. Ya no impiden que Claude conozca la clave cuando la web está en la red.
  - Si trabajas con permisos automáticos, revisa qué comandos ejecuta.
  - Un texto ajeno que pegues sin citar (`>`) ni poner en un bloque de código cuenta como tuyo.
- Si la web solo se abre en este PC, Claude recibe la dirección sin la clave. Si se abre en la red, recibe también el enlace para otros dispositivos, que lleva la clave y queda en el historial de la conversación hasta que esa clave caduca al cerrar la sesión. Cualquier programa de tu PC puede leer la página local, igual que puede leer tu carpeta de datos.
- Fuera de tu PC la web pide la clave para todo y va sin cifrar: úsala en tu red de casa o con Tailscale, y no compartas el enlace.

## Desarrollo

```powershell
npm ci
npm run typecheck
npm test              # unitarios e integración (construye antes)
npm run test:e2e      # Playwright
npm run test:docker   # requiere Docker Desktop y la imagen wayfinder:dev
npm run check:dist    # dist/ y plugin/dist/ al día; git sin subcomandos de red
```

El plugin vive en `plugin/`, con `plugin/dist/` versionado. El marketplace está en `.claude-plugin/marketplace.json`.

## Docker

La imagen sirve la web local y, como variante, el servidor MCP por stdio. No está publicada en ningún registro: se construye en tu equipo. Los ejemplos son para PowerShell en Windows con Docker Desktop.

```powershell
docker build -t wayfinder:dev https://github.com/davidgarciai554/wayfinder.git#main
```

Desde una copia local del repositorio: `docker build -t wayfinder:dev .`

La imagen no declara ningún volumen. Monta siempre tu carpeta de datos en `/data`; sin ella, `serve` y `mcp` salen con un error.

### Crear la carpeta de datos (`init`)

Solo si aún no existe. Si ya usas Wayfinder fuera de Docker, monta la misma carpeta.

```powershell
docker run --rm -v "$env:USERPROFILE\.wayfinder:/data" --read-only --tmpfs /tmp --cap-drop=ALL --security-opt no-new-privileges wayfinder:dev init --lang es
```

### Web

```powershell
docker run --rm -p 127.0.0.1:4747:4747 -e WAYFINDER_PUBLIC_PORT=4747 `
  -v "$env:USERPROFILE\.wayfinder:/data" `
  --read-only --tmpfs /tmp --cap-drop=ALL --security-opt no-new-privileges `
  wayfinder:dev
```

- Abre el enlace que imprime, `http://127.0.0.1:4747/?k=…`: lleva la clave de ese arranque. Como dentro del contenedor la web escucha en `0.0.0.0`, sin la clave no deja ni leer: muestra una página de acceso. Un enlace de un arranque anterior avisa de que ya no es válido.
- Publica el puerto **solo en `127.0.0.1`** y no uses `--network host`. Dentro del contenedor la web escucha en `0.0.0.0` (por eso avisa al arrancar), pero solo se publica en este equipo.
- Si cambias el puerto publicado, cambia también `WAYFINDER_PUBLIC_PORT`; la web solo acepta peticiones dirigidas a ese puerto.
- La clave aparece en `docker logs`: no compartas esos registros.
- El contenedor detecta los cambios por sondeo (`--poll`), porque los avisos de cambios de archivos no son fiables en las carpetas montadas.
- Idioma: `-e WAYFINDER_LANG=en`.

### Servidor MCP por stdio

Para un cliente MCP que lance el contenedor. El plugin de Claude Code **no** usa esta variante: usa su propio bundle.

```powershell
docker run -i --rm --network none --read-only --tmpfs /tmp --cap-drop=ALL --security-opt no-new-privileges `
  -v "$env:USERPROFILE\.wayfinder:/data" -e WAYFINDER_PROJECT=<slug> `
  -v "<carpeta de capturas>:/captures:ro" -e WAYFINDER_CAPTURES_DIR=/captures `
  -v "<repositorio>:/workspace:ro" -e CLAUDE_PROJECT_DIR=/workspace `
  wayfinder:dev mcp
```

- Sin `-t`, porque stdout lleva JSON-RPC.
- El proyecto se indica siempre con `WAYFINDER_PROJECT`.
- `wf_attach` solo acepta rutas del contenedor bajo `/captures`.
- La regla del plan solo puede comprobar `plan` si el repositorio está montado en `/workspace`. Sin él, pasar a `in-progress` una tarea no trivial falla con una explicación.
- La aprobación por chat necesita el hook del plugin que registra las órdenes en la misma carpeta de datos. Sin él, se rechaza.

### Uso a la vez que el host

Las escrituras del host y del contenedor sobre la misma carpeta comparten el mismo bloqueo. Se ha comprobado con Docker Desktop 29.9.2 en Windows 11: 20 escrituras alternas, sin IDs duplicados.

### Verificación

```powershell
npm run test:docker
```

Construye antes la imagen `wayfinder:dev`. La prueba necesita el motor de Docker en marcha.
