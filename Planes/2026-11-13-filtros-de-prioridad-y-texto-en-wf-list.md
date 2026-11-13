# Plan: filtros de prioridad y texto en `wf_list` (WAY-16)

> Estado: aprobado (por el usuario, 2026-11-13, «Apruebo los cuatro», planes v1 con las recomendaciones)
> Versión: v1
> Tarea: WAY-16
> Va antes de WAY-14, que también cambia `wf_list` (`depends_on` registrado en Wayfinder).

## Contexto y objetivo

- **Problema:** `wf_list` solo filtra por estado y corta en 200 tareas sin avisar (`src/mcp.ts:321-338`, corte en L332).
- **Resultado esperado:** filtros opcionales por prioridad y por texto del título, compatibles con las llamadas actuales.
- **Evidencia del sistema actual:**
  - Esquema de `wf_list`: `project` y `status` (array de `STATUSES`; por defecto `in-progress`, `todo` y `proposed`).
  - `PRIORITIES` está en `src/store/transitions.ts`.
  - `wf_errors` ya muestra un aviso «… y N más» (`mcp.errorsList.more`, `src/mcp.ts:596`).

Mesa redonda proporcional (solo lectura), común a WAY-16, WAY-14, WAY-11 y WAY-17: solución mínima, negador, calidad y validación, y seguridad y datos. El análisis del repositorio y esta síntesis los hace el responsable de la sesión.

## Alcance

- **Incluido:**
  - Parámetros `priority` y `query` en `wf_list`.
  - Aviso de corte.
  - i18n, pruebas, README, skill y `dist` reconstruido.
- **Excluido:**
  - Buscar en la descripción o el historial: ya lo hace `wf_search`.
  - Cambios en la web.
  - Filtro por etiqueta: es WAY-14.
  - Commit y actualización del plugin instalado: necesitan tu autorización aparte.

## Decisiones de la mesa redonda

| # | Decisión | Evidencia y motivo | Alternativas descartadas | Riesgo o consecuencia |
| --- | --- | --- | --- | --- |
| D1 | **`priority`**: array opcional de `low`, `medium` y `high`. Sin él no se filtra por prioridad. | Mismo patrón que `status`. | Un solo valor: no permitiría pedir «alta o media». | — |
| D2 | **`query`**: texto literal (1 a 100 caracteres), sin distinguir mayúsculas, buscado solo en el título. | La tarea pide «texto en el título». Se compara con `toLowerCase().includes()`, sin expresiones regulares (evita ReDoS y metacaracteres). | Buscar también en la descripción: duplica `wf_search`. | — |
| D3 | **Filtros combinados con Y**, también con `status`. | Previsible y fácil de comprobar. | — | — |
| D4 | **Aviso de corte**: con más de 200 coincidencias se muestran 200 y la línea «… y N más», con N exacto. | Hoy el corte es silencioso: Claude puede creer que ha visto todo. | Mantener el corte silencioso (negador lo acepta como mejora). | Cambio de salida solo con más de 200 tareas. |
| D5 | **Sin coincidencias**: el mismo mensaje de hoy (`mcp.noTasks`). | Solución mínima: no hace falta un texto nuevo. | Mensaje con los filtros aplicados, como `wf_errors` (calidad): poco valor para el coste. | — |
| D6 | **Compatibilidad**: sin parámetros nuevos, la salida es idéntica a la de hoy. | Contrato existente. | — | — |

## Preguntas que requieren decisión del usuario

- Ninguna.

## Plan de implementación

1. `src/mcp.ts` (`wf_list`):
   - Esquema con `priority: z.array(z.enum(PRIORITIES)).optional()` y `query: z.string().min(1).max(100).optional()`.
   - Filtro con Y y aviso de corte, con la clave i18n nueva `mcp.list.more`.
   - Descripción para Claude con los filtros nuevos.
   - Validación: `npm run typecheck`.
2. `src/i18n/es.json` y `src/i18n/en.json`: `mcp.list.more`.
   - Validación: `test/i18n.test.ts` (paridad de claves), dentro de `npm test`.
3. `test/mcp.integration.test.ts`: test nuevo con estos casos:
   - `priority` con uno y con varios valores;
   - `query` sin distinguir mayúsculas, con metacaracteres tratados como literales (`.*`, `(`);
   - combinación con `status`;
   - sin coincidencias;
   - 201 tareas: 200 líneas más «… y 1 más»;
   - sin parámetros, la salida no cambia;
   - `query` vacía o de 101 caracteres: error de esquema.
   - Validación: `npm test`.
4. `README.md` y `plugin/skills/wayfinder/SKILL.md`: una línea sobre los filtros de `wf_list`.
5. `dist` y `plugin/dist`: `npm run build`.
   - Validación: `npm run check:dist`.

## Criterios de aceptación

- [ ] `wf_list` filtra por `priority` y por `query` (título, literal, sin distinguir mayúsculas), combinados con Y y con `status`.
- [ ] Con más de 200 coincidencias aparece «… y N más» con N exacto.
- [ ] Sin parámetros nuevos, la salida es la misma de antes.
- [ ] `npm run typecheck`, `npm test` y `npm run check:dist` en verde.

## Estrategia de validación

- **Pruebas específicas:** el test de integración MCP con el cliente real sobre el bundle.
- **Validaciones amplias:** `npm run typecheck`, `npm test` y `npm run check:dist`. `test:e2e` no aplica: no se toca la web.
- **Verificación funcional:** llamar a `wf_list` con el cliente de pruebas. El uso desde una sesión real queda **no verificado** hasta que actualices el plugin.
- **Seguridad:** solo lectura. Los títulos ya se muestran como hoy, y `query` no se interpreta como patrón.

## Riesgos y reversión

- **Riesgo:** un consumidor que dependa de la salida exacta con más de 200 tareas. Mitigación: el aviso es una línea al final. Residual: mínimo.
- **Reversión:** cambio aditivo, sin datos nuevos. Basta revertir el código.

## Desacuerdos residuales

- Mensaje de «sin coincidencias» con los filtros (calidad) frente a reutilizar el actual (solución mínima). Recomendación: reutilizar el actual.

## Notas de implementación

> Anotaciones posteriores a la aprobación. No cambian el alcance aprobado.

- **2026-11-13:**
  - `wf_list` acepta `priority` y `query`; el corte en 200 es la constante `MAX_TASK_LIST` y el aviso, la clave `mcp.list.more`.
  - Desviación menor de D5: el texto de `mcp.noTasks` pasa de «con esos estados» a «con esos filtros», porque con los filtros nuevos el anterior era inexacto. Ninguna prueba dependía de él.
  - Validación: test nuevo `WAY-16` en `test/mcp.integration.test.ts` (cliente MCP real sobre el bundle), `npm run typecheck`, `npm test` (161/161) y `npm run check:dist`.
  - **No verificado:** el uso desde una sesión real de Claude, que necesita actualizar el plugin instalado.
