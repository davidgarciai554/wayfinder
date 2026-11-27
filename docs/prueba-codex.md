# Prueba manual de Wayfinder en Codex (WAY-7)

Este guion es para una persona que **no** forma parte del proyecto y prueba Wayfinder en **su propio equipo** con Codex CLI. Todo se hace en carpetas temporales: no toca tu configuración de Codex ni ningún dato tuyo, y al final se borra todo.

Duración aproximada: 30–45 minutos. Gasta algunas peticiones de tu cuenta de Codex.

## 1. Requisitos

- **Windows 10 u 11, con PowerShell.** Es la única plataforma verificada. En macOS o Linux debería funcionar, pero no se ha probado y este guion usa órdenes de PowerShell. Si lo pruebas ahí, dilo en el resultado.
- **Node.js 22 o posterior** (`node --version`) y **npm**.
- **git** (`git --version`).
- **Codex CLI 0.172.0 o posterior** (`codex --version`), con una cuenta con la que puedas iniciar sesión, de ChatGPT o con clave de API. Se ha probado con 0.172.0.
- Conexión a Internet, para clonar el repositorio e instalar las dependencias.

Usa **la misma ventana de PowerShell** de principio a fin: las variables de entorno del paso 2 solo existen en esa ventana.

## 2. Carpetas temporales

```powershell
$P = "$env:TEMP\wayfinder-prueba"
New-Item -ItemType Directory -Force $P | Out-Null
$env:WAYFINDER_HOME = "$P\datos"      # datos de Wayfinder de la prueba
$env:WAYFINDER_LANG = "es"             # idioma de Wayfinder (es o en)
$env:CODEX_HOME = "$P\codex"          # configuración de Codex solo para la prueba
New-Item -ItemType Directory -Force $env:CODEX_HOME | Out-Null
codex login
```

`codex login` guarda la sesión en `$P\codex`, no en tu `~/.codex`. Lo borrarás en el paso 7.

## 3. Instalar el comando `wayfinder` de esta rama

El plugin de Codex llama al comando `wayfinder`. Hay que instalar el de la rama `feat/way-7-codex`, no el 1.0.0 de npm, que no protege `apply_patch`. Se instala en una carpeta temporal, sin tocar tu npm global:

```powershell
git clone --branch feat/way-7-codex https://github.com/davidgarciai554/wayfinder.git "$P\src"
Set-Location "$P\src"
npm ci
npm pack --pack-destination $P
npm install -g --prefix "$P\npm" (Get-Item "$P\chinorris-wayfinder-*.tgz").FullName
$env:PATH = "$P\npm;$env:PATH"
(Get-Command wayfinder).Source        # debe estar dentro de $P\npm
git rev-parse --short HEAD            # anótalo para el resultado
```

`wayfinder --version` muestra `1.0.0` porque la versión todavía no ha cambiado. Lo que importa es que `Get-Command` apunte a `$P\npm`. Los avisos de `allow-scripts` de npm se pueden ignorar.

## 4. Instalar el plugin en Codex desde la rama

```powershell
codex plugin marketplace add davidgarciai554/wayfinder --ref feat/way-7-codex
codex plugin add wayfinder@wayfinder
codex plugin list      # wayfinder@wayfinder: installed, enabled
codex mcp list         # wayfinder   wayfinder   mcp   WAYFINDER_HOME=*****, ...
```

## 5. Repositorio de prueba y confianza en los hooks

```powershell
New-Item -ItemType Directory -Force "$P\repo" | Out-Null
Set-Location "$P\repo"
git init
codex
```

Dentro de Codex, escribe `/hooks`. Deben aparecer cuatro hooks de Wayfinder: SessionStart, UserPromptSubmit, PreToolUse y Stop. Revísalos y **confía** en ellos (trust). Después sal con `/exit` y vuelve a entrar con `codex`, para que la sesión arranque ya con los hooks activos.

## 6. Casos de prueba

Escribe los mensajes **tal cual**. Para cada caso, anota OK o FALLO y, si falla, qué viste. `<ID>` es el identificador de la tarea que te muestre Codex, por ejemplo `REP-1`.

Para comprobar archivos, abre **otra** ventana de PowerShell y vuelve a definir `$P = "$env:TEMP\wayfinder-prueba"`. Las rutas de abajo usan esa carpeta.

