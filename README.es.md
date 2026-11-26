[English](README.md) | Español

# Wayfinder

Gestor de tareas personal en Markdown que Claude Code usa como "Jira personal" y como memoria de cada proyecto.

- Claude consulta lo pendiente, propone ideas, mueve estados y registra cada avance en el historial de la tarea; la bitácora del día enlaza a esos avances.
- Tú sobre todo miras, creas tareas y apruebas o descartas ideas, desde la web local o pidiéndoselo a Claude en el chat.

Los datos viven en una carpeta privada (`~/.wayfinder`): un repositorio git **sin remoto** con un commit por cada escritura. Nada de Wayfinder se guarda en `.claude/`, `AGENTS.md` ni `CLAUDE.md` de tus proyectos.

## Requisitos

- Windows 11 (es la única plataforma verificada).
- Node.js 22 o superior y git.
- Claude Code 2.1.271 o superior, para el plugin. La instalación con un solo comando está probada con Claude Code 2.1.318; instalar, actualizar y desinstalar como se explica abajo, con Claude Code 2.1.332.

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

Puedes cambiarlas después con `/plugin` o con `claude plugin configure wayfinder@wayfinder`.

### Primer uso

1. En el repositorio que quieras seguir, escribe tú en el chat: «registra este proyecto» (o «register this project»).
   - Tiene que ser esa frase, escrita por ti: un «sí» no basta. Así Claude no puede registrar un repositorio por su cuenta.
   - La orden vale 15 minutos y para un solo registro.
   - Si aún no existe la carpeta de datos (`~/.wayfinder`), se crea en ese momento. Ya no hace falta `wayfinder init`, aunque sigue disponible.
