---
name: optimizar-rendimiento-front
description: Audita de forma independiente y solo lectura el rendimiento de una interfaz existente, con evidencia contextual, prioridades y límites explícitos.
---

# Optimizar rendimiento frontend

Aunque el nombre usa «optimizar», esta skill **no optimiza automáticamente**. Audita una ruta, flujo, pantalla, estado o conjunto acotado de componentes frontend existentes para convertir degradaciones observables en hallazgos trazables y priorizados. Úsala para legado, incidentes, preparación de prioridades o investigación independiente; no como una checklist obligatoria después de cada cambio.

Se instala sin cambios en `.claude/skills/optimizar-rendimiento-front/` y se invoca como `/optimizar-rendimiento-front`.

Esta skill es **estrictamente de solo lectura**: no edita código, estilos, recursos, contenido, `DESIGN.md`, pruebas, snapshots, tickets, baselines, instrumentación ni configuración. No instala, configura ni impone herramientas, comandos, métricas, umbrales, perfiles de red/CPU, dependencias, CI o presupuestos; esto incluye Lighthouse, DevTools, RUM, Core Web Vitals y Playwright. No mide producción, solicita credenciales ni navega una superficie restringida sin una vía expresamente habilitada.

## Delimita la auditoría y la evidencia

1. Lee las instrucciones aplicables, `ERRORES.md` si existe, revisiones previas, `docs/design/DESIGN.md` cuando exista y mecanismos locales de ejecución, pruebas y observabilidad.
2. Identifica la superficie y su tarea: ruta, flujo, pantalla, componente, persona, estados, tamaños, datos permitidos y prioridad. Si se solicita «toda la aplicación», propone un conjunto representativo y declara exclusiones; no afirmes cobertura o rendimiento global sin ella.
3. Descubre la vía real de observación: entorno ejecutable, URL/ruta, estado de sesión permitido, datos, navegador o dispositivo disponible, métricas, trazas, perfiles, pruebas o evidencia documental ya existentes. No presupongas framework, runtime, red, navegador, automatización, herramienta ni comando.
4. Registra el contexto que realmente podrás revisar: escenario, entorno, estado, tamaños, datos, mecanismo de evidencia y límites.

Trata cada contexto de forma segura:

- **Aplicación accesible:** revisa solo las rutas públicas o expresamente habilitadas y conserva el contexto de observación.
- **Repositorio sin vía ejecutable o sin mecanismo de medición:** puedes documentar hechos estáticos como **observaciones** o **hipótesis**, pero no afirmar rendimiento medido.
- **Autenticación, permisos, datos sensibles o servicio externo no disponible:** no solicites ni manejes credenciales. Marca el alcance afectado como **bloqueado**, especifica qué no se comprobó y la condición mínima para retomarlo.
- **Petición de arreglarlo, instrumentarlo o automatizarlo:** entrega el diagnóstico y deriva la modificación; la auditoría no autoriza ni realiza cambios.

## Distingue el estado de cada afirmación

No conviertas una impresión, una captura, una inspección de código, una prueba automatizada o una documentación en rendimiento medido por sí sola. Etiqueta cada afirmación relevante con uno de estos estados:

| Estado | Uso |
| --- | --- |
| **Rendimiento medido** | Resultado cuantificado y reproducible de una experiencia accesible, con escenario y contexto declarados. No lo extrapoles a rutas, redes, equipos, datos o usuarios no revisados. |
| **Observación** | Comportamiento visible o hecho verificable en la aplicación, código, configuración o documentación. Puede describir impacto, no una causa técnica no demostrada. |
| **Hipótesis** | Explicación plausible de una observación sin confirmar. Indica qué evidencia permitiría comprobarla; no la presentes como defecto confirmado. |
| **No aplicable** | Categoría, estado o flujo inexistente o irrelevante dentro del alcance. Justifica brevemente el motivo. |
| **Bloqueado** | Falta de acceso, runtime, datos, dependencia, estado o alcance. Declara qué no puede concluirse y la condición necesaria para verificarlo. |

## Revisa el rendimiento como experiencia

Selecciona solo las categorías aplicables a la superficie y evidencia disponibles:

- **Disponibilidad e inicio percibido:** contenido útil, orientación, acciones críticas y espera comprensible desde que se abre una ruta o se solicita una tarea.
- **Continuidad de interacción:** respuesta, bloqueo, repetición accidental, cancelación, recuperación y continuidad de una tarea durante acciones relevantes.
- **Estabilidad visual y espacial:** desplazamientos inesperados, controles que aparecen tarde, reordenamientos, cambios de tamaño o pérdida de contexto durante carga y transición.
- **Renderizado y carga de interfaz:** trabajo observable que retrasa contenido o interacción, vistas extensas, actualizaciones repetidas, composición costosa o carga diferida que afecten a una tarea. No atribuyas una causa interna sin evidencia.
- **Recursos de contenido:** imágenes, vídeo, tipografía, iconografía, contenido de terceros y otros recursos solo cuando se observe su impacto en carga, lectura o continuidad.
- **Movimiento y efectos:** transiciones, animación, capas o materiales que añadan espera, consumo, desorientación o que no preserven una alternativa equivalente con movimiento reducido.
- **Estados y recuperación:** carga, vacío, error, reintento, éxito, deshabilitado y contenido progresivo; evalúa orientación, foco, lectura y posibilidad de recuperar la tarea cuando existan.
- **Adaptación y acceso equivalente:** diferencias entre tamaños o interacciones que cambien prioridad, densidad, controles o continuidad. Si la barrera principal es teclado, foco, semántica, contraste o movimiento, deriva a `/auditar-accesibilidad-front`.
- **Fronteras externas:** espera, fallo o variabilidad de API, red, terceros o plataforma como observación de frontera; no afirmes que la causa está en frontend sin evidencia.

