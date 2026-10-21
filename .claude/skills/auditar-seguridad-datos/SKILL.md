---
name: auditar-seguridad-datos
description: Audita de forma independiente y solo lectura la seguridad y el tratamiento de datos de una superficie existente, con evidencia, prioridades y límites explícitos. Úsala ante cambios o superficies sensibles; no edita ni certifica seguridad.
---

# Auditar seguridad y datos

Usa `/auditar-seguridad-datos [superficie] [contexto-opcional]` para examinar de forma independiente un cambio, flujo, ruta, API, configuración, archivo, dependencia, componente o tratamiento de datos ya existente. La auditoría es **estrictamente de solo lectura**: convierte evidencia contextual en hallazgos priorizados, observaciones y bloqueos; no corrige, aprueba riesgos ni certifica seguridad o conformidad.

Instala esta skill en `.claude/skills/auditar-seguridad-datos/`.

## Límites estrictos

- No edites código, pruebas, permisos, secretos, infraestructura, configuración, datos, tickets, baselines ni documentación del sistema auditado.
- No instales herramientas, dependencias, scanners, agentes, navegadores, configuraciones de CI o instrumentación. No despliegues, migres, reinicies ni ejecutes operaciones destructivas.
- No solicites, copies, muestres ni almacenes secretos, tokens, contraseñas, claves privadas, sesiones, datos personales o contenido sensible. Si detectas una exposición, describe ubicación, tipo, alcance y vía segura de respuesta, sin reproducir el valor.
- No uses ni intentes evadir cuentas, permisos, autenticación, controles, restricciones de red o límites de producción. Si el acceso no está expresamente permitido, marca la superficie como bloqueada.
- No inventes amenazas, controles, requisitos regulatorios, configuración, resultados de ejecución, cobertura, comportamiento de producción ni cumplimiento.
- No certificas seguridad, privacidad, conformidad, ausencia de vulnerabilidades ni seguridad de producción. La ausencia de hallazgos no es una aprobación global.
- Un hallazgo no autoriza una corrección ni aceptación de riesgo. Las correcciones siguen planificación e implementación aprobadas; el usuario decide la aceptación de riesgos materiales.

## Relación con otros flujos

- `Subagentes/Seguridad-datos.md` participa **antes de implementar**, dentro de la mesa redonda: evalúa riesgos previsibles de una propuesta. Esta skill audita evidencia de una superficie ya existente y no altera ese rol.
- `/revisar-codigo` revisa el cambio y su contexto general. Si identifica identidad, permisos, entradas externas, APIs, secretos, datos, archivos, dependencias, red, pagos u operaciones destructivas, puede derivar aquí. Esta skill no sustituye la revisión general de compatibilidad y calidad.
- Para corregir un hallazgo aprobado, remite al proceso de planes y a la implementación aplicable. Tras un cambio, la revisión de código o una auditoría de seguridad nueva pueden aportar evidencia de cierre.

## 1. Delimita la superficie y el acceso permitido

Antes de evaluar, registra:

1. **Encargo y objetivo:** qué pregunta de seguridad/datos debe responderse y qué queda fuera.
2. **Superficie:** cambio, refs/diff, ruta, flujo, estado, API, componente, configuración, archivo, dependencia, activo o dato concreto.
3. **Contexto permitido:** repositorio, entorno, URL, datos sintéticos, cuenta o sesión permitida, documentación, pruebas, logs saneados y herramientas ya disponibles.
4. **Activos y datos:** datos persistentes o transitados, clasificación conocida, secretos, archivos, operaciones, servicios y consumidores afectados.
5. **Límites de confianza:** actores, entradas, salidas, APIs, red, identidades, permisos y servicios externos que realmente existan.
6. **Evidencia disponible:** instrucciones, `ERRORES.md` si existe, diff/base, código, llamadores, contratos, configuración, manifiestos, pruebas, resultados de validaciones y documentación.

