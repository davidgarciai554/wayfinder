# Proceso de creación de planes

## Propósito

Este proceso transforma una solicitud de cambio no trivial en un plan de implementación comprobable antes de modificar código, configuración, datos o infraestructura. Se inspira en las prácticas de *brainstorming* y *writing-plans* de Superpowers, pero añade una deliberación estructurada entre subagentes de solo lectura.

El objetivo no es simular una conversación larga ni alcanzar consenso por cortesía. Es descubrir requisitos, contrastar alternativas y producir la solución más pequeña que satisfaga el objetivo, con evidencia, validación y riesgos explícitos.

## Cuándo se aplica

Se aplica antes de implementar:

- funcionalidades nuevas;
- correcciones cuya causa, alcance o impacto no sea evidente;
- refactorizaciones;
- cambios de arquitectura, dependencias, permisos, datos, integraciones o configuración;
- cambios que afecten a experiencia de usuario, accesibilidad, seguridad, rendimiento u operación.

No se aplica a consultas, análisis de código sin edición ni cambios claramente triviales y reversibles, como una corrección aislada de texto. Ante la duda, se aplica una versión proporcional y breve del proceso.

## Límites y garantías

1. La investigación, las aportaciones de roles y el debate de planificación son estrictamente de solo lectura. Sus participantes no crean, modifican ni eliminan artefactos del repositorio objetivo.
2. Los subagentes investigan y aconsejan; no aprueban ni implementan.
3. Las afirmaciones sobre el repositorio deben referenciar archivos, símbolos, pruebas, configuración o documentación revisada. Las suposiciones se etiquetan como tales.
4. Las decisiones de producto, alcance, seguridad, datos, comportamiento incompatible o experiencia de usuario que no puedan inferirse se elevan al usuario.
5. El plan no habilita por sí solo acciones sensibles. Commit, push, despliegue, migración destructiva o modificación de infraestructura requieren autorización explícita independiente.
6. Ninguna fase posterior comienza sin un plan aprobado explícitamente, excepto si el usuario autoriza expresamente avanzar sin esa aprobación.

## Entradas requeridas

Antes de convocar la mesa redonda, el responsable de planificación reúne:

- solicitud original y resultado esperado;
- instrucciones aplicables del repositorio;
- estado del repositorio y cambios preexistentes;
- arquitectura, flujo y puntos de integración afectados;
- herramientas, comandos y validaciones reales descubiertos en el repositorio;
- restricciones conocidas: compatibilidad, rendimiento, seguridad, datos, operación, accesibilidad, plazo y dependencias;
- incidencias relevantes documentadas en `ERRORES.md`, si existe.

Si falta una decisión que cambie el comportamiento o el alcance, se formula una pregunta concreta antes de cerrar el plan. No se sustituye por una invención razonable.

## Participantes y responsabilidades

La composición normal incluye seis voces. Los roles condicionales se activan por la superficie de cambio. El moderador es un rol de coordinación, no una fuente de decisiones técnicas.

| Rol | Responsabilidad | Resultado esperado |
| --- | --- | --- |
| Moderador | Ordena las fases, distribuye turnos, limita repeticiones, señala preguntas sin resolver y exige el formato de salida. No aporta una solución propia ni decide. | Agenda, turnos completados, desacuerdos y preguntas abiertas. |
| Analista del repositorio | Establece hechos verificables sobre el sistema existente: arquitectura, flujos, patrones, dependencias, puntos de extensión, restricciones y validaciones. | Informe factual con referencias y supuestos separados. |
| Idealista | Defiende el valor de la propuesta y explora cómo cumplir plenamente la intención del usuario. | Beneficios, oportunidades y requisitos que no deben perderse. |
| Negador | Cuestiona alcance, complejidad, supuestos, coste de mantenimiento, alternativas y riesgos de regresión. | Objeciones fundamentadas, alternativas y condiciones de descarte. |
| Representante funcional de usuario | Evalúa utilidad, coherencia de flujo, casos de uso, prioridades y criterios de aceptación desde quien utilizará la función. No inventa preferencias del usuario. | Casos de uso, no objetivos y criterios de aceptación. |
| Técnico de solución mínima | Busca la primera solución que satisfaga los requisitos siguiendo esta prioridad: no cambiar, reutilizar capacidad existente, capacidad nativa, dependencia ya instalada, código nuevo mínimo. | Propuesta mínima, coste relativo, dependencias y límites conocidos. |
| Responsable de calidad y validación | Convierte el objetivo en comprobaciones observables; cubre regresiones, errores, límites, pruebas y verificación funcional. | Estrategia de validación, evidencia esperada y criterios de salida. |
| Mediador y sintetizador | Contrasta los desacuerdos con la evidencia, propone compromisos que preserven requisitos y redacta la recomendación. No oculta riesgos ni fuerza consenso. | Decisiones propuestas, desacuerdos residuales y borrador de plan. |
| Revisor de seguridad y datos (condicional) | Se activa ante autenticación, autorización, entrada externa, APIs, secretos, datos personales, pagos, archivos, dependencias u operaciones destructivas. | Riesgos, límites de confianza, controles y validaciones de seguridad. |
| Responsable de accesibilidad y experiencia (condicional) | Se activa ante cambios de interfaz o flujo de interacción. Examina estados vacíos, carga, error, teclado, lector de pantalla, móvil y comprensión. | Requisitos de interacción y accesibilidad comprobables. |

