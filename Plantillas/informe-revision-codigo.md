# Revisión de código

> Úsala para documentar una revisión independiente y solo lectura. «Sin hallazgos confirmados» no certifica calidad, seguridad ni ausencia de defectos fuera de la cobertura declarada.

## Alcance y evidencia

- **Objetivo del encargo:**
- **Base y cambios revisados:** diff, refs, archivos, parche o material recibido.
- **Estado del repositorio, si aplica:**
- **Instrucciones, contratos y documentación consultados:**
- **Contexto revisado:** símbolos, llamadores, consumidores, pruebas, configuración y `ERRORES.md`.
- **Validaciones ejecutadas y resultado real:**
- **Exclusiones, accesos y límites:**

## Veredicto

- **Estado:** hallazgos confirmados | sin hallazgos confirmados | cierre limitado por bloqueos.
- **Conteo:** P0: 0; P1: 0; P2: 0; P3: 0.
- **Superficie que requiere auditoría de seguridad y datos:** sí/no; motivo.

## Hallazgos confirmados

### CR-<número> — P<0-3> — <resumen verificable>

- **Ubicación:** `<ruta>:<líneas>`, símbolo o configuración.
- **Cambio y contexto:**
- **Evidencia:** referencias concretas y salida real, si existe.
- **Modo de fallo / reproducción:** precondiciones y pasos mínimos.
- **Resultado observado y esperado:**
- **Impacto:** usuario, compatibilidad, datos, operación o mantenimiento afectados.
- **Alcance y confianza:** contextos/consumidores conocidos; alta, media o baja y motivo.
- **Corrección mínima esperada:** resultado que debe lograrse, sin imponer stack, herramienta o rediseño.
- **Verificación de cierre:** escenario o validación observable.
- **Límite:** lo no revisado o no demostrado.
- **Seguridad y datos:** no aplicable | requiere auditoría especializada, con motivo.

> Repite el bloque por cada hallazgo. El conteo del veredicto debe coincidir exactamente con los bloques enumerados.

## Observaciones e hipótesis no confirmadas

| Referencia | Observación o hipótesis | Evidencia disponible | Qué la confirma o descarta |
| --- | --- | --- | --- |
| | | | |

## Cobertura sin hallazgos observados

| Área o escenario | Evidencia revisada | Límite |
| --- | --- | --- |
| | | |

## No aplicable y bloqueado/no verificable

| Área | Estado | Motivo | Qué no puede concluirse | Vía mínima segura para verificar |
| --- | --- | --- | --- | --- |
| | no aplicable / bloqueado | | | |

## Siguiente paso

- **Correcciones que requieren planificación y aprobación:**
- **Auditoría de seguridad y datos, si procede:**
- **Validaciones pendientes:**
- **Límite final:**
