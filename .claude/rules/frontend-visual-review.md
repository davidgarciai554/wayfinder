# Revisión visual de frontend

> Regla de proyecto. Copia este archivo en `.claude/rules/frontend-visual-review.md`.

## Cuándo aplica

Tras un cambio que altere interfaz, interacción, contenido visible, estado, comportamiento adaptable o accesibilidad, revisa el resultado en la aplicación ejecutándose antes de declararlo finalizado. El alcance es proporcional al cambio y se contrasta con `docs/design/DESIGN.md`, los tokens y los componentes del proyecto.

## Descubrimiento antes de revisar

- Descubre la vía real de ejecución, URL o ruta, datos de prueba, tamaños disponibles y validaciones del repositorio. No inventes comandos, dispositivos ni herramientas.
- Reutiliza el mecanismo ya disponible —navegador, preview, Storybook, emulador, dispositivo o prueba end-to-end— sin imponer una dependencia nueva solo para cerrar un cambio pequeño.
- Si la aplicación no puede ejecutarse, registra qué lo bloquea, qué queda sin comprobar y cómo se podría verificar. No sustituyas la evidencia real por una afirmación o una descripción del código.

## Qué comprobar

- Compara composición, jerarquía, densidad, patrones, tokens, tipografía, superficies, acciones y responsive con las decisiones aplicables de `DESIGN.md`.
- Recorre el flujo afectado con contenido suficientemente realista y los estados que existan: carga, vacío, error y recuperación, éxito, deshabilitado, foco, activo y sobreflujo.
- Revisa comportamiento compacto, intermedio y amplio cuando el cambio pueda afectarlo; no conviertas una etiqueta de breakpoint en evidencia.
- Verifica acceso equivalente cuando aplique: teclado, foco visible y ordenado, semántica y mensajes, contraste y significado no solo por color, y movimiento reducido.
- Si el repositorio usa Playwright o ha aprobado su incorporación, selecciona escenarios estables de alto valor y aplica la regla `frontend-regresion-visual.md`; la automatización complementa esta revisión, no la sustituye.
- Una desviación material no se oculta: explica la causa, propone actualizar la implementación o `DESIGN.md` y solicita la aprobación exigida por las reglas del proyecto.

## Evidencia de cierre

Registra la revisión en una ficha de revisión visual basada en la plantilla del sistema, o en el mecanismo equivalente del repositorio. Distingue siempre entre **conforme**, **desviación**, **no aplicable** y **bloqueado**.

Al cerrar, informa:

- entorno, ruta o escenario realmente revisado;
- decisiones y estados comprobados;
- tamaños o contextos revisados;
- evidencia disponible y limitaciones;
- desviaciones, seguimiento y actualizaciones necesarias de diseño, tokens o componentes.
