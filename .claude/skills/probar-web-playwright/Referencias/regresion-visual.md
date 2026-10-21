# Regresión visual con Playwright

> Complemento de pruebas funcionales y revisión manual. Basado en la documentación oficial de Playwright: [comparaciones visuales](https://playwright.dev/docs/test-snapshots), [aserciones](https://playwright.dev/docs/test-assertions), [servidor web](https://playwright.dev/docs/test-webserver) y [proyectos](https://playwright.dev/docs/test-projects). Adáptalo a la configuración existente del repositorio.

## Cuándo merece un baseline

Incluye una captura solo si protege una decisión visual que sería fácil romper y difícil detectar con una aserción funcional:

- jerarquía, densidad o composición del flujo principal;
- comportamiento compacto/intermedio/amplio aprobado;
- un estado vacío, error, éxito o carga con diseño específico;
- un diálogo, menú, panel o overlay relevante;
- tokens, contraste o estructura de navegación que formen parte de `DESIGN.md`.

No la uses para sustituir pruebas funcionales, para cada pantalla por inercia ni para detalles que cambian legítimamente en cada ejecución.

## Estabilidad antes de capturar

| Fuente de variación | Control mínimo y explícito |
| --- | --- |
| Datos, fecha, zona horaria o aleatoriedad | Fixture, semilla, reloj o datos estables del sistema de pruebas. |
| Red, APIs o servicios externos | Mock o entorno de pruebas ya aprobado por el repositorio. |
| Fuentes y renderizado | Baseline y ejecución en entorno, proyecto y navegador consistentes. |
| Carga asíncrona | Esperar un estado observable mediante aserciones de reintento. |
| Animación | Reducir o esperar solo la animación que impida una imagen estable; conservar cobertura funcional de movimiento. |
| Elemento volátil localizado | Enmascarar u ocultar solo ese elemento y documentar por qué. |

No ocultes regiones amplias, no relajes umbrales de diferencia sin evidencia y no generes la baseline en un equipo para validarla en otro entorno incompatible. La documentación de Playwright advierte diferencias por sistema operativo, navegador, fuentes, hardware, alimentación y modo headless.

## Diseño de escenarios

Cada prueba visual indica:

1. decisión de `DESIGN.md` que protege;
2. ruta o interacción que deja la interfaz en estado verificable;
3. datos y precondiciones;
4. proyecto de Playwright y viewport; no confundas emulación con validación en hardware;
5. aserción funcional que confirma que el estado correcto está visible;
6. captura de página o componente con nombre estable;
7. evidencia para revisar un baseline nuevo o una diferencia.

Mantén una cobertura pequeña y con alto valor. Empieza por un flujo representativo y sus estados más riesgosos; amplíala cuando una regresión real pruebe que falta un escenario.

## Baselines y diferencias

- Los baselines se versionan junto a la prueba, conforme a la convención de Playwright y del repositorio.
- La primera generación produce una propuesta de referencia, no una aprobación automática.
- Ante una diferencia: revisa el diff, el estado funcional, contenido, viewport y la decisión aplicable de `DESIGN.md`.
- Actualizar baselines requiere motivo explícito: corrección aprobada, evolución aprobada del diseño o cambio de plataforma deliberado. Registra el vínculo en la revisión/PR/registro que use el proyecto.
- Si el cambio no era intencionado, corrige la implementación en vez de actualizar el baseline.

## Relación con revisión manual

El snapshot compara imagen; no garantiza usabilidad, teclado, lector de pantalla, interacción táctil, rendimiento percibido ni comprensión. Mantén la revisión de la aplicación ejecutándose para cambios materiales y usa sus hallazgos para decidir nuevos escenarios automatizables.
