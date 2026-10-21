# Selección y aviso de skills

> Regla de proyecto. Copia este archivo en `.claude/rules/seleccion-y-aviso-de-skills.md` para aplicarlo a las sesiones de Claude Code del repositorio.

## Propósito y precedencia

Haz explícita la selección de una skill antes de iniciar un procedimiento especializado. Considera únicamente las skills instaladas y disponibles para la sesión, usando su `name`, `description`, límites declarados, instrucciones aplicables y la petición del usuario. No crees un catálogo paralelo ni inventes capacidades, rutas, herramientas o resultados.

La invocación explícita del usuario prevalece sobre una selección automática. Entre candidatas automáticas, una skill específica del proyecto prevalece sobre una más general cuando su propósito y alcance cubran la petición. Las instrucciones directas del usuario, las políticas aplicables y las reglas específicas del repositorio prevalecen sobre esta regla.

Esta es una regla textual: orienta la selección y la comunicación, pero no garantiza que una skill se descubra, cargue, aplique o bloquee de forma determinista. Los controles deterministas requieren un mecanismo técnico independiente y autorizado.

## Selección antes de usar una skill

1. Antes de seguir un procedimiento especializado, identifica si una skill instalada es pertinente.
2. Si el usuario invoca una skill disponible de forma explícita, respeta esa elección. La skill conserva sus propios límites, precondiciones, bloqueos y derivaciones; una invocación explícita no autoriza eludirlos.
3. Si una skill específica del proyecto cubre la petición, no la sustituyas silenciosamente por una skill general.
4. Si detectas automáticamente una skill claramente aplicable, avisa **antes de seguir su procedimiento o realizar sus acciones**. Indica:
   - nombre invocable de la skill;
   - motivo concreto de la coincidencia;
   - límite, precondición o consecuencia relevante;
   - acción que iniciarías.
5. Después del aviso, solicita confirmación explícita antes de aplicar la skill detectada automáticamente. No presentes la confirmación como aprobación de cambios, diseño, plan, datos, despliegues u otros efectos que la propia skill o las reglas aplicables requieran autorizar por separado.

Usa este formato conciso cuando proceda:

```markdown
**Skill propuesta:** `/nombre`
**Motivo:** <coincidencia concreta>
**Límite o precondición:** <solo si es relevante>
**Siguiente acción:** <procedimiento que se iniciaría>

¿Confirmas que la aplique?
```

## Varias candidatas, ambigüedad y ausencia

- **Varias skills compatibles sin diferencia material:** comunica el orden propuesto y el motivo breve. Solicita confirmación únicamente para la siguiente skill que vayas a aplicar; reevalúa las posteriores con el contexto actualizado.
- **Ambigüedad material:** si la elección cambia autoridad, alcance, modo de solo lectura, efectos, datos, seguridad, resultado esperado o procedimiento, presenta las candidatas y sus diferencias relevantes. Formula la pregunta mínima necesaria; no elijas en silencio.
- **Ninguna skill aplicable:** decláralo de forma breve y continúa mediante las instrucciones y el proceso general del repositorio. No fuerces una skill por semejanza superficial.
- **Skill solicitada o esperada pero ausente:** indica que no está instalada o disponible. No simules su carga, pasos, herramientas, comandos, pruebas ni resultados. Si procede, explica que su adopción o instalación requiere la decisión y el proceso aplicables.

## Límites

Esta regla no instala, actualiza, crea, elimina ni encadena skills automáticamente. No sustituye los contratos individuales de las skills, las instrucciones del proyecto, la planificación, la validación, las reglas de seguridad, datos, Git u operaciones sensibles, ni los controles técnicos del repositorio.
