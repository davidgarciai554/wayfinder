# Diseño: <producto o área>

> Estado: borrador | pendiente de revisión | aprobado | sustituido
>
> Este documento es la fuente de verdad de diseño para el área indicada. Debe leerse antes de modificar su interfaz.

## Propósito y alcance
- Producto o área:
- Objetivo de la interfaz:
- Persona, contexto y plataforma prioritaria:
- Trabajo principal que debe poder completarse:
- Incluido:
- Excluido:
- Señal observable de éxito:

## Entrada y referencias
### Petición original
- Resumen fiel:

### Referencias examinadas
| Fuente | Tipo | Observado | Inferido | Decisión adoptada o descartada | Limitación |
| --- | --- | --- | --- | --- | --- |

### Exploración visual
| Artifact, enlace o versión | Dirección evaluada | Decisión extraída | Estado |
| --- | --- | --- | --- |

## Dirección de diseño aprobada
- Idea rectora:
- Personalidad y tono:
- Densidad de información:
- Principio de composición:
- Dirección que se evita:
- Riesgo visual deliberado y motivo:

## Arquitectura e interacción
- Navegación y orientación:
- Jerarquía de pantallas y contenidos:
- Flujo principal:
- Acciones primarias y secundarias:
- Patrón o patrones seleccionados:
- Patrones descartados y motivo:

## Sistema visual
### Color y superficies
- Superficie y fondo:
- Texto y jerarquía:
- Acción y énfasis:
- Estados semánticos:
- Contraste objetivo:

### Tipografía y espaciado
- Familias y alternativas:
- Escala y pesos:
- Retícula, espaciado y anchuras:
- Radio, bordes y profundidad:
- Iconografía, imágenes o material visual:

### Patrones Apple adaptados (solo si aplican)
- Propósito y patrones seleccionados:
- Interacción directa, cancelación y límites:
- Continuidad espacial, origen y destino:
- Capas, material o profundidad; contraste y fallback:
- Tipografía o etiquetas que requieren precisión:
- Alternativa sin gesto y con movimiento reducido:
- Patrones descartados y motivo:
- Evidencia de rendimiento y acceso equivalente prevista:

### Contrato de tokens semánticos
- Convención técnica del proyecto:
- Tokens existentes reutilizados:
- Roles nuevos aprobados y su propósito:
- Valores locales excepcionales y motivo:

## Componentes mínimos y estados
- Inventario de componentes reutilizados o necesarios:
- Componentes descartados o no justificados:

## Componentes y estados
| Elemento o flujo | Estado base | Carga/progreso | Vacío | Error y recuperación | Éxito | Deshabilitado | Foco, activo y sobreflujo |
| --- | --- | --- | --- | --- | --- | --- | --- |

## Diseño adaptable y acceso equivalente
- Compacto: reflujo, navegación, densidad, acciones táctiles y sobreflujo.
- Intermedio: cambios de composición y prioridades.
- Amplio: uso de espacio, densidad y persistencia de navegación.
- Teclado y foco: orden, foco visible, overlays, Escape y devolución de foco cuando apliquen.
- Semántica y mensajes: nombres accesibles, estados y errores comprensibles.
- No depender solo del color:
- Movimiento: propósito y comportamiento con `prefers-reduced-motion`.

## Observaciones y aprobación
### Feedback incorporado
-

### Supuestos y pendientes
-

### Aprobación
- Fecha:
- Persona que aprueba:
- Alcance de la aprobación: diseño | planificación | implementación
- Observaciones:

## Validación prevista para la implementación
- Escenarios funcionales:
- Responsive:
- Teclado, foco y semántica:
- Contraste y estados:
- Movimiento reducido:
- Capturas o revisión visual:

## Evidencia de revisión en ejecución
| Fecha | Cambio o flujo | Entorno y ruta | Evidencia | Resultado | Desviación aprobada o seguimiento |
| --- | --- | --- | --- | --- | --- |

> Usa una ficha de revisión visual basada en la plantilla del sistema, o el mecanismo equivalente del proyecto, para el detalle. Una desviación material requiere actualizar esta dirección y la aprobación que corresponda.

## Regresión visual automatizada (solo si aplica)
- Playwright o capacidad equivalente aprobada:
- Contrato de escenarios y baselines:
- Decisiones de diseño protegidas por captura:
- Entorno consistente, datos deterministas y elementos dinámicos controlados:
- Diferencias pendientes, aprobaciones y límites:

> La automatización no sustituye la revisión de la aplicación ejecutándose ni valida por sí sola teclado, semántica, comprensión o hardware real.
