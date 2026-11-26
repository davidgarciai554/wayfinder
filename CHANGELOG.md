# Registro de cambios

Los cambios de Wayfinder que nota quien lo usa, agrupados por tema. El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

Aún no hay ninguna versión publicada ni etiquetada: todo lo que sigue se ha distribuido con el número `0.1.0`. Entre paréntesis va la tarea de Wayfinder de cada cambio.

## [Sin publicar]

### Si vienes de una copia anterior

- **Cómo actualizar:** sección «Actualizar el plugin» del [README en español](README.es.md) («Updating the plugin» en el [README en inglés](README.md)). La carpeta de datos (`~/.wayfinder`) no se toca.
- **Marca de formato:** las copias 0.1.0 instaladas antes de la marca `FORMAT` no la leen. Una sesión con una de esas copias puede seguir escribiendo en una carpeta de formato más nuevo; el aviso y el modo de solo lectura solo protegen desde la 1.0.0 (ver «Formato de los datos y actualizaciones» en el [README en español](README.es.md)).
- **Errores descartados:** un plugin anterior, sobre la misma carpeta de datos, los muestra como «ilegibles», sin borrarlos ni cambiarlos, hasta que lo actualices.
- **Bloqueos:** un plugin anterior conserva la clave `blocked` de una tarea, pero no muestra el bloqueo.
- **Historial:** las tareas creadas antes del historial no se migran; lo muestran vacío hasta su primer avance.
- **Tipos de error:** los errores sin tipo, incluidos los anteriores, aparecen como «Sin clasificar».

### Añadido

- Gestor de tareas en Markdown sobre un repositorio git sin remoto: línea de comandos, servidor MCP, hooks, web local, plugin de Claude Code, imagen Docker (WAY-1) y mensajes en español e inglés.
- Historial por tarea y bitácora del día enlazada, con `wf_log`, `wf_history` y `wf_search`.
- Registro de errores ligado a las tareas (`wf_error`), con detector de secretos.
- Instalación desde GitHub, sin registro de paquetes.
- Web desde otros dispositivos de tu red y alta guiada de un repositorio con «registra este proyecto» (WAY-6).
- Tipos de error, errores descartados y reapertura de tareas desde la web (WAY-8, WAY-9, WAY-12).
- Listado de errores con filtros, `wf_errors` (WAY-10), y cambio de la tarea de un error (WAY-11).
- Filtros de prioridad y texto en `wf_list` (WAY-16) y etiquetas en las tareas (WAY-14).
- Aprobación de varios IDs en una orden, dependencias entre tareas y varias tareas por mensaje (WAY-18, WAY-15, WAY-19).
- Aviso a Claude cuando falla un comando de compilación, pruebas o análisis (WAY-17).
- Bloqueo de una tarea con su motivo (WAY-13).
- Versión del formato de los datos (`FORMAT`) y modo de solo lectura ante datos más nuevos que el plugin (WAY-24).
- Este registro de cambios y la sección «Actualizar el plugin» del README (WAY-25).

### Cambiado

- Los listados de tareas usan dos procesos git en total, en lugar de dos por tarea (WAY-23).
- Un solo número de versión para el paquete y el plugin: `npm test` y `npm run check:dist` fallan si `package.json`, `package-lock.json` y `plugin.json` no coinciden (WAY-25).
- Las barreras de la clave de la web y de la carpeta de datos miran también las herramientas del navegador y de la terminal que llevan una dirección, código o un comando, y bloquean la clave escrita en `k=`. Siguen siendo de mejor esfuerzo (WAY-36).
- Los avisos de tareas y subagentes en segundo plano ya no cuentan como órdenes del chat ni borran la última orden; los mensajes de otra sesión sí cuentan. Una tarea programada todavía no se distingue de un mensaje tuyo (WAY-33).
- Para aprobar por chat basta «apruebo», sin ID, justo después de que Claude presente una única propuesta (WAY-33).
- El README pasa a estar en inglés (`README.md`) y en español (`README.es.md`), con secciones nuevas para desinstalar, hacer copia de seguridad y restaurar la carpeta de datos, y la lista de las 14 herramientas MCP. La línea de comandos se instala con `npm pack`, porque `npm install -g github:…` falla con npm 11.17 (WAY-29).

### Corregido

- La aprobación por chat acepta el ID en minúsculas y el verbo «apruebo».
- El aviso de dependencias abiertas sale con un único prefijo «Aviso:» (WAY-15).