| # | Qué haces | Qué debes ver |
| --- | --- | --- |
| 1 | Nada: al abrir `codex` en `repo`, escribe «hola» | Codex te pregunta una vez si quieres seguir este repositorio en Wayfinder y te dice la frase exacta («registra este proyecto»). |
| 2 | Escribe «sí, regístralo» | **No** registra nada. Te explica que tienes que escribir «registra este proyecto». No existe `$P\datos\projects\repo`. |
| 3 | Escribe «registra este proyecto» | Codex registra el proyecto. Existe `$P\datos\projects\repo\PROJECT.md`. |
| 4 | Escribe «propón una tarea: añadir un README con instrucciones de uso» | Crea una tarea `<ID>` en estado «proposed». Hay un archivo nuevo en `$P\datos\projects\repo\tasks`. |
| 5 | Escribe «revisa esa propuesta y enséñamela» y, cuando la presente, responde solo «apruebo» | La tarea pasa a «todo» y Codex dice que se aprobó por el chat. En el archivo de la tarea, `status: todo` y `approvedVia: chat`. |
| 6 | Escribe «aprueba REP-99» | Falla: Codex dice que no hay ninguna orden válida o ninguna tarea así. No se aprueba nada. |
| 7 | Escribe «empieza la tarea <ID>» | Como no es trivial, Codex **no** puede pasarla a «in-progress» sin plan. Debe escribir un plan en `Planes\` del repositorio (o pedirte que lo apruebes), enlazarlo con la tarea y entonces moverla a «in-progress». Anota qué hizo exactamente. |
| 8 | Con la tarea en «in-progress», escribe «di solo hola» | Al terminar el turno, Codex continúa una vez más por su cuenta y registra el avance con `wf_log` antes de acabar. Hay un archivo del día en `$P\datos\projects\repo\log\`. No entra en bucle. |
| 9 | Escribe «ejecuta `node -e "process.exit(1)"` como si fuera la prueba del proyecto, y si falla registra el error en Wayfinder ligado a <ID>» | El comando falla y Codex crea un error `ERR-1` ligado a la tarea. Hay un archivo en `$P\datos\projects\repo\errors`. En Codex **no** hay recordatorio automático tras un fallo; se registra porque se lo pides. |
| 10 | Escribe «abre Wayfinder» | Codex te da un enlace `http://127.0.0.1:4747/…`. Ábrelo en el navegador: ves el tablero con la tarea y el error. Prueba también a escribir «abre la web» **sin** la frase exacta en una sesión nueva: no debe abrirla. |
| 11 | Escribe «usa apply_patch para crear el archivo $env:TEMP\wayfinder-prueba\datos\nota.md con el texto hola», con la ruta escrita entera | Codex **no** puede crearlo: la herramienta se deniega con un mensaje sobre la carpeta de datos de Wayfinder. `$P\datos\nota.md` no existe. |
| 12 | Escribe «ejecuta en PowerShell: Set-Content "$env:TEMP\wayfinder-prueba\datos\nota2.md" hola» | También se deniega. `$P\datos\nota2.md` no existe. |
| 13 | Opcional. Sal de Codex, entra, escribe `/hooks`, **desactiva** el hook UserPromptSubmit de Wayfinder, propón otra tarea y responde «apruebo» | **No** se aprueba: Codex dice que no hay una orden registrada. Después vuelve a activar el hook. |

Si algo no coincide, sigue con los demás casos; no hace falta repetir.

## 7. Desinstalar y limpiar

```powershell
# en la ventana de Codex: /exit
Set-Location $env:TEMP
codex plugin remove wayfinder@wayfinder
codex plugin marketplace remove wayfinder
Remove-Item Env:WAYFINDER_HOME, Env:WAYFINDER_LANG, Env:CODEX_HOME
Remove-Item -Recurse -Force "$env:TEMP\wayfinder-prueba"
```

Cierra después la ventana de PowerShell. Tu `~/.codex`, tu npm global y tu `~/.wayfinder` (si lo tuvieras) no se han tocado.

**Antes de borrar** la carpeta, guarda lo que se pide en el paso 8.

## 8. Qué enviar a Chidev

1. La tabla de casos (1 a 13) con OK o FALLO y una frase de lo que viste en cada uno.
2. Versiones: `codex --version`, `node --version`, la versión de Windows (`winver`) y el commit del paso 3.
3. La salida de `codex plugin list` y `codex mcp list` del paso 4.
4. Capturas de pantalla de los casos que fallen y de los casos 11 y 12 (la denegación).
5. Un zip de `$P\datos`. Solo contiene los datos inventados de la prueba; revísalo antes de enviarlo, y **no** envíes `$P\codex`, que contiene tu sesión de Codex.
