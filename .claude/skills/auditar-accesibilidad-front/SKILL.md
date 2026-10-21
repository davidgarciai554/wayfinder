---
name: auditar-accesibilidad-front
description: Audita de forma independiente y solo lectura la accesibilidad de una interfaz existente, con evidencia reproducible, prioridades y límites explícitos.
---

# Auditar accesibilidad front

Audita una ruta, flujo, estado o componente frontend ya existente para encontrar barreras de acceso y producir hallazgos priorizados. Úsala para una auditoría puntual e independiente, no para sustituir la planificación o el cierre de un cambio de interfaz.

Se instala sin cambios en `.claude/skills/auditar-accesibilidad-front/` y se invoca como `/auditar-accesibilidad-front`.

Esta skill es **solo lectura**: no edita código, estilos, contenido, configuración, pruebas, tickets ni baselines. No instala herramientas ni genera una certificación. Las herramientas automáticas pueden aportar evidencia, pero no determinan por sí solas la accesibilidad; aplica revisión humana y contextual conforme a la guía de evaluación de W3C.

## Delimita antes de auditar

1. Lee las instrucciones aplicables, `ERRORES.md` si existe, reglas locales, el documento de diseño si existe y la evidencia de revisiones anteriores.
2. Identifica el alcance recibido o pide una delimitación mínima: rutas, flujos, componente, estados, persona/tarea y prioridad de la superficie.
3. Descubre la vía real de ejecución, datos disponibles, cuenta o estado de prueba permitido, tamaños, navegador, zoom, modos de interacción y herramientas ya disponibles. No presupongas framework, comandos, lector de pantalla, navegador, `DESIGN.md`, automatización ni estándares de conformidad.
4. Declara qué vas a comprobar realmente: URL/ruta, viewport, zoom, interacción, estados y evidencia disponible.

Si no hay una vía real para observar el flujo, no infieras accesibilidad desde el código, capturas aisladas o intención de diseño. Marca el alcance como **bloqueado**, especifica qué no se pudo comprobar y la vía necesaria para hacerlo.

## Revisa por flujo y evidencia

Aplica `frontend-visual-review.md` y la sección **Acceso equivalente** de la ficha de revisión visual cuando estén instaladas. No repitas una checklist universal: selecciona las áreas que la interfaz, flujo y estados hagan aplicables.

Para cada área revisada, registra los pasos, lo observado, la evidencia y el límite de la comprobación:

- **Teclado y foco:** alcance, orden y visibilidad del foco; activación, cierre y devolución de foco en overlays; alternativas ante acciones de puntero, hover o gesto.
- **Semántica y mensajes:** propósito/nombre de controles, relación de etiquetas e instrucciones, estructura de contenido, estados, errores, éxito y recuperación comprensibles.
- **Percepción:** contraste, foco y estados distinguibles; información que no dependa solo de color, icono, placeholder, hover o movimiento.
- **Adaptación y contenido:** reflujo, zoom, viewport reducido, texto largo, tablas, formularios, diálogos, sobreflujo y acciones que sigan siendo operables.
- **Táctil y movimiento:** objetivos y separación razonables, alternativa a gestos complejos y comportamiento con movimiento reducido cuando exista movimiento.
- **Estados del flujo:** carga, vacío, error/recuperación, éxito, deshabilitado, selección y validación, cuando existan o puedan reproducirse.

No declares compatibilidad con lectores de pantalla o hardware real sin una prueba documentada con tecnología, navegador, plataforma y flujo concretos. No declares cumplimiento WCAG, certificación ni garantía legal sin el proceso y evidencia específicos que lo sustenten.

## Registra y prioriza hallazgos

Un hallazgo solo es confirmado si contiene evidencia reproducible. Usa este formato:

```md
### A11Y-<número> — P<0-3> — <barrera breve>
- Ubicación: ruta, pantalla, componente o estado.
- Pasos: secuencia reproducible.
- Evidencia: observación, captura, DOM/atributo, medición o configuración realmente usada.
- Impacto: tarea o información afectada y por qué.
- Recomendación mínima: cambio que eliminaría la barrera sin rediseñar por defecto.
- Verificación de cierre: escenario observable para confirmar la corrección.
- Límite: lo que no se comprobó.
```

Prioriza por impacto sobre la tarea, frecuencia del flujo y alcance de reutilización:

| Prioridad | Uso |
| --- | --- |
| P0 | Impide completar una tarea principal, acceder a contenido esencial o recuperar una acción. |
| P1 | Dificulta gravemente una tarea frecuente, aunque exista una alternativa costosa. |
| P2 | Degrada comprensión, eficiencia o robustez sin bloquear la tarea principal. |
| P3 | Mejora no bloqueante de claridad, consistencia o prevención de fricción. |

No asignes prioridad por una regla abstracta: explica el impacto observado. Un defecto de componente compartido puede subir de prioridad por su alcance.

## Entrega de la auditoría

Presenta un informe con:

1. **Cobertura:** rutas, flujos, estados, tamaños, zoom, interacción y entorno realmente revisados.
2. **Resumen:** número de hallazgos por prioridad; riesgos para tareas principales; correcciones de mayor valor.
3. **Hallazgos confirmados:** tabla o secciones con el formato anterior.
4. **Áreas verificadas sin hallazgos observados:** solo dentro del alcance y escenario realmente probados.
5. **No aplicable y bloqueado:** estados/áreas ausentes, evidencia faltante, rutas inaccesibles y pruebas pendientes.
6. **Siguiente paso:** agrupa correcciones pequeñas, problemas de componente compartido y decisiones de producto/diseño pendientes.

La suma de hallazgos del resumen debe coincidir con los hallazgos enumerados. Distingue siempre entre **verificado**, **no aplicable** y **bloqueado/no verificable**.

## Transición sin implementar

- Si la auditoría revela un cambio frontend, remite a `/implementar-front` y al proceso de planes aplicable. La auditoría no autoriza ni realiza la corrección.
- Si la auditoría ocurre durante la planificación de un cambio no trivial, remite también al rol `Accesibilidad-experiencia` y a la mesa redonda; no lo sustituye.
- Si el repositorio ya usa o ha aprobado Playwright, `/probar-web-playwright` puede ayudar a comprobar escenarios repetibles. No lo instales, configures ni trates sus snapshots como evidencia suficiente de acceso equivalente.
- Tras aplicar una corrección, la revisión post-cambio corresponde a `frontend-visual-review.md` y su ficha existente.

## Límites

- No fuerces comprobaciones ceremoniales en una superficie no interactiva: marca con motivo lo que no aplique.
- No inventes rutas, cuentas, datos, comandos, herramientas, resultados ni capacidades de tecnologías asistivas.
- No modifiques `DESIGN.md` ni conviertas una decisión visual en prueba automática de accesibilidad.
- No declares la auditoría completa si hay flujos, estados o contextos materiales sin comprobar; conserva el límite visible.