No presupongas Git, PR, CI, stack, runtime, red, cuenta, herramienta o modelo de amenazas. **Si no hay Git, una base comparable o un diff**, limita la auditoría a la superficie entregada y declara esa restricción. Si falta acceso, runtime, datos seguros o un componente externo, declara qué no puede concluirse y la vía mínima segura para retomarlo.

## 2. Reúne y clasifica evidencia

Lee primero las instrucciones aplicables y consulta `ERRORES.md` si hay coincidencias por componente, síntoma, mensaje, entorno o validación. Una incidencia histórica no demuestra un problema actual sin confirmación.

Distingue siempre:

| Estado | Uso |
| --- | --- |
| **Verificado** | Evidencia reproducible suficiente dentro de la cobertura declarada. |
| **Observación o hipótesis** | Hecho visible que todavía no demuestra amenaza, exposición o impacto; indica qué lo confirmaría o descartaría. |
| **No aplicable** | La categoría no existe en la superficie; justifica brevemente. |
| **Bloqueado/no verificable** | Falta acceso permitido, runtime, datos seguros, dependencia, documentación o condición de prueba. Indica qué no se pudo evaluar y la vía segura mínima para verificarlo. |

Una revisión estática, un diff, una herramienta aislada, una captura o una ejecución sin contexto no demuestran por sí solos seguridad, explotación, impacto de producción ni conformidad.

## 3. Examina solo categorías aplicables

Selecciona las categorías que la superficie haga relevantes; no uses una checklist universal ni generes hallazgos por ausencia de una tecnología concreta.

- **Identidad y permisos:** autenticación, autorización, sesiones, roles, propiedad de recursos, elevación de privilegios y acciones sensibles.
- **Entradas y límites de confianza:** validación, normalización, deserialización, redirecciones, integraciones, callbacks, automatización y transiciones entre actores/servicios.
- **Datos y secretos:** minimización, exposición, retención, registros, copias, cifrado cuando exista, datos personales, valores de configuración y gestión de secretos.
- **APIs, red y exposición de información:** contratos externos, errores, cabeceras, CORS u otras políticas existentes, comunicaciones, metadatos y observabilidad.
- **Archivos, recursos y persistencia:** rutas, permisos, carga/descarga, aislamiento, borrado, integridad, migraciones y recuperación.
- **Dependencias y cadena de suministro:** manifiestos, bloqueo de versiones, origen, scripts, permisos de instalación, configuración de publicación y cambios de dependencia observables.
- **Operación y recuperación:** acciones destructivas, idempotencia, reversión, copias, registro, alertas existentes y límites operativos.

Busca cambios introducidos o agravados por el material revisado. Separa un riesgo preexistente de uno nuevo, indicando si el cambio lo agrava. Agrupa síntomas cuando una causa común esté demostrada.

## 4. Registra hallazgos sustentados

Usa P0–P3 como prioridad relativa, explicando siempre impacto, condición, alcance y confianza:

| Prioridad | Uso |
| --- | --- |
| **P0** | Exposición demostrada de secreto o datos especialmente sensibles, bypass de autorización, pérdida/corrupción de datos, ejecución u operación destructiva no recuperable o compromiso de una función esencial. Bloquea el cierre. |
| **P1** | Riesgo reproducible de acceso, revelación, integridad, disponibilidad o recuperación con impacto material sobre un flujo, activo o consumidor importante. |
| **P2** | Debilidad acotada, manejo de fallo incompleto o control insuficiente con condición plausible y alternativa funcional/mitigación disponible. |
| **P3** | Deuda de seguridad u operación con coste concreto y mejora mínima demostrable; nunca una recomendación genérica o de estilo. |

Cada hallazgo confirmado usa este contrato:

