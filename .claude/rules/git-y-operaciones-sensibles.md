# Git y operaciones sensibles

> Regla de proyecto. Copia este archivo en `.claude/rules/git-y-operaciones-sensibles.md` para aplicarlo a las sesiones de Claude Code del repositorio.

## Propósito y precedencia

Preserva la intención del usuario, el trabajo ajeno y los datos persistentes antes de operar sobre control de versiones, servicios externos o entornos compartidos. Es una regla textual: no ejecuta comandos, no concede permisos ni demuestra que una operación sea segura, reversible o exitosa.

Las instrucciones locales, reglas por ruta, políticas organizativas y controles más específicos prevalecen. Una autorización explícita cubre únicamente la operación, alcance, destino y datos que identifica; no autoriza una acción distinta ni riesgo adicional.

## Antes de una operación con efectos

1. Distingue entre **inspección sin efectos**, **cambio local**, **publicación o modificación remota** y **operación sensible** sobre despliegue, migración, infraestructura, permisos, datos o recursos con coste.
2. Antes de una acción con efectos, identifica el sistema correcto, estado actual, alcance solicitado, cambios existentes, destino, impacto, dependencias y la reversión o recuperación realmente disponible.
3. Mantén el cambio y la operación mínimos. No limpies, reformatees, reordenes, descartes, restaures, ocultes temporalmente, incorpores ni publiques trabajo ajeno o no relacionado.
4. No asumas titularidad de cambios presentes, autorización de rama/remoto/cuenta/entorno, persistencia, reversibilidad ni resultado externo. Si falta evidencia, alcance, autorización o acceso permitido, preserva el estado y declara el bloqueo.

La lectura, inspección y propuesta no autorizan cambios. No solicites ni expongas secretos, ni conviertas una credencial disponible en autorización o eludas controles de acceso.

## Autorización y publicación

Requieren autorización explícita, previa y delimitada del usuario:

- crear un commit, modificar historia, etiquetar, publicar o enviar cambios a un remoto;
- crear, modificar o borrar estado remoto, compartido o persistente;
- desplegar, migrar, alterar infraestructura, servicios, permisos, configuración, dependencias o recursos con coste;
- usar cuentas, integraciones, APIs, red, entornos compartidos o producción para causar un efecto.

La autorización de un commit no autoriza un push. La autorización de un push no autoriza modificar contenido, historia, remoto, destino, despliegue ni operación adicional.

## Forzado y conflictos de integración

- **Nunca uses `--force`**, aunque el usuario lo solicite. Tampoco uses `--force-with-lease`, `--force-if-includes`, refspecs con prefijo `+`, alias, configuración u otro mecanismo que fuerce, reescriba, sobrescriba o eluda protecciones de historial o referencias. Si una publicación normal es rechazada, conserva el estado y solicita una alternativa no destructiva aprobada.
- Ante un conflicto de **merge**, **rebase**, **cherry-pick** o integración equivalente, detén la operación. No edites archivos para resolverlo, no elijas versiones, no continúes, omitas, abortes ni reinicies la integración. Informa el ámbito en conflicto y espera a que **el usuario lo resuelva exclusivamente**.
- No descartes, restaures, sobrescribas, borres ni incluyas cambios ajenos para limpiar el árbol, completar una operación o simplificar una revisión. Propón separarlos o espera instrucciones explícitas.

## Reversión, datos y cierre

Una reversión, rollback, recuperación o restauración también es una acción con efectos: requiere autorización explícita, alcance inequívoco, impacto evaluado y comprobación proporcional. No la presentes como inocua ni como equivalente a deshacer todos los efectos sobre datos, despliegues, migraciones, historia o trabajo posterior.

Antes de finalizar, declara cada operación sensible relevante como:

- **no aplicable**: no existió operación sensible en el alcance;
- **preparada/pendiente de autorización**: está delimitada, pero no se ejecutó;
- **bloqueada**: falta autorización, acceso permitido, estado seguro, decisión o evidencia;
- **ejecutada y comprobada**: hubo autorización, se realizó en el alcance aprobado y se verificó el efecto disponible;
- **ejecutada con límite**: se realizó con autorización, pero un efecto, persistencia o reversión no pudo comprobarse; explica cuál y por qué.

No declares publicación, persistencia, reversión, sincronización ni cierre pleno sin evidencia real. Esta regla complementa `desarrollo-y-evidencia.md`, `pruebas-y-validacion.md` y `seguridad-y-datos.md`; no sustituye planificación, validación, auditorías ni controles especializados.
