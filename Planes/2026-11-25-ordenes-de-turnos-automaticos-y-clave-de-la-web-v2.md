# Plan: Órdenes del chat en turnos automáticos y barreras de la clave de la web ampliadas (WAY-33 y WAY-36, opción C) — v2

> Estado: aprobado el 2026-11-25 (la persona, a través del Captain: «apruebo el plan»)
> Versión: v2
> Fecha: 2026-11-25. Plan anterior: `Planes/2026-11-25-ordenes-de-turnos-automaticos-y-clave-de-la-web.md`, versión v1, aprobado el 2026-11-25. Este borrador solo contiene lo que cambia respecto a v1; todo lo demás de v1 (contexto, evidencia, incremento 1 «sonda», incremento 2 «WAY-36 opción C», D2, D5 a D7, riesgos y reversión) sigue vigente sin cambios.
> Motivo: respuesta de la persona a P2 de v1: «si debe de contar y no hace falta que sea muy exigente al decir apruebo WAY-3 con decir apruebo deberia se servir». Dos cambios materiales: (1) un mensaje de otra sesión (reenvío de la sesión principal a una hija) **cuenta** como orden; (2) un «apruebo» sin ID también debe servir.
> Rama de destino: `main`.

## Qué cambia respecto a v1

### Alcance
- Incluido además: aprobación con un mensaje que solo dice «apruebo» (sin ID), en `src/store/mentions.ts`, `src/hook.ts` (rama `prompt`) y `src/store/approve.ts` (la cita sin ID), con sus pruebas y textos i18n; en la skill, una regla para reenviar aprobaciones.
- Sin cambios: incrementos 1 y 2 de v1. El caso (f) de la sonda pasa a ser de regresión (el reenvío debe registrar la orden).

