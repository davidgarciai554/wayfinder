# Compatibilidad y contratos

> Regla de proyecto. Copia este archivo en `.claude/rules/compatibilidad-y-contratos.md` para aplicarlo a las sesiones de Claude Code del repositorio.

## Propósito y alcance

Aplica esta regla cuando un cambio pueda alterar un contrato consumido fuera de la unidad que se modifica: API, evento, CLI, biblioteca, función o componente reutilizado, formato de archivo, configuración pública, esquema, dato persistido, integración o comportamiento documentado.

Preserva la compatibilidad por defecto. Esta es una regla textual: no descubre consumidores, no ejecuta pruebas, no crea ni autoriza migraciones, no autoriza cambios incompatibles ni demuestra que todos los consumidores sean compatibles. Las instrucciones locales, contratos versionados, reglas por ruta y controles más específicos prevalecen.

## Delimita el contrato antes de cambiar

1. Identifica el contrato afectado, su comportamiento actual, productores, consumidores conocidos, versiones, datos, integraciones y documentación realmente disponibles. Distingue hechos comprobados de consumidores o impactos no verificados.
2. Descubre las garantías existentes: nombres, tipos, estructura, valores por defecto, errores, orden, idempotencia, persistencia, compatibilidad hacia atrás, deprecaciones y expectativas operativas que correspondan. No reduzcas una garantía porque no aparezca en una prueba local.
3. Mantén el contrato y sus semánticas observables salvo que el cambio incompatible esté solicitado y documentado. Prefiere añadir una evolución compatible, adaptación localizada o transición explícita antes que romper consumidores por conveniencia.
4. No infieras que un consumidor está actualizado, que una integración acepta cambios, que un dato histórico es migrable ni que un valor por defecto es seguro sin evidencia. Si falta una decisión material sobre el comportamiento, la compatibilidad o los datos, solicítala antes de implementar.

## Cambios incompatibles y transiciones

Un cambio incompatible requiere una decisión explícita y debe delimitar, como mínimo:

- contrato anterior y nuevo, consumidores conocidos y efecto esperado;
- compatibilidad temporal, versión, adaptación, deprecación o migración que aplique;
- datos, configuración, documentación, ejemplos y pruebas que deben evolucionar;
- reversión, recuperación y efectos persistentes realmente disponibles;
- condiciones que queden sin comprobar y decisión pendiente.

No presentes una migración, eliminación, actualización de consumidores, publicación, cambio de versión, despliegue o modificación de datos persistentes como consecuencia automática de alterar un contrato. Esas acciones siguen `git-y-operaciones-sensibles.md` y requieren la autorización y comprobación que correspondan.

## Validación y cierre

- Aplica `pruebas-y-validacion.md`: valida el comportamiento o contrato afectado y, cuando estén disponibles, los límites, errores, compatibilidad anterior/nueva y consumidores de mayor riesgo. Una prueba de unidad no demuestra por sí sola una integración o consumidor externo.
- Para datos persistidos, identidad, permisos, entradas externas, secretos, red o límites de confianza, aplica también `seguridad-y-datos.md`. No sustituyas integridad, autorización, privacidad o recuperación por una compatibilidad aparente.
- Actualiza la documentación de comportamiento público, transición y límites cuando el contrato deje de ser evidente en el código o cambie de forma intencionada. No documentes consumidores, versiones o resultados no comprobados como hechos.
- Al cerrar, declara contrato y consumidores realmente revisados, estrategia de compatibilidad o transición, validaciones ejecutadas, estado **verificado**, **no aplicable** o **bloqueado/no verificado**, y límites pendientes.

Esta regla no sustituye desarrollo y evidencia, planificación, pruebas y validación, seguridad y datos, Git y operaciones sensibles, documentación específica, auditorías ni controles deterministas del repositorio.
