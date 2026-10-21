# Pruebas y validación

> Regla de proyecto. Copia este archivo en `.claude/rules/pruebas-y-validacion.md` para aplicarlo a las sesiones de Claude Code del repositorio.

## Propósito y precedencia

Selecciona y ejecuta validaciones proporcionales al cambio y comunica resultados reales, límites y bloqueos. Esta es una regla textual: no ejecuta comandos, no crea pruebas, no autoriza acciones ni demuestra por sí sola corrección, seguridad o cobertura.

Las instrucciones locales, reglas por ruta y controles automatizados del repositorio prevalecen cuando sean más específicos.

## Descubrimiento y selección

1. Identifica el comportamiento, contrato, dato, integración o flujo que puede cambiar, y el riesgo de regresión asociado.
2. Descubre las validaciones realmente disponibles: pruebas existentes, comandos declarados, análisis estático, tipos, compilación, revisión funcional/manual, automatización y entornos permitidos.
3. Ejecuta primero la comprobación más específica que cubra el comportamiento afectado; amplía a comprobaciones existentes más generales solo de forma proporcional al riesgo y alcance.
4. No inventes comandos, pruebas, cobertura, herramientas, CI, configuraciones, entornos, datos ni resultados cuando no existan.

Aplica una validación proporcional:

- **Cambio editorial o trivial sin alterar comportamiento observable:** revisa el diff y confirma que no modifica flujo, contrato ni datos; ejecuta una comprobación existente solo si es directamente aplicable y disponible.
- **Cambio de comportamiento o corrección:** valida el flujo o contrato afectado, incluidos los límites y errores pertinentes cuando puedan aplicar.
- **Datos, integración, permisos, archivos, dependencia u operación:** añade comprobaciones acordes al riesgo y deriva a seguridad/datos cuando exista superficie sensible.
- **Interfaz:** aplica las reglas de revisión visual, regresión visual o `/probar-web-playwright` solo cuando el repositorio ya las use o corresponda al cambio; una captura o snapshot no sustituye la verificación funcional/manual necesaria.

## Evidencia, fallos y bloqueos

- Comprueba comportamiento y riesgos, no detalles accidentales de implementación. No cambies pruebas para ocultar un defecto ni desactives controles para obtener un resultado aparente.
- Ante un fallo de compilación, pruebas, análisis o ejecución, consulta `ERRORES.md` si existe. Distingue con evidencia un fallo preexistente, uno introducido/agravado y uno no atribuible; no atribuyas un fallo al cambio sin respaldo.
- Si una validación relevante falla, no declares cierre pleno. Conserva un resumen de salida sin secretos y señala impacto, estado y siguiente comprobación razonable.
- Si una validación no puede ejecutarse, declara qué no se comprobó, qué lo bloquea y la vía razonable para verificarlo. La ausencia de automatización no autoriza a afirmar que se ejecutó.

## Cierre

Antes de declarar terminado un cambio, indica:

- comportamiento, riesgo o contrato comprobado;
- validaciones realmente ejecutadas, método y resultado;
- estado de cada área relevante: **verificado**, **no aplicable** o **bloqueado/no verificado**;
- fallos, desviaciones, evidencia pendiente y límites de la conclusión.

Una prueba, un build, un linter, un snapshot o un comando exitoso no prueban por sí solos toda la experiencia, accesibilidad, seguridad o producción. Esta regla no sustituye desarrollo y evidencia, planificación, revisión de código, auditoría de seguridad/datos, reglas Git/operaciones sensibles ni mecanismos especializados de frontend.
