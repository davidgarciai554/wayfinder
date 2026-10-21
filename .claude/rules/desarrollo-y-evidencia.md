# Desarrollo y evidencia

> Regla de proyecto. Copia este archivo en `.claude/rules/desarrollo-y-evidencia.md` para aplicarlo a las sesiones de Claude Code del repositorio.

## Propósito y precedencia

Aplica la solución más pequeña que cubra los requisitos explícitos y comunica únicamente afirmaciones respaldadas por evidencia disponible. Esta es una regla textual: no ejecuta comandos, no bloquea acciones, no autoriza operaciones ni demuestra por sí sola que un cambio sea correcto o seguro.

Las instrucciones locales, las reglas por ruta y los controles automatizados del repositorio prevalecen cuando sean más específicos.

## Antes de cambiar

1. Lee las instrucciones, documentación, configuración y contexto aplicables al área afectada.
2. Delimita el resultado esperado, la superficie afectada y los requisitos explícitos.
3. Distingue entre **hechos comprobados**, **supuestos**, **decisiones pendientes**, **evidencia insuficiente** y **bloqueos**.
4. Descubre primero los patrones, comportamientos, configuraciones, dependencias y capacidades que ya existen en el repositorio.
5. Si falta una decisión que cambie comportamiento, alcance, datos, seguridad o experiencia, solicita esa decisión concreta antes de implementarla. No la sustituyas por una suposición razonable.

## Solución mínima y compatible

Detente en la primera alternativa que satisfaga todos los requisitos explícitos:

1. No cambiar si la necesidad es especulativa o el comportamiento ya está cubierto.
2. Reutilizar una capacidad, patrón o dependencia existente.
3. Usar una capacidad nativa o de biblioteca estándar disponible.
4. Usar una dependencia ya instalada.
5. Escribir la implementación nueva más pequeña, clara y verificable.

Mantén el cambio limitado al objetivo y respeta la arquitectura, interfaces y convenciones existentes, salvo una decisión explícita que indique lo contrario. Corrige la causa raíz; no ocultes síntomas.

No introduzcas dependencias, capas, abstracciones, configuraciones ni flexibilidad para necesidades hipotéticas. Si una simplificación deja un límite conocido, documenta brevemente el límite y la condición concreta que justificaría evolucionarla.

## Evidencia y cierre

- Descubre la comprobación más específica que el repositorio permita para el comportamiento afectado y amplíala de forma proporcional al riesgo. No inventes comandos, resultados, cobertura, entornos, datos ni herramientas.
- Una descripción del código, una intención o una prueba no ejecutada no sustituyen la evidencia real cuando el comportamiento requiere validación.
- Si una comprobación no puede realizarse, declara qué queda sin verificar, qué lo bloquea y la vía razonable para comprobarlo; no afirmes éxito por ausencia de evidencia contraria.
- Al cerrar, informa qué se cambió, qué comportamiento se comprobó, con qué evidencia y resultado, y qué parte permanece no verificada o bloqueada.

## Límites

Esta regla no sustituye el proceso de planificación, la estrategia de pruebas, la auditoría de seguridad y datos, las reglas Git/operaciones sensibles, las revisiones especializadas ni los controles deterministas. Para una tarea de consulta o exploración sin cambio, aplica la honestidad sobre evidencia, pero no exige validar un cambio inexistente.
