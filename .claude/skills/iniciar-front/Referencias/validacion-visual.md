# Validación visual y de experiencia

Aplica esta comprobación antes de cerrar `/iniciar-front` y úsala como base para la verificación de la implementación posterior. No afirmes una comprobación que no se haya realizado.

## Trazabilidad y dirección

- [ ] Se inventariaron texto, URLs, capturas y contexto del repositorio.
- [ ] Cada referencia distingue observado, inferido y decisión adoptada o descartada.
- [ ] No se copian marca, contenido, assets ni composición literal de terceros.
- [ ] La dirección explica por qué sirve a este producto y no a una interfaz genérica.
- [ ] Se documentaron patrones elegidos, antipatrones y exclusiones.
- [ ] Se formularon preguntas solo para ambigüedades materiales y las suposiciones restantes son visibles.

## Exploración y aprobación

- [ ] La exploración se produjo antes de código y antes del `DESIGN.md` final.
- [ ] Si `/design` estaba disponible, el artifact muestra contenido, jerarquía y estados representativos.
- [ ] Si `/design` no estaba disponible, se declaró y el usuario eligió expresamente esperar o aceptar una alternativa.
- [ ] El feedback del usuario está transcrito en decisiones concretas.
- [ ] Se distingue aprobación de diseño, planificación e implementación.

## Sistema y contenido

- [ ] Hay jerarquía de acciones, contenido y navegación; la estructura representa información real.
- [ ] Paleta, tipografía, espaciado, profundidad e iconografía tienen una decisión explícita.
- [ ] La densidad es apropiada a la tarea; no hay relleno ni datos falsamente precisos.
- [ ] Las acciones principales no dependen exclusivamente de iconos, color u hover.
- [ ] Imágenes, iconos y movimiento cumplen una función, no solo decoración.

## Estados, responsive y acceso equivalente

- [ ] Se definieron los estados aplicables: carga/progreso, vacío, error recuperable, éxito, deshabilitado, foco, activo y sobreflujo.
- [ ] El diseño especifica comportamiento compacto, intermedio y amplio según contenido, no solo nombres de breakpoints.
- [ ] Se documentaron objetivos táctiles, reflujo, orden, navegación y sobreflujo en compacto.
- [ ] El flujo puede completarse con teclado; foco visible, orden lógico y overlays tienen comportamiento definido cuando aplican.
- [ ] Los errores, estados y controles disponen de semántica y mensajes comprensibles.
- [ ] El texto y controles críticos tienen un objetivo de contraste explícito; la información no depende solo del color.
- [ ] El movimiento no es necesario para comprender o completar tareas y respeta `prefers-reduced-motion` al implementarse.

## Evidencia al implementar

La skill no inventa comandos ni herramientas. El repositorio consumidor debe descubrir sus validaciones reales. Como mínimo, el plan de implementación deberá exigir evidencia proporcional de:

- flujo principal y estados de error/vacío;
- revisión en tamaños compacto, intermedio y amplio;
- navegación por teclado y foco;
- contraste y texto largo/zoom cuando aplique;
- reducción de movimiento cuando haya animaciones;
- capturas o revisión de la aplicación ejecutándose, cuando sea viable.