### Decisiones nuevas o sustituidas
| Decisión | Evidencia y motivo | Alternativas descartadas | Riesgo o consecuencia |
| --- | --- | --- | --- |
| D1' (sustituye a D1). WAY-33 solo descarta los turnos que **no vienen de una persona ni de otra sesión**: las notificaciones de tareas y subagentes en segundo plano (`<task-notification>`) y las tareas programadas y `/loop` (`<scheduled-task`). Los mensajes entre sesiones (`Another Claude session sent a message:` / `<cross-session-message`) cuentan como hoy. La lista exacta sale de la sonda (R1 de v1, adaptada). | Decisión de la persona (P2). Confirma la lectura del Captain: siguen sin contar las notificaciones de tareas o subagentes y las tareas programadas. Ninguna de esas dos fuentes la escribe la persona ni la reenvía: son textos que genera un agente o un temporizador. | Filtrar también los mensajes entre sesiones (recomendación de v1, rechazada por la persona). | **Riesgo aceptado por la persona, a documentar:** cualquier sesión de Claude Code que pueda enviar mensajes a esta (las de este PC y, con Remote Control, las de otros equipos) puede dar una orden en su nombre; un agente manipulado en otra sesión puede fabricar «aprueba WAY-n». Siguen la revisión con hash y la segunda confirmación con señales. |
| D3' (amplía D3). Un turno descartado no toca las órdenes vigentes. Un mensaje de otra sesión se trata como un mensaje de la persona: reemplaza las órdenes anteriores, igual que hoy. | Coherencia: si cuenta como orden, también cuenta como «último mensaje». | — | Ninguno nuevo. |
| D4' (sustituye a D4). El aviso fijo para Claude se emite cuando un turno **descartado** contiene una orden reconocible, y también cuando un «apruebo» sin ID no se puede resolver (D10). | Sin aviso, la sesión no sabe por qué falla la aprobación. | Silencio. | Dos textos i18n. |
| D9 (nueva). «Apruebo» sin ID cuenta solo si **el mensaje entero** es una frase corta de aprobación: un verbo de aprobación (`aprueba`, `apruebo`, `apruébala`, `apruebala`, `aprobada`, `approve`, `approved`, `i approve`), opcionalmente precedido de `sí`/`si`/`ok`/`vale`/`yes` y seguido de `la`, `esa`, `esta`, `la propuesta`, `it`, `this`, signos de puntuación o un emoji. Sin negación, sin pregunta. En un mensaje de otra sesión se evalúa el texto del mensaje sin el envoltorio. | La persona quiere no tener que escribir el ID. Exigir el mensaje entero evita que «apruebo el plan v1» (aprobación de un plan, no de una tarea) o una frase larga apruebe una propuesta. | Buscar «apruebo» en cualquier parte del mensaje: aprobaría con frases que hablan de otra cosa. | Un «apruebo, pero cambia el título» no aprueba nada (no es el mensaje entero): la persona debe decirlo por separado. Queda documentado. |
| D10 (nueva). Un «apruebo» sin ID se aplica a **la única propuesta que Claude ha revisado con `wf_review` en ese proyecto en los últimos 15 minutos** y que sigue en `proposed`. Si hay cero o más de una, no se registra ninguna orden y el hook avisa a Claude para que pida el ID. | `wf_review` es el acto explícito de presentar una propuesta a la persona y ya queda guardado por proyecto (`src/store/review.ts`, `reviews.json`, con marca de tiempo). Es lo único que el hook puede leer de forma fiable; no ve el historial de la sesión (transcripción asíncrona). 15 minutos es el mismo plazo que las órdenes (`ORDER_TTL_MS`). | «La única propuesta pendiente del proyecto» (hoy hay diez propuestas pendientes en el propio tablero de Wayfinder: casi nunca sería única). «La última propuesta mencionada en la sesión» (el hook no tiene el historial de la sesión). | Dos sesiones que revisan propuestas distintas del mismo proyecto en el mismo cuarto de hora hacen que «apruebo» sea ambiguo: se pide el ID, que es el lado seguro. |
| D11 (nueva). La aprobación sin ID sigue pasando por `approveByChat` con las mismas comprobaciones (orden vigente y sin consumir, revisión con hash vigente, segunda confirmación con señales). La orden guarda que fue sin ID; solo en ese caso `approveByChat` acepta una cita que no nombra el ID, y la cita debe ser la propia frase corta de D9. El historial y la bitácora guardan la cita tal cual («apruebo»). | Mantiene un único camino de aprobación y no relaja la regla de la cita para las órdenes con ID. | Que el hook escriba la cita o que Claude cite el ID en lugar de las palabras de la persona (falsearía la cita). | Cambio en `mentions.ts` (un campo más en la orden, compatible con el formato actual de `.state`) y en `approve.ts`. |
| D12 (nueva). Skill: al reenviar una aprobación a otra sesión, la sesión principal escribe «aprueba <ID>» literal en el mensaje (un «apruebo» suelto dentro de un mensaje largo no cuenta, D9). La regla de la l.65 sobre los briefs se mantiene. | Hace que el flujo diario de la persona (reenvío a hijas) funcione con certeza. | — | Ninguno. |

### Preguntas para la persona
Ninguna bloqueante. Solo confirmar dos límites:
- Con D10, «apruebo» sin ID funciona justo después de que Claude te presente una propuesta (o la vuelva a revisar). Si en ese cuarto de hora se revisó más de una, Claude te pedirá el ID.
- Con D1', una sesión de Claude Code que pueda escribir a esta puede aprobar en tu nombre (riesgo aceptado en tu respuesta; el README lo dirá).

### Incremento 3 (sustituye a los pasos 5 y 6 de v1)
5'. Reglas de decisión tras la sonda:
   - **R1'.** El `prompt` de (c) y (e) tiene una línea que empieza por un envoltorio reconocible, y el de (a), (b), (d) y (f) no tiene ninguno de esos dos: se implementa el paso 6' con los envoltorios observados.
   - **R2'.** Sin envoltorio, pero con un campo de entrada presente en (c) y (e) y ausente en (a), (b), (d), (f) y en una sesión con `--agent`: se usa ese campo.
   - **R3'.** Indistinguible: el filtro de WAY-33 no se implementa; README y skill dicen el límite. D9 a D12 se implementan igualmente.
   - El caso (g) (brief de una sesión nueva) queda como límite escrito si no tiene envoltorio, como en v1.
