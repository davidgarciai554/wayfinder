# Wayfinder

Gestor de tareas personal en Markdown que Claude Code usa como "Jira personal" y como memoria de cada proyecto.

- Claude consulta lo pendiente, propone ideas, mueve estados y registra cada avance en el historial de la tarea; la bitácora del día enlaza a esos avances.
- Tú sobre todo miras, creas tareas y apruebas o descartas ideas, desde la web local o pidiéndoselo a Claude en el chat.

Los datos viven en una carpeta privada (`~/.wayfinder`): un repositorio git **sin remoto** con un commit por cada escritura. Nada de Wayfinder se guarda en `.claude/`, `AGENTS.md` ni `CLAUDE.md` de tus proyectos.

## Requisitos

- Windows 11 (es la única plataforma verificada).
- Node.js 22 o superior y git.
- Claude Code 2.1.271 o superior, para el plugin.

## Instalación del plugin de Claude Code

Desde GitHub:

```powershell
claude plugin marketplace add davidgarciai554/wayfinder
claude plugin install wayfinder@wayfinder --config language=es
```

O desde una copia local de este repositorio, con `claude plugin marketplace add D:\ruta\a\wayfinder` en la primera línea.

- `language`: `es` o `en`. Idioma de los mensajes, de la web y de las respuestas de Claude sobre Wayfinder.
- `home` (opcional): carpeta de datos. Por defecto, `~/.wayfinder`.
- `capturesDir` (opcional): carpeta extra desde la que se pueden adjuntar capturas, además del repositorio actual.

Puedes cambiarlas después con `/plugin` o con `claude plugin configure wayfinder`.

### Primer uso

1. Crea la carpeta de datos una sola vez. En la primera sesión tras instalar, Claude Code te muestra el comando exacto con la ruta del plugin. Por ejemplo:
   ```powershell
   node "<carpeta del plugin>\dist\wayfinder.mjs" init
   ```
2. En el repositorio que quieras seguir, pide a Claude: «registra este proyecto en Wayfinder». El registro es siempre explícito, proyecto a proyecto.
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

## Web local

```powershell
node "<carpeta del plugin>\dist\wayfinder.mjs" serve
```

- Abre el enlace que imprime, `http://127.0.0.1:4747/?k=…`.
- La clave de ese enlace habilita crear, aprobar y descartar en ese navegador, y cambia en cada arranque. Sin ella, la web es de solo lectura. No compartas el enlace.
- La web solo escucha en este equipo.
- Opciones: `--port <n>` (o `WAYFINDER_PORT`) y `--poll`, para detectar cambios por sondeo en unidades de red. Si el puerto está ocupado por otra aplicación, `serve` lo dice y no arranca.

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

- Abre el enlace que imprime, `http://127.0.0.1:4747/?k=…`: lleva la clave de escritura de ese arranque. Sin la clave, la web es de solo lectura.
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
