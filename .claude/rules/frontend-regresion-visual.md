# Regresión visual con Playwright

> Regla de proyecto. Copia este archivo en `.claude/rules/frontend-regresion-visual.md` solo si el repositorio ya usa Playwright o se ha aprobado explícitamente su incorporación.

## Habilitación

Antes de crear pruebas visuales, descubre la configuración real de Playwright, comando, proyectos, navegador, servidor, datos de prueba, autenticación, reportes y baselines. Si no existe una aplicación web reproducible o una configuración Playwright aprobada, no inventes archivos ni dependencias: propone el plan específico para incorporarlos.

## Selección y diseño

- Automatiza solo escenarios visuales estables y de valor alto vinculados a `docs/design/DESIGN.md`: composición, responsive, estado, overlay, navegación o tokens que una captura pueda proteger.
- Toda captura va precedida por un flujo y una aserción funcional que demuestren el estado correcto. Usa locators accesibles y aserciones con reintento conforme a las convenciones del repositorio.
- Define datos deterministas, precondiciones, viewport/proyecto, modo de color, fuentes y entorno consistente. Playwright advierte que la renderización puede variar entre sistemas, navegadores y configuraciones.
- Trata contenido dinámico de forma mínima y explícita. No enmascares regiones amplias, no ocultes problemas ni subas umbrales de diferencia por comodidad.

## Baselines y diferencias

- Versiona baselines junto a las pruebas de acuerdo con la convención del repositorio.
- La primera imagen y cualquier actualización requieren revisión humana contra `DESIGN.md`; una ejecución exitosa no es aprobación de diseño.
- No ejecutes actualizaciones masivas de snapshots. Ante una diferencia, determina si es defecto, cambio de plataforma deliberado o evolución aprobada; documenta el motivo y la aprobación.
- Conserva la revisión manual de aplicación en ejecución exigida por `frontend-visual-review.md` cuando sea proporcional. Un pixel diff no demuestra teclado, semántica, comprensión ni uso en hardware real.

## Cierre

Registra escenarios, entorno, baselines, diferencias, elementos dinámicos controlados, limitaciones y aprobaciones en el contrato de regresión visual del proyecto o en su equivalente. Declara escenarios bloqueados o no aplicables; no los conviertas en cobertura ficticia.