2. Si no quieres seguir un repositorio, díselo a Claude: lo anota y Wayfinder deja de preguntar en él. Puedes registrarlo más adelante con la misma frase.
3. A partir de ahí, cada sesión empieza con la lista de pendientes y las propuestas sin aprobar.
   - Claude mueve los estados mientras trabaja.
   - Cada avance queda en el historial de la tarea y en una línea de la bitácora que enlaza a él (ver «[Historial y memoria](#historial-y-memoria)»).
   - Antes de terminar, si hay tareas en curso y hoy no se ha registrado ningún avance, Claude lo registra.
   - Las tareas no triviales necesitan un plan en `Planes/` antes de pasar a «En curso».

## Actualizar el plugin

Cada paso dice si está comprobado con Wayfinder o si solo lo dice la documentación de Claude Code. Lo comprobado se probó con Claude Code 2.1.322, con el plugin instalado desde una copia local del repositorio.

1. **Mira qué tienes instalado.** `claude plugin list --json` muestra, para `wayfinder@wayfinder`:
   - `version`: la versión que Claude Code tiene registrada.
   - De dónde se carga: si aparece `readFromFolder`, de esa carpeta tuya; si no, de la copia en caché de `installPath`.
   - `folderVersion`: la versión que dice esa carpeta. Si no coincide con `version`, hay una actualización por registrar.

   `node "<esa carpeta>\dist\wayfinder.mjs" --version` imprime la versión del programa. *Comprobado.*
2. **Si lo instalaste desde una copia local del repositorio, actualiza antes esa copia** (`git pull`). Claude Code carga el plugin directamente de la carpeta: el código nuevo entra en la siguiente sesión aunque el número de versión no haya cambiado. *Comprobado.*
3. **Actualiza el plugin:**

   ```powershell
   claude plugin marketplace update wayfinder
   claude plugin update wayfinder@wayfinder
   ```

   - **Desde una copia local.** *Comprobado, en ese orden.* Sin cambio de número responde «nothing to update» y «already at the latest version». Con cambio de número, por ejemplo «updated from 0.1.0 to 1.0.0», y `version` pasa a ser la nueva (*comprobado de 0.1.0 a 1.0.0 con Claude Code 2.1.332*).
   - **Desde GitHub** (copia en caché por versión). Sin cambio de número responde «already at the latest version (0.1.0)» (*comprobado con Claude Code 2.1.332*). Lo que sigue lo dice la documentación de Claude Code y aún no se ha comprobado con Wayfinder desde GitHub (el salto de 0.1.0 a 1.0.0 se comprobó desde una copia local): Claude Code solo trae una copia nueva cuando cambia el número de versión del plugin. «already at the latest version» significa que tienes la última versión numerada, no necesariamente los últimos cambios del repositorio: mientras el número no cambie, una copia instalada desde GitHub no cambia.
4. **Reinicia las sesiones de Claude abiertas.** Una sesión en marcha sigue con el servidor anterior y no muestra las funciones nuevas. `claude plugin update` lo avisa: «Restart to apply changes» (*comprobado*). Claude Code dice que `/reload-plugins` también lo aplica sin cerrar la sesión (*sin comprobar*).

Qué se conserva:

- **Tus datos.** La carpeta de datos (`~/.wayfinder`, o la que pusieras en `home`) está fuera del plugin y de su caché. *Comprobado: `claude plugin update` no escribió nada en la carpeta configurada en `home`.*
- **Tus opciones** (`language`, `home`, `capturesDir`, `webHost`). Claude Code las guarda en sus ajustes, fuera del plugin. *Comprobado: `claude plugin update` conservó `language` y `home`.* Desinstalar sí las borra (ver «[Desinstalar](#desinstalar)»), y para actualizar no hace falta desinstalar.

Si después de actualizar aparece el aviso de solo lectura, mira «[Formato de los datos y actualizaciones](#formato-de-los-datos-y-actualizaciones)». Lo que cambia entre versiones está en [CHANGELOG.md](CHANGELOG.md). Sin el plugin o con Docker, repite la instalación de su sección («[Línea de comandos sin el plugin](#línea-de-comandos-sin-el-plugin)», «[Docker](#docker)»).

## Desinstalar

Comprobado con Claude Code 2.1.332 y el plugin instalado desde GitHub.

1. Cierra las sesiones de Claude Code abiertas. Una sesión en marcha sigue usando el plugin, y la web que abrió, hasta que termina.
2. Desinstala el plugin y quita el marketplace:

   ```powershell
   claude plugin uninstall wayfinder@wayfinder
   claude plugin marketplace remove wayfinder
   ```

   Después, `claude plugin list` ya no muestra `wayfinder@wayfinder`.

Qué se borra y qué queda:

- **Se borran** el plugin, el marketplace y **tus opciones** (`language`, `home`, `capturesDir`, `webHost`). Si vuelves a instalarlo, ponlas otra vez con `--config` o con `claude plugin configure wayfinder@wayfinder`.
- **Queda tu carpeta de datos** (`~/.wayfinder`, o la que pusieras en `home`), con tus tareas, bitácoras, errores y capturas. Desinstalar no la toca: si vuelves a instalar Wayfinder con la misma carpeta, lo encuentras todo.
- La copia del plugin en caché queda en `~/.claude\plugins\cache\wayfinder`, marcada como huérfana (`.orphaned_at`). No la usa nada; puedes borrar esa carpeta.
- Si creaste la regla del cortafuegos de «[Web](#web)», sigue ahí. Para quitarla, en PowerShell como administrador: `Remove-NetFirewallRule -DisplayName "Wayfinder (Node) - red privada"`. *Sin comprobar: necesita permisos de administrador.*
- Para borrar también tus datos, haz antes una copia (ver «[Copia de seguridad y restauración](#copia-de-seguridad-y-restauración)») y borra la carpeta. No se puede deshacer:

  ```powershell
  Remove-Item -Recurse -Force "$env:USERPROFILE\.wayfinder"
  ```

Sin el plugin o con Docker, mira cómo se quitan en sus secciones: «[Línea de comandos sin el plugin](#línea-de-comandos-sin-el-plugin)» y «[Docker](#docker)».

## Copia de seguridad y restauración

La carpeta de datos (`~/.wayfinder`, o la que pusieras en `home`) es un repositorio git sin remoto. Wayfinder nunca la sube a ningún sitio, así que la copia es cosa tuya. Contiene:

- `projects\`: tus tareas, bitácoras, errores y capturas.
- `config.json` y `FORMAT`: los ajustes y la versión del formato.
- `.state\`: datos de poca duración que no van en git, como las órdenes del chat de los últimos 15 minutos y los repositorios en los que dijiste que no.

Antes de copiar o restaurar, cierra las sesiones de Claude Code (y con ellas la web) y `wayfinder serve`, para no copiar a mitad de una escritura.

Copia la carpeta entera, `.git` incluida (la carpeta de destino de la copia, aquí `D:\copias`, tiene que existir):

```powershell
Copy-Item -Recurse -Force "$env:USERPROFILE\.wayfinder" "D:\copias\wayfinder-2026-11-26"
```

Para restaurarla, la carpeta de destino no puede existir. Si existe, apártala antes:

```powershell
Rename-Item "$env:USERPROFILE\.wayfinder" ".wayfinder-anterior"
Copy-Item -Recurse -Force "D:\copias\wayfinder-2026-11-26" "$env:USERPROFILE\.wayfinder"
```

Para comprobar la restauración, `git -C "$env:USERPROFILE\.wayfinder" log --oneline -3` muestra los mismos últimos commits que la copia, y la web muestra tus proyectos y tareas.

No uses `git clone` ni `git bundle` para restaurar: el resultado pierde `.state\` y, en Windows, git vuelve a escribir los archivos con finales de línea CRLF, así que Wayfinder marca todas las tareas como «modificada fuera de Wayfinder».

## Uso diario

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
- Las tareas creadas con una copia 0.1.0 anterior al historial no se migran: muestran el historial vacío hasta su primer avance.

### Registro de errores

Cuando algo falla (compilación, pruebas, análisis, ejecución o un comportamiento inesperado), Claude lo registra con `wf_error`, ligado a la tarea en la que trabaja. Es el equivalente, dentro de Wayfinder, del `ERRORES.md` que piden las instrucciones base.

- **Un archivo por error:** `projects/<slug>/errors/ERR-n-<título>.md`, con contexto, reproducción, salida observada, causa (hipótesis o confirmada), solución, validación, resultado y archivos. Estado abierto, resuelto o descartado.
- **Tipo (opcional):** compilación (`build`), pruebas (`test`), análisis (`analysis`: lint, tipos), ejecución (`runtime`), comportamiento inesperado (`behavior`) o entorno (`environment`: puertos, permisos, configuración, dependencias). Se puede poner al crear el error o después con `update`. Los errores sin tipo, incluidos los registrados con una copia 0.1.0 anterior a los tipos, aparecen como «Sin clasificar». El prefijo `ERR` está reservado: ningún proyecto nuevo puede usarlo.
- **Acciones:** `create` (necesita la tarea, que debe existir, y el contexto), `update` (tipo, causa, solución, validación, resultado y archivos; también reabrir con una nota), `note` (una recurrencia o una corrección), `resolve` (exige solución y validación) y `discard` (cierra sin solución una falsa alarma o un fallo que no se va a corregir; exige una nota con el motivo, y Claude te lo dice). Un error resuelto o descartado se reabre con `update`, `reopen` y una nota. El contexto, la reproducción, la salida y el título no se cambian: se corrigen con una nota.
- **Cambiar la tarea:** un error registrado en la tarea equivocada se pasa a otra tarea del proyecto con `update`, `task_id` y una nota obligatoria con el motivo, en cualquier estado. El historial del error conserva dónde se registró y añade «Task: WAY-3 -> WAY-5.» con la nota. Cada error sigue ligado a una sola tarea.
- **Antes de investigar:** `wf_search` muestra primero hasta 5 errores, y al crear uno Claude ve los posibles duplicados abiertos. Si es el mismo fallo, añade una nota en lugar de crear otro.
- **Aviso automático:** cuando un comando de compilación, pruebas o análisis termina con error (por ejemplo `npm test`, `npm run build`, `tsc`, `pytest`, `cargo test` o `dotnet build`, también dentro de `cd x && …`), un hook del plugin (`PostToolUseFailure`) recuerda a Claude buscar el fallo con `wf_search` y registrarlo con `wf_error` si es nuevo e inesperado. Solo avisa: no crea nada, no bloquea, no repite el comando ni su salida y solo actúa en proyectos registrados. Avisa en cada fallo, también en los esperados (una prueba escrita antes del código), y el texto le dice a Claude que entonces lo ignore.
- **Para Claude:** `wf_get ERR-n` da el error completo y `wf_get` de una tarea lista sus errores. Al empezar la sesión recibe hasta 5 errores abiertos (solo ID, tarea, tipo y título) y un recuento por tipo, si caben.
- **Listar errores:** `wf_errors` (solo lectura) lista los errores del proyecto, los actualizados más recientemente primero y como mucho 50, con ID, estado, tipo, tarea y título. Por defecto solo los abiertos. Filtra por estado (`status`: `open`, `resolved`, `discarded`), tipo (`kind`: los seis tipos o `unclassified`) y tarea (`task_id`, que debe existir); los filtros se combinan. Un error con un estado que tu versión de Wayfinder no conoce no sale al filtrar: se ve con `wf_get`, `wf_search` y la web.
- **En la web:** pestaña «Errores» con abiertos, resueltos y descartados (con el motivo en sus notas), cada grupo dividido en secciones por tipo con su recuento; una página por error y la sección «Errores (n)» en cada tarea. Solo lectura.
- **Versiones anteriores:** una copia 0.1.0 anterior a los errores descartados, si usa la misma carpeta de datos, muestra esos errores como «ilegibles» (sin borrarlos ni cambiarlos) hasta que la actualices. Desde la 1.0.0, un estado que Wayfinder no conozca se muestra tal cual y no se puede cambiar.
- **Secretos:** un campo que parece contener un secreto se rechaza y no se guarda nada. El detector es heurístico y no reconoce datos personales (por ejemplo, carpetas de usuario o correos): resume la salida en vez de pegarla entera.
- El texto de los errores se trata como dato no confiable, igual que el de las tareas.

### Listar tareas

`wf_list` lista hasta 200 tareas; por defecto, las pendientes, en curso y propuestas. Filtra por estado (`status`), prioridad (`priority`: `low`, `medium`, `high`), etiqueta (`tag`: las tareas con alguna de las etiquetas pedidas) y texto del título (`query`: literal, sin distinguir mayúsculas); los filtros se combinan. Si hay más coincidencias, termina con «… y N tareas más».

### Etiquetas

Una tarea puede tener hasta 10 etiquetas libres para agruparla por área (`web`, `mcp`, `hooks`, `docs`…). Las pone Claude con `wf_create` o `wf_update` y `tags`; la lista se sustituye entera y `[]` la vacía.

- Formato: minúsculas, cifras y guiones, hasta 30 caracteres y sin espacios. Una etiqueta fuera de ese formato se rechaza con un mensaje claro; no se convierte.
- Se ven en `wf_get` (`tags:`), en `wf_list` (`#web` tras el título) y en la web, en la tarjeta y en la cabecera del detalle.
- En el tablero, el selector «Etiqueta» muestra solo las tareas con esa etiqueta y lo dice en un aviso con el botón «Quitar filtro». La elección se recuerda en ese navegador para cada proyecto.
- Desde la web no se ponen ni se quitan. Una etiqueta escrita a mano con otro formato se ignora al leer, y se conserva en el archivo mientras nadie cambie las etiquetas de esa tarea.

### Dependencias entre tareas

Una tarea puede depender de otras del mismo proyecto («WAY-7 depende de WAY-2»). Las escribe Claude con `wf_update` y `depends_on`; la lista se sustituye entera y `[]` la vacía.

- Se rechaza sin guardar nada una tarea que no existe en el proyecto, la propia tarea, un ID repetido, más de 20 dependencias o un ciclo.
- Solo una tarea hecha libera a las que dependen de ella. Una dependencia descartada sigue bloqueando hasta que alguien la quite; una que no existe no bloquea.
- Es información para planificar: nunca impide un cambio de estado. Al empezar una tarea con dependencias sin hacer, Claude recibe un aviso.
- Se ven en `wf_get`, en `wf_list` («bloqueada por WAY-n») y en la web: la etiqueta «Bloqueada por WAY-n» en la tarjeta y la fila «Depende de» en el detalle. Desde la web no se editan.

### Bloquear una tarea

Cuando una tarea no puede avanzar por algo que no es otra tarea (espera una decisión tuya, una credencial o un servicio externo), Claude la marca como bloqueada con su motivo: `wf_log` con `blocked: true` y el motivo en `blockers`. Si lo que espera es otra tarea, se usa una dependencia.

- Solo se bloquean tareas «por hacer» o «en curso». El motivo es una línea de hasta 200 caracteres; el detalle va en la entrada del historial, que se guarda en el mismo paso.
- No es un estado: la tarea sigue donde estaba. El bloqueo es información y nunca impide un cambio de estado.
- Se desbloquea con `wf_log` y `blocked: false`; la entrada es la nota que dice qué la desbloqueó. Pasar la tarea a hecha o descartada, o reabrirla, también quita el bloqueo.
- `blockers` sin `blocked` sigue siendo texto libre de esa entrada: ni bloquea la tarea ni cambia el motivo.
- Se ve en `wf_list` («bloqueada: motivo»), en `wf_get` y en la web, con la etiqueta «Bloqueada» y el motivo en la tarjeta y en el detalle. En la lista de tareas que Claude recibe al empezar la sesión aparece solo la marca `[bloqueada]`; el motivo lo lee cuando lo necesita.
- Desde la web no se bloquea ni se desbloquea: díselo a Claude.
- **Versiones anteriores:** el bloqueo se guarda como una clave opcional (`blocked`) en el archivo de la tarea. Un plugin anterior que use la misma carpeta de datos lee la tarea con normalidad y conserva la clave, pero no muestra el bloqueo.

### Pedir varias tareas a la vez

Si pides una sola tarea, Claude la hace en el mismo chat. Si pides varias por su ID («haz WAY-3, WAY-5 y WAY-7»):

- Claude reúne las tareas que nombras y las dependencias abiertas que las bloquean, nada más. Si una de esas dependencias es una propuesta, se detiene y te pide aprobarla.
- Antes de empezar te dice el reparto. Las tareas independientes van cada una a su propia sesión, en su propio worktree si tocan código. Las que dependen unas de otras van en una sola sesión, primero la que libera.
- En Claude Code Desktop abre esas sesiones. En la terminal no puede, así que te lo dice y las hace todas en el mismo chat, en ese orden.
- El bucle no aprueba nada. Cada tarea no trivial sigue necesitando su plan aprobado. Si falta el plan o algo falla, se para y te dice qué necesita.

### Reabrir una tarea

Una tarea hecha o descartada se reabre solo desde la web, con el botón «Reabrir» y un motivo obligatorio, que queda en el historial de la tarea y en la bitácora.

- Vuelve a «Por hacer» si es tuya o si se aprobó. Una propuesta de Claude que nadie aprobó vuelve a «Propuestas» y hay que aprobarla de nuevo (por chat, con una revisión nueva).
- Claude no puede reabrir tareas: si hace falta, te pide que lo hagas en la web.

### Aprobar ideas desde el chat

Escribe la orden con el ID, por ejemplo «aprueba WAY-4». Para varias a la vez, un verbo y la lista: «aprueba WAY-4, WAY-5 y WAY-6» o «apruebo las tres tareas WAY-4, WAY-5 y WAY-6».

- Entre «aprueba», «apruebo» o «approve» y el primer ID caben hasta 3 palabras. Con «haz», «empieza», «do» o «start», hasta 2, para que una petición de trabajo como «haz un resumen de WAY-4» no cuente como orden. Los IDs se separan con comas, «y», «e» o «and».
- La lista termina en cualquier otra cosa: «aprueba WAY-4 pero no WAY-5» solo aprueba WAY-4. No se admiten rangos («WAY-4 a WAY-6») ni IDs separados solo por espacios.
- Con más de 10 IDs en un mensaje no cuenta ninguno.
- Sin ID basta un mensaje que solo diga «apruebo», «Sí, apruébala» o «approve», justo después de que Claude te presente una propuesta: vale para la única propuesta que haya revisado en los últimos 15 minutos. Si ha revisado más de una, o ninguna, no se aprueba nada y Claude te pide el ID. «apruebo el plan» o «apruebo, pero cambia el título» no aprueban ninguna tarea.
- Una negación antes de la lista, una pregunta, una cita (`>`) o un bloque de código anulan la orden. Cada propuesta pasa por su propia revisión.

1. Claude revisa la propuesta antes de aprobarla.
2. Si ve algo sospechoso (instrucciones ocultas, peticiones de secretos, comandos de red…), te explica el motivo y no la aprueba hasta que repitas la orden, por ejemplo «aprueba WAY-4 igualmente».
3. Solo se aprueban por chat las propuestas creadas por Claude, y quedan marcadas como «Aprobada por chat».

## Web

Escribe en el chat **«abre Wayfinder»** (o «open Wayfinder»). Como en el registro, tiene que ser esa frase, escrita por ti: un «sí» no basta.

- Claude abre la web para esa sesión y te da una dirección de este PC, por ejemplo `http://127.0.0.1:4747/`. Ábrela en el navegador del PC.
- Si la web se abre también en la red (opción `webHost`), Claude te da además el enlace para el móvil, que se abre con un toque. Si usas Claude desde el móvil (Remote Control), púlsalo ahí mismo.
- En esa página:
  - **«Activar la escritura en este PC»** habilita crear, aprobar, descartar y reabrir en ese navegador.
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
  - Si otra sesión de Claude ya usa el puerto 4747, la web se abre en otro puerto libre, con su propia clave. La regla del cortafuegos de arriba solo abre el 4747, así que en ese caso el móvil no podrá conectar; Claude te avisa al darte el enlace. Cierra la web de la otra sesión (o esa sesión) y vuelve a escribir «abre Wayfinder».

Para desarrollo o Docker sigue existiendo `wayfinder serve`:

```powershell
node "<carpeta del plugin>\dist\wayfinder.mjs" serve
```

- Imprime un enlace con clave, `http://127.0.0.1:4747/?k=…`, que también cambia en cada arranque. Sin la clave, en este equipo la web es de solo lectura.
- Opciones:
  - `--port <n>` (o `WAYFINDER_PORT`): el puerto. Si está ocupado por otra aplicación, `serve` lo dice y no arranca.
  - `--poll`: detecta los cambios por sondeo, para unidades de red.

## Herramientas MCP

El plugin da a Claude estas 14 herramientas. No las usas tú: se lo pides a Claude en el chat. Lo que leen de tareas, errores, historiales y bitácora se trata como dato no confiable.

| Herramienta | Para qué sirve |
| --- | --- |
| `wf_project` | `get`: el proyecto del repositorio actual y el idioma en que responder. `register`: registra el repositorio, solo después de que escribas «registra este proyecto». `decline`: anota que no quieres seguir ese repositorio. |
| `wf_web` | `start`, `status` y `stop` de la web de la sesión (ver «[Web](#web)»). `start` solo funciona después de que escribas «abre Wayfinder». |
| `wf_list` | Lista tareas, con filtros (ver «[Listar tareas](#listar-tareas)»). |
| `wf_get` | Lee una tarea, con la lista de sus errores, o un error `ERR-n`. |
| `wf_create` | Crea una tarea, siempre como propuesta que tienes que aprobar. |
| `wf_review` | Revisa una propuesta antes de aprobarla y devuelve sus señales de riesgo. Claude te da su veredicto. |
| `wf_set_status` | Cambia el estado. De propuesta a «por hacer», solo con tu orden en el último mensaje y después de `wf_review` (ver «[Aprobar ideas desde el chat](#aprobar-ideas-desde-el-chat)»). A «en curso», con un plan en `Planes/` o marcada como trivial con una nota. |
| `wf_update` | Cambia el título, la prioridad, el plan, la descripción, las dependencias (`depends_on`) o las etiquetas (`tags`). Nunca el estado ni el historial. |
| `wf_log` | Registra un avance en el historial de la tarea y en la bitácora del día. También bloquea y desbloquea (ver «[Bloquear una tarea](#bloquear-una-tarea)»). |
| `wf_history` | El índice del historial de una tarea, una entrada completa o la línea temporal de los últimos días (7 por defecto). |
| `wf_search` | Busca texto literal en errores, tareas, historiales y bitácora. |
| `wf_error` | Crea, actualiza, anota, resuelve o descarta un error (ver «[Registro de errores](#registro-de-errores)»). |
| `wf_errors` | Lista los errores del proyecto, con filtros. Solo lectura. |
| `wf_attach` | Adjunta una captura (png, jpg, webp o gif, hasta 10 MB) del repositorio actual o de `capturesDir`, con una descripción obligatoria. |

## Línea de comandos sin el plugin

El paquete está publicado en npm como `@chinorris/wayfinder`:

```powershell
npm install -g @chinorris/wayfinder
wayfinder init
wayfinder serve
```

- **Actualizar:** `npm install -g @chinorris/wayfinder@latest`.
- **Desde una copia del repositorio** (por ejemplo, para probar cambios sin publicar): `git clone https://github.com/davidgarciai554/wayfinder.git` y, en esa carpeta, `npm ci`, `npm pack` y `npm install -g .\chinorris-wayfinder-<versión>.tgz`. `npm install -g github:davidgarciai554/wayfinder` no sirve: con npm 11.17 falla al construir el paquete («Cannot find package 'esbuild'»).
- **Desinstalar:** `npm uninstall -g @chinorris/wayfinder`. La carpeta de datos no se toca.

El paquete incluye un único archivo `dist/wayfinder.mjs` sin dependencias, la web y `THIRD_PARTY_NOTICES.md` con las licencias de las bibliotecas que lleva dentro.

## Formato de los datos y actualizaciones

La carpeta de datos lleva en su raíz un archivo `FORMAT` con un único número entero: la versión del formato de los datos (hoy, `1`). Lo escribe la carpeta al crearse. Una carpeta creada antes de que existiera no lo tiene y cuenta como formato 1; Wayfinder no lo añade por su cuenta, porque abrir la carpeta nunca escribe nada.

- **Datos más nuevos que el plugin.** Si `FORMAT` dice un número mayor del que entiende tu versión (por ejemplo, una sesión de Claude que sigue con el plugin con el que arrancó, o una imagen de Docker antigua sobre la misma carpeta):
  - Claude recibe un aviso al empezar la sesión y al final de cada respuesta de las herramientas `wf_*`; la web lo muestra bajo la barra superior.
  - La carpeta queda **en solo lectura**: se puede leer todo, pero no se guarda nada (tareas, avances, errores, capturas ni las órdenes «registra este proyecto» o «abre Wayfinder»). La web oculta sus botones aunque tengas la clave.
  - Para salir: reinicia la sesión de Claude o actualiza Wayfinder (ver «[Actualizar el plugin](#actualizar-el-plugin)»); en Docker, reconstruye la imagen. Si la marca fuera errónea, restáurala desde el historial git de la carpeta de datos o borra `FORMAT` (vuelve a formato 1). No hay ninguna opción para saltarse el bloqueo.
  - La marca se lee en cada operación, así que un proceso que ya estaba en marcha se entera sin reiniciarse. La web lo muestra en el siguiente refresco o navegación (como mucho, unos 30 segundos).
- **Marca que no se entiende** (vacía, texto, un número no válido): se avisa, se trata como formato 1 y se sigue trabajando.
- **Estados nuevos.** Una tarea con un estado que tu versión no conoce se muestra con ese estado tal cual (en la web, en la sección «Otros estados») y no se puede cambiar; las tareas que dependen de ella siguen bloqueadas. Los errores ya funcionaban así.
- **Qué cambios admite la 1.x sin subir la marca:** claves o campos opcionales nuevos, valores nuevos de estado (de tareas o de errores) y tipos de entrada nuevos. Una versión que no los entiende los conserva, los muestra y no los sobrescribe.
- **Qué obliga a subir la marca (y a una 2.0):** renombrar o quitar un campo, cambiar su significado, mover la estructura de carpetas, o añadir valores a la prioridad o al origen de las tareas (una versión anterior los leería como `medium` o `user` y los perdería al reescribir la tarea). La marca es siempre un único entero decimal. `test/format.test.ts` fija la versión y esos valores, pero no detecta renombres ni cambios de significado: la regla hay que aplicarla al revisar.
- **Versiones anteriores:** las copias 0.1.0 anteriores a la marca `FORMAT` no la leen. Una sesión con una de esas copias puede seguir escribiendo en una carpeta de formato más nuevo; el aviso solo protege desde la 1.0.0.

## Seguridad y privacidad

- Nunca guardes secretos ni datos personales en tareas, bitácoras o capturas. Wayfinder rechaza los patrones de secreto más comunes, pero es una ayuda, no una garantía.
- Mantén la carpeta de datos privada y sin remoto. Wayfinder nunca hace `push`.
- El contenido de las tareas se trata como datos no confiables: Claude no sigue instrucciones escritas dentro de ellas.
- Para registrar un repositorio, aprobar una propuesta o abrir la web hacen falta tus propias palabras en el chat: «registra este proyecto», «aprueba WAY-n» (o «apruebo» tras la revisión), «abre Wayfinder». El hook las detecta en tu mensaje, así que un «sí», o el texto de una tarea que Claude lea, no bastan.
  - Es una protección de mejor esfuerzo, como el detector de secretos.
  - Claude Code también lanza turnos que no escribes tú. Los avisos de tareas y subagentes en segundo plano no cuentan como orden. Una tarea programada (`/loop` o una tarea de Claude) llega como texto normal y Wayfinder no la distingue de un mensaje tuyo: no programes tareas con «aprueba WAY-n» y similares.
  - Un mensaje que otra sesión de Claude Code envía a esta cuenta como tuyo, para que la sesión principal pueda reenviar tus órdenes a otra. Por eso, cualquier sesión que pueda escribir a esta (las de tu PC y, con Remote Control, las de otros equipos) puede dar una orden en tu nombre. La revisión de la propuesta y la segunda confirmación ante señales sospechosas siguen aplicándose.
  - Un Claude manipulado que pueda ejecutar comandos podría saltársela escribiendo directamente en el estado de Wayfinder. Y cuando la web se abre en la red, Claude recibe el enlace con la clave para dártelo, así que también podría usarlo para escribir o aprobar desde la web. La skill le prohíbe usarlo, pero eso no es una barrera técnica.
  - Siguen dos barreras de mejor esfuerzo: la página local solo entrega la clave a peticiones del propio navegador, y el hook bloquea las llamadas que la piden o la llevan en `k=`. El hook mira los comandos de Bash y PowerShell y, en el navegador integrado de Claude Code, en Claude in Chrome y en la terminal MCP, las herramientas que llevan una dirección, código o un comando (`navigate`, `preview_start`, `javascript_tool`, `browser_batch` y `run_in_terminal`). No mira las demás herramientas del navegador, como `computer`, que pulsa en una pestaña ya abierta, ni puede con un código que oculte lo que pide. Tampoco impiden que Claude conozca la clave cuando la web está en la red.
  - Si trabajas con permisos automáticos, revisa qué comandos ejecuta.
  - Un texto ajeno que pegues sin citar (`>`) ni poner en un bloque de código cuenta como tuyo.
- Si la web solo se abre en este PC, Claude recibe la dirección sin la clave. Si se abre en la red, recibe también el enlace para otros dispositivos, que lleva la clave y queda en el historial de la conversación hasta que esa clave caduca al cerrar la sesión. Cualquier programa de tu PC puede leer la página local, igual que puede leer tu carpeta de datos.
- Fuera de tu PC la web pide la clave para todo y va sin cifrar: úsala en tu red de casa o con Tailscale, y no compartas el enlace.

## Accesibilidad

La web se auditó en noviembre de 2026 (WAY-28) y se corrigieron sus ocho hallazgos: el enlace «Saltar al contenido», el selector de proyecto que conserva el foco, un título de página por vista, el foco que vuelve al error que abriste, los niveles de encabezado de la página del proyecto, `lang="en"` en las etiquetas guardadas en inglés dentro de la interfaz en español, objetivos táctiles de 44 px en el móvil y el recuento de tareas hechas.

- **Comprobado** con Chromium (Playwright) en Windows, en español y en inglés: los flujos principales con teclado, el contraste en modo claro y oscuro, el reflujo a 320 px, el zoom emulado al 200 %, el espaciado de texto, los nombres y roles, los diálogos y el movimiento reducido. `e2e/a11y.spec.ts` cubre las correcciones.
- **Sin comprobar:** lectores de pantalla (NVDA u otros), el modo de alto contraste de Windows, el zoom real del navegador, Firefox, Edge y Safari, y dispositivos táctiles reales.

## Desarrollo

```powershell
npm ci
npm run typecheck
npm test              # unitarios e integración (construye antes)
npm run test:e2e      # Playwright
npm run test:docker   # requiere Docker Desktop y la imagen wayfinder:dev
npm run check:dist    # dist/ y plugin/dist/ al día; git sin subcomandos de red; una sola versión
npm run test:acceptance  # recorrido de publicación en carpetas temporales; requiere la CLI claude (docs/aceptacion-1.0.md)
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

### Quitar la imagen

```powershell
docker image rm wayfinder:dev
```

La carpeta de datos montada en `/data` no se toca. *Sin comprobar: el motor de Docker no estaba en marcha al escribir esta sección.*

### Verificación

```powershell
npm run test:docker
```

Construye antes la imagen `wayfinder:dev`. La prueba necesita el motor de Docker en marcha.
