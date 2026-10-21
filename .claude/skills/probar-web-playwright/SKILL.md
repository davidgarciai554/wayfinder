---
name: probar-web-playwright
description: Prueba una aplicación web con Playwright, cubriendo flujos funcionales, estados, acceso equivalente y, cuando sea viable, regresión visual con baselines revisados. Úsala para crear, ampliar, ejecutar o revisar tests web de Playwright.
---

# Probar web con Playwright

Esta skill complementa a la skill oficial `playwright-cli` instalada por Playwright: define el contrato de producto, diseño y aprobación de regresión visual alrededor de su automatización. Prioriza comportamiento funcional, acceso equivalente y datos controlados; añade regresión visual solo cuando una captura estable pueda detectar una decisión de diseño relevante. No instala Playwright, no inventa configuración ni sustituye la revisión manual de la aplicación ejecutándose.

Se instala sin cambios en `.claude/skills/probar-web-playwright/` y se invoca como `/probar-web-playwright`.

## Descubrimiento obligatorio

Antes de editar o ejecutar:

1. Lee las instrucciones del repositorio, `ERRORES.md` si existe, `docs/design/DESIGN.md` cuando afecte a interfaz, reglas locales y pruebas existentes.
2. Comprueba si Playwright ya está instalado, cómo se ejecuta, su configuración, proyectos, `baseURL`, servidor, reportes, fixtures, autenticación, datos de prueba y snapshots existentes.
3. Identifica el flujo, persona/rol, precondiciones, datos controlados, estados aplicables, tamaño/dispositivo y criterio observable de éxito.
4. Si falta Playwright o el proyecto no puede ejecutar una web de forma controlada, no presupongas una instalación. Explica la capacidad ausente y propón un plan específico para añadirla conforme al proceso del repositorio.
5. Nunca uses credenciales reales, producción ni datos personales como atajo. Usa el mecanismo de test ya establecido o solicita una decisión si no existe uno.

## Diseña primero la prueba funcional

- Un test debe comprobar un resultado observable del usuario, no clases CSS, detalles internos ni pausas temporales arbitrarias.
- Selecciona locators por rol, nombre accesible, etiqueta o texto relevante; usa `data-testid` solo cuando la semántica no permita un selector estable y siguiendo la convención local.
- Prefiere aserciones de Playwright que reintentan antes de introducir esperas fijas. Espera estados o resultados, no milisegundos.
- Cubre el flujo principal y los estados afectados: carga, vacío, error y recuperación, éxito, deshabilitado, foco, overlays o sobreflujo cuando correspondan.
- Recorre teclado, foco, semántica, mensajes y acciones equivalentes cuando el cambio sea interactivo o accesible.
- Mantén cada caso independiente y con precondiciones explícitas; no dependas del orden de pruebas, del reloj real, red pública, contenido aleatorio o estado dejado por otro test.

## Añade regresión visual solo si procede

Consulta [regresion-visual.md](Referencias/regresion-visual.md) y el contrato de regresión visual del proyecto.

Selecciona una comparación visual cuando el escenario sea estable y pueda detectar una decisión material de `DESIGN.md`: jerarquía, reflujo, estado vacío/error, diálogo, densidad, tokens, navegación o una composición aprobada. No captures pantallas por volumen ni para validar cada pixel de una animación.

Antes de crear o actualizar un baseline, define:

- escenario, ruta, precondiciones y datos deterministas;
- proyecto/navegador, viewport, modo de color, fuentes y entorno donde se generará;
- qué parte visual protege y qué elementos dinámicos se controlan o se excluyen de forma limitada;
- relación con una decisión de `DESIGN.md`;
- responsable de revisión de la imagen inicial o de la diferencia.

Una diferencia visual es una señal para investigar: no ejecutes una actualización masiva ni aceptes un baseline nuevo sin revisar el diff, el flujo y la decisión de diseño correspondiente.

## Ejecución y cierre

1. Descubre el comando real de la prueba y ejecuta primero el caso o proyecto más específico.
2. Si falla, conserva la salida, trace, screenshot, vídeo o reporte que el repositorio produzca; consulta y actualiza `ERRORES.md` si se trata de un error relevante.
3. Ejecuta las validaciones adicionales proporcionales que ya existan en el repositorio.
4. Verifica visualmente la aplicación en ejecución cuando la regla `frontend-visual-review.md` lo requiera. Un snapshot aprobado no equivale por sí solo a revisión de experiencia.
5. Informa con precisión: configuración/entorno usado, casos ejecutados, estado de los baselines, evidencia, diferencias revisadas, límites y lo que no se pudo comprobar.

## Límites

- No crees `playwright.config.*`, `webServer`, proyectos de navegador, fixtures, comandos `npm`, snapshots, CI ni archivos de prueba sin haber analizado el stack y la configuración existentes.
- No fijes umbrales de píxeles, ocultes toda la página dinámica ni desactives animaciones indiscriminadamente para hacer pasar una prueba. Cada control debe ser mínimo, visible y justificado.
- No actualices snapshots con un cambio de interfaz no aprobado; si contradice `DESIGN.md`, propón la decisión y solicita la aprobación definida por el proyecto.
- Playwright emula dispositivos y navegadores; no afirmes que sustituye la comprobación en hardware real cuando esta sea necesaria.

## Preflight

Antes de declarar terminada la tarea, comprueba [regresion-visual.md](Referencias/regresion-visual.md) y marca: escenarios ejecutados, evidencia disponible, datos/entorno deterministas, estados no aplicables, diferencias y aprobaciones. Declara los bloqueos reales en vez de inventar una ejecución.
