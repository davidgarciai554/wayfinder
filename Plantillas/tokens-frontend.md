# Contrato de tokens frontend

> Plantilla por proyecto. Completa este documento desde `docs/design/DESIGN.md` y tradúcelo a la convención real del stack —CSS custom properties, tema del framework, constantes nativas u otra equivalente— sin cambiar su significado.

## Decisiones de origen
- `DESIGN.md` consultado:
- Área, tema o modo al que aplica:
- Convención técnica del repositorio:
- Componentes o tokens existentes reutilizados:
- Decisiones que requieren migración separada:

## Mapa semántico

| Grupo | Rol semántico | Significado en el producto | Token o clave técnica | Valor por modo | Estado |
| --- | --- | --- | --- | --- | --- |
| Superficies | `surface.canvas` | Fondo general de la aplicación |  |  | propuesto |
| Superficies | `surface.raised` | Área agrupada o elevada |  |  | propuesto |
| Superficies | `surface.overlay` | Diálogo, menú o capa temporal |  |  | propuesto |
| Texto | `text.primary` | Información principal legible |  |  | propuesto |
| Texto | `text.secondary` | Contexto o información auxiliar |  |  | propuesto |
| Texto | `text.disabled` | Contenido intencionalmente no disponible |  |  | propuesto |
| Bordes | `border.subtle` | Separación discreta |  |  | propuesto |
| Bordes | `border.strong` | Límite o estado que debe destacarse |  |  | propuesto |
| Acción | `action.primary` | Acción principal del flujo |  |  | propuesto |
| Acción | `action.secondary` | Acción alternativa |  |  | propuesto |
| Estado | `status.success` | Confirmación semántica |  |  | propuesto |
| Estado | `status.warning` | Atención no destructiva |  |  | propuesto |
| Estado | `status.danger` | Error o acción destructiva |  |  | propuesto |
| Foco | `focus.ring` | Foco de teclado visible |  |  | propuesto |
| Espaciado | `space.*` | Escala de separación y agrupación |  |  | propuesto |
| Tipografía | `type.*` | Familias, escala, pesos y línea |  |  | propuesto |
| Forma | `radius.*` | Radio según control o contenedor |  |  | propuesto |
| Profundidad | `shadow.*` | Elevación con significado |  |  | propuesto |
| Movimiento | `motion.*` | Duración y curva de feedback funcional |  |  | propuesto |

## Reglas de consumo

- Los nombres describen **rol**, no un valor físico: usa `action.primary`, no `blue.700`; usa `space.compact`, no `padding.12`.
- No todo valor necesita token: un valor local solo es válido si no expresa una decisión reutilizable; documenta el motivo en la revisión.
- Cada token de estado mantiene contraste y no comunica información crítica únicamente con color.
- Los modos claro/oscuro u otras variantes conservan el significado del token; no fuerzan equivalencia exacta de valor.
- Un token nuevo exige propósito, consumidor previsto y comprobación de que no duplica uno existente.