Los perfiles de la mesa redonda están definidos en `Subagentes/`: `Moderador.md`, `Analista-repositorio.md`, `Idealista.md`, `Negador.md`, `Representante-funcional.md`, `Tecnico-solucion-minima.md`, `Calidad-validacion.md`, `Mediador-sintetizador.md`, `Seguridad-datos.md` y `Accesibilidad-experiencia.md`. Este documento mantiene el proceso y sus contratos comunes.

## Protocolo de la mesa redonda

### 1. Clasificación y composición

El moderador clasifica la tarea por riesgo y selecciona participantes proporcionales:

- **Cambio normal:** analista, idealista, negador, representante funcional, técnico de solución mínima, calidad y mediador.
- **Cambio de interfaz:** añade accesibilidad y experiencia.
- **Cambio con superficie sensible:** añade seguridad y datos.
- **Cambio amplio o arquitectónico:** todos los anteriores; puede dividirse en incrementos independientes, pero conserva un único responsable de síntesis.

No se incorporan agentes solo para aumentar el número de opiniones. Cada rol debe aportar información no duplicada.

### 2. Informe factual inicial

El analista revisa el repositorio en modo lectura y publica primero la base común. Debe distinguir:

- hechos comprobados, con referencia;
- restricciones deducidas razonablemente;
- información desconocida;
- decisiones que corresponden al usuario.

Los demás roles no deben discutir una arquitectura imaginada si el informe factual puede resolverlo.

### 3. Aportaciones independientes

Idealista, negador, representante funcional, técnico y calidad emiten propuestas separadas sobre la misma base factual. Los roles condicionales intervienen aquí cuando proceda.

Cada aportación debe contener, como mínimo:

- postura y razonamiento;
- evidencia utilizada;
- impacto sobre alcance, coste, riesgo o experiencia;
- alternativas viables;
- preguntas o condiciones necesarias.

El idealista no puede omitir costes o riesgos conocidos. El negador no puede rechazar una idea sin proponer una alternativa, condición de aceptación o evidencia que justifique el descarte.

### 4. Debate moderado

El moderador presenta los desacuerdos reales y concede turnos breves para responder a objeciones. Se limita a diferencias que afecten a requisitos, seguridad, datos, coste, mantenibilidad, validación o experiencia.

No se debate para alcanzar unanimidad. Se cierra cada cuestión como una de estas opciones:

- decisión recomendada y evidencia;
- alternativa descartada y motivo;
- riesgo aceptado pendiente de aprobación;
- pregunta que requiere decisión del usuario;
- incertidumbre que necesita investigación adicional.

### 5. Mediación y síntesis

El mediador propone una solución equilibrada. Debe preservar los requisitos explícitos y no puede usar la simplicidad para reducir seguridad, integridad, accesibilidad, manejo de errores ni requisitos funcionales.

Si el desacuerdo persiste, el plan debe conservarlo de forma visible. Un riesgo probado no se convierte en aceptable por mayoría de votos.

### 6. Revisión de coherencia

Antes de presentar el plan, se comprueba que:

- cada paso responde a un requisito o a una restricción demostrable;
- el alcance no contiene trabajo especulativo;
- existen criterios de aceptación y validaciones concretas;
- los cambios previsibles son compatibles con el repositorio;
- los riesgos y la reversión son proporcionados;
- se han separado los hechos, las decisiones y las preguntas abiertas.

## Registro acotado del borrador

Al cerrar la síntesis, el mediador entrega el contenido completo del borrador en lectura. Fuera de las acciones de los subagentes, el responsable principal de la sesión puede crear `Planes/` si no existe y persistir exclusivamente un borrador Markdown en `Planes/AAAA-MM-DD-nombre-de-la-implementacion.md` para solicitar aprobación.

Esta transición documental no constituye implementación ni autorización adicional. Antes de la aprobación explícita no puede crear, modificar ni eliminar código, configuración, datos, infraestructura, pruebas, dependencias, documentos no relacionados, commits ni operaciones externas. No puede sobrescribir un plan existente cuya relación con el borrador no esté confirmada; ante una colisión se detiene y se eleva la decisión al usuario.

