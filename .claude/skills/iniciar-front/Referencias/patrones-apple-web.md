# Patrones Apple adaptados al frontend web

> Referencia opcional. Úsala cuando la tarea requiera interacción directa, controles gestuales, transiciones espaciales, capas persistentes, alta sensibilidad tipográfica o una dirección inspirada en productos de plataforma. No convierte una interfaz en una copia de Apple ni prescribe su apariencia.
>
> Inspirada, de forma sintetizada y adaptada, por `apple-design` de [emilkowalski/skills](https://github.com/emilkowalski/skills), bajo licencia [MIT](https://github.com/emilkowalski/skills/blob/main/LICENSE). Esta guía no reproduce su texto ni código; traduce criterios a decisiones que deben justificarse por el producto.

## Cómo elegirlos

Antes de seleccionar un patrón, confirma:

- qué tarea o contenido se beneficia de una relación espacial o directa;
- si la plataforma admite con fiabilidad puntero, táctil, teclado y/o movimiento;
- la alternativa estática o reducida para quien no pueda, no quiera o no necesite movimiento;
- cómo se comprobarán rendimiento, interrupción, foco y comprensión en ejecución.

Si el movimiento no aclara estado, destino, jerarquía o resultado de una interacción, no lo añadas.

## Respuesta e interacción directa

| Patrón | Úsalo cuando | Decisiones obligatorias | Evítalo cuando |
| --- | --- | --- | --- |
| Respuesta inmediata | Una persona pulsa, arrastra o modifica un control. | Feedback visible al iniciar, latencia tolerable, estado durante la operación y error recuperable. | El feedback solo aparece al terminar o se añade un retardo decorativo. |
| Manipulación 1:1 | El objeto puede desplazarse, redimensionarse, deslizarse o ajustarse directamente. | El objeto sigue el punto de agarre, límites, cancelación, teclado equivalente y objetivo táctil. | Un botón o selección simple comunica mejor la intención. |
| Interrupción continua | Una transición, panel o control puede recibir una nueva intención antes de terminar. | Desde qué valor y velocidad se retoma, qué pasa al cancelar y cómo se conserva el contexto. | La acción es discreta, destructiva o requiere una confirmación explícita. |
| Resistencia progresiva | Un arrastre llega a un límite físico o lógico. | Umbral, resistencia visible, punto de retorno, alternativa con teclado y ausencia de sorpresa. | Un límite claro es más comprensible o el gesto puede bloquear una tarea. |

## Movimiento y continuidad espacial

| Patrón | Úsalo cuando | Decisiones obligatorias | Evítalo cuando |
| --- | --- | --- | --- |
| Trayectoria anclada | Un menú, detalle, hoja o superposición nace de un control o elemento conocido. | Origen visual, destino, retorno, foco y relación semántica con el activador. | La capa representa un cambio de contexto completo o su origen no aporta comprensión. |
| Continuidad de dirección | Entrada y salida explican hacia dónde va o de dónde vuelve el contenido. | Dirección coherente con navegación, historial y lectura; reversión predecible. | Se alternan direcciones por efecto visual. |
| Movimiento con propósito | Un cambio de estado, jerarquía o relación merece una transición. | Qué explica, duración proporcional, qué ocurre al interrumpir y versión reducida. | Es solo una animación de entrada, celebración automática o relleno de identidad. |
| Proyección de intención | Un control de arrastre se completa según distancia y velocidad de un gesto. | Umbrales claros, recuperación si no se alcanza, resultado reversible y equivalente no gestual. | El resultado puede ser ambiguo, costoso o irreversible. |

No elijas una curva, muelle o duración por moda. Define el comportamiento desde el estado actual, permite invertirlo cuando tenga sentido y valida que no haya saltos, cortes ni esperas artificiales.

## Capas, materiales y profundidad

| Patrón | Úsalo cuando | Decisiones obligatorias | Evítalo cuando |
| --- | --- | --- | --- |
| Jerarquía por capas | Existe una tarea modal, un panel paralelo o controles flotantes con relación clara al contenido. | Qué bloquea, qué conserva el contexto, backdrop o separación, Escape, foco y devolución de foco. | Una tarjeta o barra se vuelve flotante solo para parecer sofisticada. |
| Material translúcido funcional | El chrome debe permitir percibir continuidad del contenido sin perder legibilidad. | Contraste sobre contenido variable, fallback, rendimiento, límites de blur y modo de alto contraste si aplica. | La translucidez reduce legibilidad o no comunica relación espacial. |
| Separación contextual | Una capa necesita diferenciarse de un fondo visualmente activo. | Intensidad proporcional, borde/sombra/material y prueba sobre los contenidos reales. | Se aplican sombras pesadas o bordes permanentes como estilo automático. |
| Borde de desplazamiento | Una cabecera o barra flotante se solapa con contenido desplazable. | Cuándo aparece, cómo mantiene legibilidad y qué sucede sin scroll. | Se añade un divisor duro sin solapamiento real. |

## Tipografía y contenido

- Ajusta tamaño óptico, interlineado, anchura, peso y espaciado entre letras a la escala y al contexto de lectura; no apliques una cifra fija a toda la jerarquía.
- La tipografía prioriza lectura, escaneado y densidad apropiada. No uses tamaños enormes ni tracking extremo como sustituto de una jerarquía de información.
- Emplea etiquetas directas y específicas para contenidos y acciones. Un nombre genérico no se vuelve claro por estar acompañado de un icono.
- Prueba con texto largo, traducciones previsibles, números reales y estados vacíos antes de validar la composición.

## Acceso equivalente y rendimiento

- Todo gesto tiene una acción de teclado, control visible o alternativa equivalente que completa el mismo trabajo.
- Respeta `prefers-reduced-motion`: reduce o elimina movimiento no esencial sin eliminar información, foco ni posibilidad de completar el flujo.
- El sonido o la respuesta háptica son complementarios, nunca el único feedback; solo se consideran si la plataforma y el producto ya los soportan.
- La animación actualiza propiedades adecuadas y mantiene la interfaz utilizable durante la transición. Si hay degradación de frames, simplifica o elimina el efecto.
- Los overlays mantienen orden de foco, cierre explícito y retorno al activador cuando corresponda.

## Registro en `DESIGN.md`

Al adoptar uno o varios patrones, registra:

1. patrón y tarea que mejora;
2. interacción o comportamiento preciso, incluido cancelación y estados límite;
3. alternativa sin gesto o con movimiento reducido;
4. restricciones de acceso, rendimiento y contenido;
5. evidencia prevista: escenario, tamaño, dispositivo o método de revisión;
6. patrón descartado y motivo si la decisión era material.
