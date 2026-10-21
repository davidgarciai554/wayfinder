# Seguridad y datos

> Regla de proyecto. Copia este archivo en `.claude/rules/seguridad-y-datos.md` para aplicarlo a las sesiones de Claude Code del repositorio.

## Propósito y precedencia

Aplica esta regla cuando un cambio pueda afectar identidad, permisos, entradas externas, APIs o red, secretos, datos personales o sensibles, archivos o persistencia, dependencias, pagos u operaciones destructivas. Es una regla textual preventiva: no ejecuta controles, no autoriza acciones, no certifica seguridad o conformidad ni prueba ausencia de vulnerabilidades.

Las instrucciones locales, reglas por ruta, políticas organizativas y controles deterministas más específicos prevalecen.

## Delimita y preserva la superficie

1. Identifica la superficie realmente afectada, activo o dato, actores, entradas/salidas y límite de confianza; si no hay superficie sensible aplicable, declara esa cobertura limitada.
2. Antes de añadir, relajar, sustituir o retirar un control, descubre los contratos y controles existentes: permisos, propiedad, validación, manejo de fallos, registro, protección de datos, persistencia, recuperación y límites operativos que correspondan.
3. Conserva o restablece el control mínimo aplicable. La simplicidad, una compatibilidad aparente, una prueba exitosa o la urgencia no justifican degradar autorización, validación de entradas, integridad, recuperación, tratamiento de errores o protección de datos.
4. No sustituyas por una suposición una decisión que altere permisos, exposición, retención, irreversibilidad, recuperación o aceptación de riesgo. Solicita la decisión explícita cuando no esté definida.

No inventes amenazas, controles, requisitos regulatorios, configuraciones, datos, cuentas, permisos, resultados ni comportamiento de producción.

## Secretos, datos y acceso permitido

- No solicites, copies, muestres, registres, versionas ni uses como atajo secretos, credenciales, tokens, claves privadas, sesiones, datos personales o contenido sensible. Ante una exposición, describe solo tipo, ubicación y alcance, sin reproducir valores.
- No eludas ni intentes eludir autenticación, autorización, permisos, cuentas, restricciones de red, controles de producción o límites de acceso. Si falta acceso permitido, datos seguros, entorno o evidencia, declara qué no se pudo comprobar y la vía mínima segura para retomarlo.
- Usa datos, entornos y acceso expresamente permitidos. Una evidencia, log, salida o error debe sanearse antes de comunicarse o registrarse.

## Validación, derivación y cierre

- Selecciona validaciones proporcionales según `pruebas-y-validacion.md`; una comprobación exitosa no demuestra por sí sola seguridad, privacidad, permisos, integridad ni comportamiento de producción.
- Para una **propuesta** con superficie sensible, activa `Subagentes/Seguridad-datos.md` durante la planificación. Para una superficie existente o cambio sensible que requiera revisión independiente, usa `/auditar-seguridad-datos`.
- Un riesgo, alerta o hallazgo no autoriza una corrección, despliegue, migración, cambio de permisos ni aceptación de riesgo. Sigue el flujo aprobado y las reglas específicas de pruebas, Git y operaciones sensibles cuando correspondan.

Antes de cerrar, declara:

- superficie, activos/datos, controles y cobertura realmente revisados;
- validaciones ejecutadas y resultado saneado;
- estado: **verificado**, **no aplicable** o **bloqueado/no verificado**;
- decisión pendiente, derivación, riesgo, límite o evidencia que no permite una conclusión más amplia.

Esta regla no sustituye desarrollo y evidencia, planificación, pruebas y validación, revisión de código, auditoría de seguridad/datos, reglas Git/operaciones sensibles ni controles específicos del repositorio.