El borrador lleva estado y versión. Mientras esté pendiente, los ajustes actualizan ese mismo borrador. Si un plan ya aprobado necesita una desviación material, su contenido aprobado se conserva y se crea un nuevo borrador identificado que referencia el plan y la versión anteriores; ese borrador requiere una aprobación explícita nueva.

## Contrato del plan resultante

El borrador resultante se persiste obligatoriamente en Markdown, con extensión `.md`, dentro de la carpeta `Planes/` del repositorio objetivo conforme al registro acotado anterior. El nombre del archivo usa la fecha de redacción y un nombre descriptivo de la implementación: `Planes/AAAA-MM-DD-nombre-de-la-implementacion.md`. Se usa la fecha local de creación del plan; el nombre se escribe en minúsculas, con palabras separadas por guiones. Si el repositorio ya define una convención equivalente, se respeta esa convención. Debe contener:

```markdown
# Plan: <título>

> Estado: borrador pendiente de aprobación
> Versión: v1

## Contexto y objetivo
- Problema u oportunidad:
- Resultado esperado:
- Evidencia del sistema actual:

## Alcance
- Incluido:
- Excluido:
- Supuestos y restricciones:

## Decisiones de la mesa redonda
| Decisión | Evidencia y motivo | Alternativas descartadas | Riesgo o consecuencia |
| --- | --- | --- | --- |

## Preguntas que requieren decisión del usuario
- <pregunta, impacto y opciones si procede>

## Plan de implementación
1. `<ruta o componente>`: <cambio concreto, comportamiento y motivo>.
   - Validación: <comando o escenario real que se ejecutará>.
2. ...

## Criterios de aceptación
- [ ] <resultado observable>
- [ ] <resultado observable>

## Estrategia de validación
- Pruebas específicas:
- Validaciones amplias:
- Verificación funcional:
- Comprobaciones de seguridad/accesibilidad, si aplican:

## Riesgos y reversión
- Riesgo:
- Mitigación:
- Reversión o recuperación:

## Desacuerdos residuales
- <posturas, evidencia y recomendación>
```

Los pasos deben nombrar rutas o componentes reales cuando ya se conozcan, describir el comportamiento a cambiar y la validación asociada. No son válidos pasos vagos como «actualizar backend» o «añadir pruebas».

## Aprobación y transición a implementación

El responsable presenta un resumen del borrador persistido y solicita aprobación explícita. La aprobación debe identificar la ruta y la versión vigentes. Si hay preguntas abiertas que alteran el comportamiento, el alcance, la seguridad, los datos, la compatibilidad o la experiencia, el borrador permanece pendiente y no puede aprobarse.

Cuando el usuario aprueba el borrador identificado, el responsable marca su estado como `aprobado` sin cambiar la versión, congela su contenido y conserva el alcance acordado. Guardar o actualizar un borrador no constituye aprobación. Una aprobación ambigua no habilita implementación: debe aclararse el archivo y versión a los que se refiere.

Tras la aprobación:

1. se congela el alcance acordado;
2. el implementador recibe el plan Markdown aprobado y las instrucciones del repositorio;
3. cualquier desviación relevante se documenta y se eleva para decisión;
4. al finalizar, se compara la implementación con los criterios de aceptación y las validaciones definidas en el plan.

La implementación no reutiliza la mesa redonda como autorización implícita. Los subagentes de planificación no editan el repositorio objetivo; antes de aprobar, el responsable principal de la sesión solo puede realizar el registro acotado del borrador definido en este proceso.

## Proporcionalidad y mejora continua

El proceso debe ser más breve que el cambio cuando el riesgo sea bajo. Para evitar burocracia:

- se limita el debate a decisiones con impacto real;
- se activa seguridad y accesibilidad solo cuando corresponda;
- se reutilizan hallazgos factuales entre roles;
- se evita repetir argumentos ya resueltos;
- se registra únicamente el razonamiento que afecte al plan o a una decisión futura.

Tras una implementación, se puede contrastar el plan con el resultado: precisión del alcance, desviaciones, validaciones omitidas, riesgos materializados y utilidad de cada rol. Los perfiles de los agentes se ajustarán con esa evidencia, no por proliferación especulativa.

## Relación con Superpowers

Superpowers aporta una referencia útil para el refinamiento de ideas, la escritura de planes detallados, la ejecución con puntos de control y la verificación antes de declarar finalización. Este proceso conserva esos principios y añade una deliberación de roles con límites claros, salida estructurada y aprobación humana antes de editar.

- Repositorio de referencia: https://github.com/obra/superpowers
- Capacidades relevantes: `brainstorming`, `writing-plans`, `executing-plans`, `dispatching-parallel-agents` y `verification-before-completion`.
