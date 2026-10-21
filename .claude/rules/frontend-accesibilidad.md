# Accesibilidad frontend

> Regla de proyecto. Copia este archivo en `.claude/rules/frontend-accesibilidad.md` para aplicarlo a las sesiones de Claude Code del repositorio.

## Cuándo aplica y límites

Aplica al crear o modificar una interfaz, interacción, flujo, formulario, componente, contenido visible, estado, overlay o comportamiento adaptable. Conserva un acceso equivalente a la tarea para las modalidades y estados realmente afectados.

Esta es una regla preventiva de implementación: no ejecuta pruebas, no certifica WCAG, compatibilidad con tecnologías asistivas ni cumplimiento legal. No presupone framework, navegador, lector de pantalla, herramienta, métrica, dependencia ni configuración. Las instrucciones locales, `docs/design/DESIGN.md` cuando exista, reglas por ruta y controles más específicos prevalecen.

## Diseña e implementa sin introducir barreras

1. Antes de cambiar, descubre el flujo, los estados, los componentes, los tokens, el contenido, las interacciones y los contratos de accesibilidad ya existentes. Si falta una decisión que altere el acceso a una tarea, no la sustituyas por una suposición.
2. Cuando una acción sea operable con puntero, hover, arrastre o gesto, proporciona una alternativa equivalente cuando la interacción afecte a una tarea o información. No escondas la única vía de una acción relevante tras hover, color, icono sin nombre, placeholder, movimiento o gesto complejo.
3. Mantén controles semánticos y nombres, etiquetas, instrucciones, relaciones y mensajes comprensibles para el contexto. No simules un control nativo sin conservar su comportamiento de interacción, estado y disponibilidad aplicables.
4. Conserva navegación por teclado, foco visible y orden de foco coherente. En diálogos, menús, paneles y otros overlays, preserva activación, cierre y devolución de foco acordes al patrón existente.
5. Presenta carga, vacío, error, validación, éxito, selección, deshabilitado, foco y recuperación de forma perceptible y operable cuando existan. No comuniques un estado o error solo mediante color, posición, animación o un cambio que desaparezca antes de poder comprenderse.
6. Si el cambio afecta a adaptación, revisa que texto largo, zoom, viewport reducido, sobreflujo, controles táctiles, tablas o formularios conserven la tarea aplicable. Si incorpora movimiento, respeta la preferencia de movimiento reducido o una alternativa equivalente.

## Comprobación y derivación

- Aplica `frontend-design.md`, `frontend-tokens-componentes.md` y `frontend-visual-review.md` cuando estén instaladas. La revisión en ejecución comprueba el resultado; no sustituye las decisiones preventivas de esta regla.
- Descubre la vía real de ejecución y las comprobaciones disponibles. Reutiliza las capacidades existentes; no instales ni impongas herramientas para cubrir un cambio pequeño. Si no es viable comprobar una interacción o estado relevante, declara qué queda **bloqueado/no verificado**, por qué y qué permitiría verificarlo.
- Para una auditoría independiente de una interfaz existente, usa `/auditar-accesibilidad-front`. La auditoría no autoriza ni realiza correcciones; los cambios no triviales siguen el proceso de planificación aplicable.
- Al cerrar, indica el flujo, interacciones, estados y contextos realmente comprobados, la evidencia disponible y los límites. No declares cobertura de lectores de pantalla, dispositivos o cumplimiento normativo sin una prueba y alcance específicos.

Esta regla no sustituye diseño, revisión visual, pruebas funcionales, auditoría de accesibilidad, seguridad y datos ni los controles del proyecto.