6'. `src/hook.ts`, rama `prompt` (`:334-336` y `:359-363`):
   - Turno descartado (D1'): no se llama a `recordOrders`, `recordRegistration` ni `recordWebOpening`; aviso de D4' si contiene una orden.
   - Resto: como hoy. Además, si `extractOrders` no encuentra IDs y el mensaje (o el cuerpo de un mensaje de otra sesión) es una aprobación corta (D9), se resuelve el destino con D10. Con destino único, se registra la orden marcada como «sin ID». Sin destino, no se registra nada y se emite el aviso de D4'.
   - `src/store/mentions.ts`: la función que reconoce la frase corta (exportada para `approve.ts`) y el campo de la orden sin ID. `src/store/review.ts`: una lectura de las revisiones del proyecto con su marca de tiempo (sin cambiar lo que guarda). `src/store/approve.ts`: la excepción de la cita de D11.
   - Validación (pruebas en `test/hook.test.ts`, `test/chat.test.ts` y, si cubre `wf_set_status` por chat, `test/mcp.integration.test.ts`):
     - Regresión: «aprueba CO-1» escrito registra; aprobar con cita que nombra el ID sigue igual.
     - `<task-notification>` y `<scheduled-task` con «aprueba CO-1», «registra este proyecto» o «abre Wayfinder» no registran nada, no borran la orden previa y emiten el aviso.
     - Un mensaje de otra sesión con «aprueba CO-1» registra la orden.
     - «apruebo», «Sí, apruébala.», «approve» con una única revisión reciente de una propuesta registran la orden sin ID para esa tarea, y `approveByChat` la aprueba con la cita «apruebo».
     - «apruebo» con cero revisiones recientes, con dos, con una revisión de más de 15 minutos o de una tarea que ya no está en `proposed`: ninguna orden y aviso.
     - «apruebo el plan v1», «no apruebo», «¿apruebo?», «apruebo, pero cambia el título»: ninguna orden.
     - Una cita sin ID con una orden **con** ID sigue rechazada (`chat.invalidQuote`).
     - Con señales en la revisión, la aprobación sin ID sigue exigiendo la segunda confirmación (una orden posterior a la revisión).
7'. `README.md` («Seguridad y privacidad» y la parte de aprobar por chat), `plugin/skills/wayfinder/SKILL.md` (l.24, l.60, l.65 y la regla de D12) y `CHANGELOG.md` («Sin publicar»): aprobar con «apruebo» tras la presentación, qué turnos no cuentan, que los mensajes de otras sesiones sí cuentan y su riesgo, y el alcance de mejor esfuerzo de las barreras de la clave (de v1).
   - Validación: leer el diff y comprobar que no afirma nada que el código o la sonda no muestren.
8. Sin cambios respecto a v1 (validación amplia).

### Criterios de aceptación (sustituyen a los de WAY-33 de v1; los de WAY-36 no cambian)
- [ ] «aprueba WAY-n», «registra este proyecto» y «abre Wayfinder» escritos por la persona, o reenviados desde otra sesión, siguen funcionando.
- [ ] «apruebo» solo, tras presentar una única propuesta con `wf_review` en los últimos 15 minutos, la aprueba con las mismas comprobaciones de hoy y guarda la cita tal cual.
- [ ] «apruebo» ambiguo o sin propuesta revisada no aprueba nada y Claude pide el ID.
- [ ] Con R1' o R2': un aviso de tarea o subagente en segundo plano y una tarea programada no registran órdenes, no borran las vigentes y dejan un aviso fijo.
- [ ] Con R3': el README y la skill dicen el límite observado.
- [ ] README, skill y CHANGELOG describen el riesgo aceptado de los mensajes entre sesiones.
- [ ] `plugin/dist/` reconstruido; `npm run typecheck`, `npm test` (salvo la prueba conocida `test/server.test.ts:139`) y `npm run check:dist` en verde.

### Riesgos nuevos
- Riesgo: una sesión manipulada en este PC aprueba por mensaje. Aceptado por la persona; mitigado por la revisión con hash y la segunda confirmación, y documentado.
- Riesgo: «apruebo» aprueba una propuesta distinta de la que la persona tiene en mente (por ejemplo, Claude revisó otra sin decirlo). Mitigación: solo con una única revisión reciente; la skill ya obliga a llamar a `wf_review` antes de aprobar (`SKILL.md:60` y `:74`), y el historial guarda la cita y el ID aprobado.
- Reversión: como en v1.
