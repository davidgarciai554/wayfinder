---
name: auditar-deuda-visual
description: Audita de forma independiente y solo lectura la deuda visual de una interfaz existente, con hallazgos trazables, prioridades y límites explícitos.
---

# Auditar deuda visual

Audita una ruta, flujo, estado, pantalla o conjunto acotado de componentes frontend ya existentes para convertir incoherencias acumuladas en hallazgos visuales reproducibles y priorizados. Úsala para legado, preparación de prioridades o una revisión independiente; no como checklist tras cada cambio reciente.

Se instala sin cambios en `.claude/skills/auditar-deuda-visual/` y se invoca como `/auditar-deuda-visual`.

Esta skill es **solo lectura**: no edita código, estilos, contenido, `DESIGN.md`, tokens, componentes, pruebas, snapshots, tickets, baselines ni configuración. No instala herramientas, no crea sistemas paralelos ni certifica calidad visual.

## Delimita antes de auditar

1. Lee las instrucciones aplicables, `ERRORES.md` si existe, reglas locales, revisiones anteriores y el documento de diseño si existe.
2. Identifica el alcance: rutas, flujos, pantallas, componentes, estados, tareas y prioridades reales. Si se solicita «toda la aplicación», propone un conjunto representativo y declara lo excluido; no afirmes cobertura completa sin ella.
3. Descubre la vía real de ejecución, datos permitidos, tamaños/viewport, modo de color, contenido disponible, tokens, tema, componentes, pruebas y baselines existentes. No presupongas framework, comandos, navegador, `DESIGN.md`, Playwright ni catálogo de componentes.
4. Registra qué observarás realmente: entorno, rutas, estados, tamaños, datos y evidencia disponible.

Si no existe una vía real para observar la superficie, márcala como **bloqueada**. Indica qué no se pudo comprobar y la vía necesaria; no deduzcas deuda desde código, una captura aislada o una preferencia estética.

Si falta `DESIGN.md`, un contrato de tokens o un inventario de componentes, registra la ausencia como una **brecha de gobernanza**. Puedes comparar incoherencias observables entre superficies equivalentes, pero no inventes una dirección visual para convertirlas en defectos.

## Busca divergencias comprobables

Consulta las reglas de diseño, tokens/componentes y revisión visual existentes. Selecciona solamente las categorías aplicables a la superficie auditada:

- **Diseño y jerarquía:** contradicción con una decisión aprobada, acciones sin prioridad clara, agrupación, densidad o composición que impidan comprender o completar la tarea.
- **Sistema visual:** roles semánticos, tipografía, espacio, forma, profundidad, capas o movimiento aplicados de manera inconsistente; valores locales que duplican decisiones reutilizables.
- **Componentes y variantes:** componentes equivalentes divergentes, variantes sin propósito, consumidores que contradicen el contrato, o estados omitidos en una capacidad compartida.
- **Estados y contenido:** carga, vacío, error/recuperación, éxito, deshabilitado, permisos, contenido largo, sobreflujo o datos densos que rompan jerarquía, orientación o continuidad.
- **Responsive e interacción:** composición, navegación, acciones, filtros, overlays y prioridades que se vuelvan inconsistentes o inoperables entre tamaños y contextos.
- **Acceso equivalente con impacto visual sistémico:** si la barrera principal es teclado, foco, semántica, contraste o movimiento, remite a `/auditar-accesibilidad-front`; no dupliques su auditoría especializada.

En una superficie estática o no interactiva, revisa únicamente composición, contenido, responsive y estados que existan; marca el resto como **no aplicable** con motivo en lugar de forzar una auditoría ceremonial.

Una diferencia es deuda confirmada solo si tiene una divergencia respecto a un contrato aplicable, una inconsistencia observable entre casos equivalentes o un impacto demostrable en comprensión, confianza, acceso, tarea o mantenibilidad. Separa siempre:

- **Hallazgo confirmado:** evidencia reproducible y criterio o impacto claro.
- **Observación/hipótesis:** señal de confianza media o baja que necesita decisión de producto/diseño; no la presentes como defecto.
- **No aplicable:** categoría/estado inexistente dentro del alcance, con motivo.
- **Bloqueado/no verificable:** faltan ruta, datos, entorno, estado o evidencia; especifica cómo verificarlo.