```md
### SEC-<número> — P<0-3> — <resumen verificable>
- Ubicación y superficie: <ruta>:<líneas>, símbolo, flujo, configuración o activo.
- Activo, dato o límite de confianza afectado:
- Cambio y contexto: <modificación, consumidor, contrato o control revisado>.
- Condición o escenario: <precondiciones y pasos mínimos, sin incluir secretos>.
- Evidencia: <referencias concretas y salida saneada si existe>.
- Resultado observado y esperado: <actual frente al control, contrato o comportamiento demostrado>.
- Impacto: <confidencialidad, integridad, disponibilidad, permisos, privacidad, operación o recuperación>.
- Alcance y confianza: <actores, consumidores y contextos conocidos; alta/media/baja y motivo>.
- Control mínimo esperado: <resultado que debe lograrse, sin imponer tecnología o rediseño>.
- Verificación de cierre: <escenario o evidencia observable, segura y autorizada>.
- Límite: <lo no revisado o no demostrado>.
- Decisión del usuario: no requerida | aceptación de riesgo/alcance pendiente, con motivo.
```

No eleves una sospecha a hallazgo confirmado sin ubicación o superficie, condición, evidencia e impacto. No declares P0 solo porque existe una superficie sensible. Para una exposición de secretos, evita copiar el valor incluso si está disponible: señala solo tipo, ubicación y alcance.

## 5. Entrega la auditoría y deriva el siguiente paso

Emite una salida con estas secciones:

1. **Alcance y evidencia:** superficie, activos/datos, límites de confianza, instrucciones y contexto revisados, validaciones ejecutadas y exclusiones.
2. **Veredicto:** hallazgos confirmados | sin hallazgos confirmados | cierre limitado por bloqueos; conteo P0–P3 y cobertura.
3. **Hallazgos confirmados:** cada `SEC-<número>` con el contrato anterior.
4. **Observaciones e hipótesis:** evidencia disponible y qué las confirmaría o descartaría.
5. **Cobertura sin hallazgos observados:** áreas, evidencia y límites.
6. **No aplicable y bloqueado/no verificable:** área, motivo, qué no puede concluirse y vía mínima segura.
7. **Siguiente paso:** correcciones que requieren planificación, validaciones pendientes, revisión de código posterior y decisiones de riesgo/alcance para el usuario.

El conteo de prioridades debe coincidir con los hallazgos enumerados. Si no hay defectos sustentables, declara:

> **Veredicto: sin hallazgos confirmados dentro de la cobertura declarada.**

Acompáñalo de las áreas revisadas, validaciones reales, bloqueos y límite: no equivale a seguridad total ni a aceptación automática para producción.

## 6. Transiciones seguras

- **Petición de corregir, instalar o configurar:** no la ejecutes; entrega hallazgos y remite al plan/implementación aprobados.
- **Petición de aceptar un riesgo:** presenta evidencia, impacto, controles/alternativas y decisión necesaria; no aceptes por el usuario.
- **Secretos o datos expuestos:** no reproduzcas valores. Limita la salida, describe ubicación/tipo/alcance y recomienda la vía de respuesta autorizada del repositorio/organización.
- **Cambio recién implementado:** usa o enlaza `/revisar-codigo` para comprobar contratos, regresiones y validaciones disponibles; esta auditoría profundiza solo donde la superficie sensible lo justifique.
- **Propuesta aún sin implementar:** deriva a `Subagentes/Seguridad-datos.md` dentro de la mesa redonda de planificación.

## Cierre

Antes de finalizar, confirma que:

- la superficie, los activos/datos, la evidencia y los límites están declarados;
- cada hallazgo contiene condición, impacto, evidencia, alcance/confianza, control mínimo y cierre;
- el informe separa verificado, observación, no aplicable y bloqueado;
- no has solicitado, expuesto ni almacenado secretos, credenciales o datos sensibles;
- no afirmas ejecución, explotación, cobertura o conformidad no demostradas;
- las decisiones de riesgo y las correcciones siguen en manos del usuario y del flujo aprobado.
