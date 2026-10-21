---
name: revisar-codigo
description: Revisa de forma independiente un cambio de código y su contexto con evidencia, límites y hallazgos accionables; no edita ni certifica calidad global.
---

# Revisar código

Usa `/revisar-codigo [origen-del-cambio] [contexto-opcional]` para revisar un diff, refs, archivos, una ruta de repositorio o un parche pegado. Produce un informe de solo lectura, basado en evidencia, con hallazgos confirmados o un veredicto explícito de «sin hallazgos confirmados dentro de la cobertura declarada».

Instala esta skill en `.claude/skills/revisar-codigo/`. Cuando el proyecto consumidor también tenga `Subagentes/Revisor-codigo.md` y `Plantillas/informe-revision-codigo.md`, úsalos como contrato detallado y formato de salida.

## Límites

- No edites, formatees, instales, configures, crees tickets/baselines, despliegues ni operes con credenciales.
- No presupongas Git, GitHub, PR, CI, lenguaje, framework, comandos, red ni herramientas. Descubre las capacidades disponibles o declara el límite.
- No sustituyas pruebas reales, auditorías de seguridad/datos, accesibilidad/UX, rendimiento o producción.
- No declares calidad total ni ausencia de defectos fuera del material y contexto revisados.
- Un hallazgo no autoriza una corrección: deriva cambios aprobados al proceso de planificación e implementación aplicable.

## Flujo

1. **Delimita el encargo.** Registra objetivo, origen del cambio, base de comparación conocida y material disponible. Si hay Git, inspecciona estado y diff completo, incluidos staged, unstaged, añadidos y borrados. Sin Git o base, revisa solo el parche o archivos entregados y dilo expresamente.
2. **Lee el contexto proporcional.** Consulta instrucciones, símbolos afectados, contratos, llamadores, consumidores, pruebas, fixtures, configuración, documentación y `ERRORES.md` si existe. No infieras comportamiento de ejecución cuando requiere runtime, permisos, datos o una integración no disponibles.
3. **Descubre y usa evidencia real.** Ejecuta solo validaciones seguras, pertinentes y realmente disponibles. Registra sus resultados sin inventarlos ni ocultar bloqueos.
4. **Examina fallos introducidos o agravados.** Busca incompatibilidades, regresiones funcionales, estados límite, recuperación, efectos secundarios, contratos, configuración/documentación y complejidad evitable. Exige ubicación, modo de fallo, evidencia e impacto antes de elevar una observación a hallazgo.
5. **Clasifica y consolida.** Separa hallazgos confirmados, observaciones/hipótesis, no aplicable y bloqueado/no verificable. Agrupa síntomas por causa demostrada y diferencia problemas preexistentes de los introducidos o agravados.
6. **Deriva superficies especializadas.** Si hay autenticación, permisos, entradas externas, APIs, secretos, datos personales, archivos, dependencias, red, pagos u operaciones destructivas, declara si necesita auditoría de seguridad y datos. No la sustituyas.
7. **Entrega un informe verificable.** Usa `Plantillas/informe-revision-codigo.md` si está instalada. Para cada hallazgo confirmado incluye identificador `CR-<número>`, P0–P3, ubicación, cambio/contexto, evidencia, precondiciones y modo de fallo, resultado esperado/observado, impacto, alcance/confianza, corrección mínima, verificación de cierre y límites.

## Reglas de decisión

- Una sospecha sin condición de fallo, impacto o evidencia suficiente es una observación, no un defecto confirmado.
- P0 requiere pérdida/corrupción de datos, bypass de autorización, exposición sensible, operación destructiva no recuperable o bloqueo demostrado de una función esencial. P3 requiere coste de mantenimiento concreto y una alternativa mínima; no es una etiqueta de estilo.
- Si no hay hallazgos confirmados, declara la cobertura, las validaciones realizadas, áreas no aplicables, bloqueos y límites. «Sin hallazgos» no significa «correcto» ni sustituye una auditoría especializada.
- Si te piden corregir durante la revisión, no edites: entrega el hallazgo y remite al flujo de planificación/implementación aplicable.

## Cierre

Antes de finalizar, confirma que:

- el informe distingue evidencia observada de hipótesis, no aplicable y bloqueos;
- el conteo P0–P3 coincide con los hallazgos enumerados;
- no declaras ejecución, reproducción o cobertura no logradas;
- el alcance y las exclusiones son explícitos;
- las correcciones sugeridas describen un resultado mínimo, no un stack, herramienta o rediseño impuesto.
