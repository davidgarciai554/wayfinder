# Wayfinder

Gestor de tareas personal en Markdown que Claude Code usa como "Jira personal" y como memoria de cada proyecto.

- Claude consulta lo pendiente, propone ideas, mueve estados y escribe la bitácora.
- Tú sobre todo miras, creas tareas y apruebas o descartas ideas, desde la web local o pidiéndoselo a Claude en el chat.

Los datos viven en una carpeta privada (`~/.wayfinder`): un repositorio git **sin remoto** con un commit por cada escritura. Nada de Wayfinder se guarda en `.claude/`, `AGENTS.md` ni `CLAUDE.md` de tus proyectos.

## Requisitos

- Windows 11 (es la única plataforma verificada).
- Node.js 22 o superior y git.
- Claude Code 2.1.271 o superior, para el plugin.

## Instalación del plugin de Claude Code

Desde una copia local de este repositorio:

```powershell
claude plugin marketplace add D:\ruta\a\wayfinder
claude plugin install wayfinder@wayfinder --config language=es
```

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
   - Antes de terminar, si hay tareas en curso, Claude escribe la bitácora del día.
   - Las tareas no triviales necesitan un plan en `Planes/` antes de pasar a «En curso».

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

## Paquete npm

Cuando esté publicado (aún no lo está), los mismos comandos estarán disponibles con `npx`:

```powershell
npx @davidgarciai554/wayfinder@0.1.0 init
npx @davidgarciai554/wayfinder@0.1.0 serve
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

La imagen sirve la web local y, como variante, el servidor MCP por stdio. Los ejemplos son para PowerShell en Windows con Docker Desktop. Construcción:

```powershell
docker build -t wayfinder:dev .
```

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