## Registra, agrupa y prioriza

Usa este formato para cada hallazgo confirmado:

```md
### DV-<número> — S<0-3> — <resumen breve>
- Categoría y causa probable: diseño | token | componente | implementación local | contenido/estado | responsive.
- Ubicación: ruta, pantalla, componente, estado y tamaños afectados.
- Pasos: secuencia reproducible.
- Evidencia: observación en ejecución, captura, revisión de token/componente, comparación o baseline ya existente.
- Contrato o inconsistencia: decisión de `DESIGN.md`, regla, token/componente o casos equivalentes observados.
- Impacto: tarea, comprensión, confianza, acceso o mantenimiento afectado.
- Alcance y confianza: consumidores/muestras conocidos; alta, media o baja, con motivo.
- Recomendación mínima: resultado que debe lograrse, sin imponer un rediseño por defecto.
- Verificación de cierre: escenario observable que confirmará la corrección.
- Límite: contexto, estado o evidencia no comprobados.
```

Prioriza por impacto antes que por apariencia:

| Severidad | Uso |
| --- | --- |
| S0 | Bloquea una tarea principal, información crítica o acceso equivalente. |
| S1 | Provoca error, exclusión o pérdida de confianza relevante en una tarea frecuente/importante. |
| S2 | Introduce fricción, inconsistencia o riesgo moderado con alternativa disponible. |
| S3 | Deuda localizada no bloqueante, con riesgo de propagación o coste futuro. |

Considera severidad × frecuencia × superficie afectada × reutilización × facilidad/riesgo de corrección. Un defecto repetido de token o componente se registra como **un hallazgo raíz** con muestras y consumidores conocidos, no como una lista inflada de píxeles. Recomienda primero una corrección local; un cambio de contrato compartido exige consumidores demostrados y planificación aprobada.

## Entrega de la auditoría

Presenta:

1. **Cobertura y límites:** rutas, flujos, estados, tamaños, datos, entorno y evidencia realmente revisados; exclusiones y bloqueos.
2. **Resumen priorizado:** conteo coherente de S0–S3, riesgos para tareas principales, brechas de gobernanza y hasta cinco correcciones de mayor valor.
3. **Hallazgos confirmados:** en el formato anterior, agrupados por causa raíz cuando corresponda.
4. **Observaciones y no hallazgos:** hipótesis pendientes y áreas revisadas sin hallazgos observados, siempre con su alcance.
5. **Siguiente paso:** correcciones locales, problemas compartidos que requieren plan, decisiones de diseño/producto y pruebas/revisión necesarias.

No trates una diferencia de píxeles, una referencia externa o «parece genérico» como una conclusión. Declara el criterio, impacto o inconsistencia que permite elevarla a hallazgo.

## Transición sin implementar

- Si la auditoría se solicita sobre un cambio recién implementado, usa o remite primero a `frontend-visual-review.md` y su ficha: esa es la revisión post-cambio requerida.
- Para corregir un hallazgo aprobado, remite al proceso de planes y a `/implementar-front`; la auditoría no autoriza ni realiza modificaciones.
- Si existe Playwright o regresión visual aprobada, `/probar-web-playwright` puede aportar evidencia de escenarios estables. No lo instales, configures, uses para generar baselines ni confundas un snapshot con calidad de experiencia.
- Si el hallazgo es principalmente una barrera de acceso, enlaza o deriva a `/auditar-accesibilidad-front` y conserva solo el impacto visual sistémico pertinente.

## Límites

- No propone una refactorización masiva, un tema nuevo, una biblioteca de componentes, tokens nuevos o un cambio de identidad como respuesta predeterminada.
- No penaliza una variación deliberada entre contextos distintos si está documentada o responde a una necesidad funcional.
- No reemplaza `DESIGN.md`, las reglas existentes, auditorías de accesibilidad, pruebas, revisión manual ni hardware real.
- No declara que una aplicación está «sin deuda visual» si quedan flujos, estados, tamaños o contextos materiales fuera de cobertura.
