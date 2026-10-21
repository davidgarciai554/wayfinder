# Inventario mínimo de componentes frontend

> Plantilla por proyecto. Añade solo componentes que resuelvan un caso de uso repetido o una interacción compleja ya demostrada. No construyas una biblioteca preventiva.

## Contexto
- `DESIGN.md` consultado:
- Flujos y pantallas analizados:
- Sistema o componentes existentes reutilizables:
- Convención técnica del repositorio:

## Inventario

| Componente | Problema o caso de uso real | Consumidores conocidos | Variantes permitidas | Estados obligatorios | Acceso equivalente | Adaptación | No usar para |
| --- | --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |  |

## Contrato de cada componente

Completa esta sección para un componente cuando su comportamiento no sea obvio.

### `<Nombre>`
- Propósito:
- Entradas y salidas relevantes:
- Acción primaria o interacción:
- Tokens consumidos:
- Estados: base, carga, vacío, error, éxito, deshabilitado, foco, activo y sobreflujo según apliquen.
- Teclado, foco, semántica y anuncios:
- Comportamiento compacto, intermedio y amplio:
- Límites y casos que no cubre:
- Evidencia de reutilización:

## Decisiones de evolución

| Duplicación o inconsistencia detectada | Solución mínima | Riesgo de regresión | Validación |
| --- | --- | --- | --- |
|  |  |  |  |

## Reglas

- Un componente unifica un comportamiento, no solo un fragmento de markup repetido dos veces.
- Reutilizar un componente existente tiene prioridad sobre crear uno nuevo si satisface el caso sin deformar su propósito.
- Una variante no puede contradecir los tokens, estados, accesibilidad o dirección de `DESIGN.md`.
- No usar una `Card`, un `Stack`, un `Section` o una abstracción genérica para ocultar una jerarquía o modelo de información que requiere una decisión explícita.
