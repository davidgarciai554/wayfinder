# Patrones de frontend

Este catálogo no es una galería de estilos ni prescribe una estética. Selecciona el patrón que reduce fricción para la tarea y documenta el motivo en `DESIGN.md`. Combina solo patrones compatibles; no introduzcas un patrón por tendencia.

## Patrones de estructura

| Patrón | Úsalo cuando | Decisiones obligatorias | Evítalo cuando |
| --- | --- | --- | --- |
| App shell | Existe trabajo recurrente entre áreas o herramientas. | Navegación, orientación, área de trabajo, acciones globales y versión móvil. | Una página única o un flujo lineal no necesita navegación persistente. |
| Maestro-detalle | Hay una colección que se explora y se actúa sobre un elemento. | Selección, preservación de contexto, estado sin selección y móvil. | El detalle es una tarea larga e independiente. |
| Flujo por pasos | El orden de acciones importa y hay validación progresiva. | Progreso real, volver, guardar/salir, errores por paso y resumen. | Los campos son independientes o el usuario necesita acceso no lineal. |
| Panel operativo | Hay datos, alertas y acciones que deben vigilarse con frecuencia. | Prioridad de señales, frecuencia de actualización, densidad y acciones. | Se usa como portada decorativa o para métricas sin decisión asociada. |
| Tabla, lista o tablero | Se comparan, filtran o gestionan muchos elementos. | Ordenación, filtros, selección, vacíos, sobreflujo y versión compacta. | Las tarjetas se usan solo para evitar decidir una estructura de datos. |
| Calendario o agenda | El tiempo, disponibilidad o secuencia temporal es el modelo mental principal. | Zona horaria, navegación temporal, conflictos, intervalos y móvil. | La fecha es solo un atributo secundario. |
| Búsqueda y comando | El usuario debe encontrar o ejecutar acciones rápidamente. | Descubrimiento, atajos, resultados vacíos, foco y cierre. | La navegación normal ya resuelve el acceso sin añadir complejidad. |
| Landing de conversión | Una persona llega por primera vez y debe comprender o actuar sobre una propuesta concreta. | Tesis principal, prueba relevante, CTA, jerarquía y contenido real. | Es una aplicación autenticada, una herramienta o un flujo de trabajo. |

## Patrones de interacción y contenido

| Patrón | Úsalo cuando | Condición de calidad |
| --- | --- | --- |
| Divulgación progresiva | La complejidad existe pero no debe bloquear la tarea inicial. | Lo oculto sigue siendo localizable, accesible y no contiene información crítica inesperada. |
| Acciones contextuales | Una acción solo tiene sentido sobre una selección o estado. | El contexto se hace visible; no se oculta una acción primaria sin descubribilidad. |
| Confirmación proporcional | Una acción es destructiva, costosa o difícil de revertir. | Explica consecuencia y recuperación; no confirma por reflejo cada gesto. |
| Feedback inmediato | Una acción cambia estado o puede tardar. | El resultado, progreso o error aparece cerca de la acción y sigue siendo comprensible. |
| Vacío orientado a acción | No existe contenido todavía. | Explica qué falta, cómo poblarlo y ofrece el siguiente paso real. |
| Error recuperable | Una operación puede fallar. | Explica impacto, conserva el trabajo útil y permite reintentar o corregir. |
| Carga con forma final | La estructura tarda en aparecer. | El esqueleto refleja la disposición esperada; evita un spinner genérico como único feedback cuando la forma importa. |
| Interacción fluida y espacial | El gesto, el movimiento o una capa contextual aclaran relación, destino o estado. | Respuesta inmediata, interrupción, alternativa sin gesto, foco y movimiento reducido; consulta [patrones-apple-web.md](patrones-apple-web.md). |

## Patrones visuales: criterios, no recetas

Selecciona una dirección a partir del producto, sus materiales, su lenguaje y su audiencia. Documenta tipografía, color, composición, profundidad y movimiento; no etiquetes un estilo sin traducirlo a decisiones.

- **Editorial:** apropiado cuando la lectura, secuencia o autoría es central; exige tipografía expresiva y jerarquía real.
- **Instrumental:** apropiado para herramientas, operaciones o datos; exige precisión, densidad controlada y estados inequívocos.
- **Cálido o material:** apropiado cuando confianza, cuidado o experiencia tangible son centrales; exige contención y accesibilidad, no decoración excesiva.
- **Expresivo:** apropiado cuando la marca, cultura o emoción forman parte del valor; exige una composición y un riesgo visual justificables.
- **Sobrio institucional:** apropiado cuando claridad, confianza o normativa prevalecen; exige legibilidad, consistencia y evitar solemnidad vacía.

## Antipatrones

- Aplicar la misma combinación de tarjetas redondeadas, sombras, gradiente y bento sin relación con el contenido.
- Usar una landing con hero, CTA y bloques de prueba como estructura automática de una aplicación.
- Inventar vistas de producto, métricas, actividad en tiempo real o precisión numérica decorativa.
- Usar números, retículas, líneas, etiquetas técnicas, marcos o puntos solo para aparentar diseño.
- Elegir animación, cristal, 3D, blur o texturas antes de definir su función y su coste de comprensión, rendimiento y acceso.
- Depender de color, iconos sin nombre o hover para comunicar información necesaria.
- Apilar secciones idénticas, alternar imagen/texto por inercia o usar contenido de relleno para completar una composición.
- Aplicar un sistema de diseño ajeno sin comprobar que encaja con el producto, la plataforma y los componentes existentes.