Un hallazgo confirmado exige una degradación reproducible o un rendimiento medido con impacto observable. Una estética compleja, una cantidad de código o una puntuación aislada no bastan para concluir que una experiencia es lenta.

## Registra y prioriza hallazgos

Usa este formato para cada hallazgo confirmado:

```md
### PERF-<número> — P<0-3> — <resumen breve>
- Categoría: inicio | interacción | estabilidad | renderizado/carga | recurso | movimiento | estado/recuperación | adaptación | frontera externa.
- Ubicación: ruta, flujo, pantalla, componente, estado y tamaños/contextos afectados.
- Pasos: secuencia reproducible y precondiciones.
- Estado de evidencia: rendimiento medido | observación.
- Evidencia y contexto: medición u observación realmente obtenida; entorno, datos y límite de repetición.
- Impacto: tarea, comprensión, confianza, acceso o continuidad afectados.
- Alcance y confianza: muestras, consumidores o contextos conocidos; alta, media o baja, con motivo.
- Causa: hecho comprobado o hipótesis claramente etiquetada; cómo confirmarla si sigue abierta.
- Recomendación mínima: resultado que debe lograrse, sin imponer una herramienta, técnica o rediseño por defecto.
- Verificación de cierre: escenario y evidencia necesarios para confirmar la mejora.
- Límite: lo no revisado, no medido o no atribuible.
```

Prioriza el daño a la persona usuaria antes que una preferencia técnica:

| Prioridad | Uso |
| --- | --- |
| P0 | Impide iniciar, completar o recuperar una tarea principal; deja una experiencia esencial sin respuesta o sin acceso equivalente razonable. |
| P1 | Degrada gravemente una tarea frecuente o importante mediante espera, repetición, pérdida de contexto o interrupción persistente. |
| P2 | Añade fricción apreciable, variabilidad o riesgo de abandono en una parte acotada del flujo con alternativa funcional disponible. |
| P3 | Deuda localizada de eficiencia o continuidad sin bloqueo actual, con riesgo de propagación o coste futuro. |

Considera impacto × criticidad de tarea × frecuencia × superficie afectada × reutilización × confianza. Agrupa síntomas repetidos bajo un hallazgo raíz con muestras y alcance conocido; no infles el informe con observaciones de la misma causa. Una hipótesis no puede subir de prioridad por intuición ni sustituir un hallazgo confirmado.

## Entrega de la auditoría

Presenta:

1. **Cobertura y contexto:** rutas, flujos, estados, tamaños, datos, entorno y mecanismos de evidencia realmente revisados; exclusiones.
2. **Resumen priorizado:** conteo coherente de P0–P3 y de estados de evidencia, riesgos para tareas principales, bloqueos y hasta cinco correcciones de mayor valor.
3. **Hallazgos confirmados:** con el formato anterior, agrupados por causa raíz cuando corresponda.
4. **Observaciones e hipótesis:** separadas de los hallazgos; explica qué las confirmaría o descartaría.
5. **No aplicable y bloqueado:** áreas ausentes o no verificables, motivo, qué no puede concluirse y vía segura para retomar.
6. **Siguiente paso:** decisiones de producto/diseño, investigación de dependencia externa, correcciones locales o cambios compartidos que necesitan planificación.

No declares una aplicación «rápida», compatible con una métrica, libre de problemas de rendimiento o adecuada para todos los dispositivos y condiciones fuera de la cobertura real.

## Transición sin optimizar

- Si la degradación se detecta tras un cambio recién implementado, usa o remite primero a `frontend-visual-review.md` y su evidencia: es la revisión post-cambio aplicable.
- Para corregir un hallazgo aprobado, remite al proceso de planes y a `/implementar-front`. La auditoría no edita ni autoriza la corrección.
- Si existe un mecanismo de automatización o regresión ya aprobado, `/probar-web-playwright` puede ayudar a estabilizar o reproducir escenarios. No lo instales, configures, uses para crear pruebas/baselines ni lo confundas con una medición de experiencia.
- Si el problema principal es una barrera de teclado, foco, semántica, contraste, táctil o movimiento, deriva a `/auditar-accesibilidad-front`.
- Si el problema es una contradicción de dirección, tokens, componentes o composición sin impacto de rendimiento demostrable, deriva a `/auditar-deuda-visual`.
- Trata la evidencia de rendimiento prevista en `DESIGN.md` como intención de validación, no como un resultado ya demostrado.

## Límites

- No fija ni certifica métricas, presupuestos, niveles de servicio, compatibilidad universal o rendimiento futuro.
- No sustituye revisión visual manual, pruebas funcionales, auditorías de accesibilidad/deuda visual, análisis de backend, red, infraestructura o hardware real.
- No convierte una causa de terceros en responsabilidad del frontend sin evidencia verificable.
- No fuerza una auditoría ceremonial sobre una superficie estática o sin interacciones: revisa lo aplicable y marca el resto como no aplicable.
- No declara cobertura completa si quedan rutas, estados, tamaños, datos o contextos materiales fuera de alcance.
