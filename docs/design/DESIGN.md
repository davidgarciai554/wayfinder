# Diseño: web local de Wayfinder (`wayfinder serve`)

> Estado: aprobado
>
> Este documento es la fuente de verdad de diseño para la web local de Wayfinder. Debe leerse antes de modificar su interfaz (`web/`).

## Propósito y alcance
- **Producto o área:** web local de Wayfinder, servida por `wayfinder serve` en `127.0.0.1` o desde la imagen Docker.
- **Objetivo de la interfaz:** ver el estado de los proyectos que Claude Code mantiene. En el incremento 5 se suma crear tareas y aprobar o descartar ideas.
- **Persona, contexto y plataforma:** una sola persona, en Windows 11 con un navegador de escritorio. Sobre todo mira; a veces decide sobre propuestas. El móvil solo tiene que "no romperse".
- **Trabajo principal:** saber de un vistazo qué está en curso, qué falta y qué propuestas esperan una decisión.
- **Incluido:**
  - incremento 4: tablero, detalle de tarea, bitácora, capturas y página del proyecto, con autorefresco;
  - incremento 5: crear tarea, aprobar y descartar con confirmación;
  - registro de errores (plan `Planes/2026-10-23-registro-de-errores.md`): pestaña «Errores» de solo lectura, con su detalle, y la lista de errores dentro de cada tarea.
- **Excluido:** edición libre de tareas, búsqueda (la memoria se consulta con `wf_search` desde Claude; plan `Planes/2026-10-22-bitacora-enlazada-e-historial.md`), arrastrar como única vía, varios usuarios, selector manual de tema.
- **Señal observable de éxito:** abrir la web y, sin desplazarse en una pantalla de 1440 px, ver las propuestas sin aprobar y las tareas en curso. Todo el flujo se puede completar con teclado.

## Entrada y referencias
### Petición original
- **Resumen fiel:** web local con kanban por proyecto, vista de tarea renderizada, bitácora, galería de capturas, aprobación o descarte de ideas y creación de tareas, que se refresca sola. Requisitos de accesibilidad del plan `Planes/2026-10-21-wayfinder-mvp.md` (v3). Más tarde, el usuario pidió "una paleta de colores parecida a la de la web de Claude".

### Referencias examinadas
| Fuente | Tipo | Observado | Inferido | Decisión adoptada o descartada | Limitación |
| --- | --- | --- | --- | --- | --- |
| Paleta de marca de Claude, referencia `brand-colors.md` del tipo de lienzo Design | Documento de colores | Marfil `#FAF9F5`, pizarra `#141413`, arcilla `#D97757`, escala de grises cálidos de 21 pasos, azul de acción `#2A78D6`, bordes derivados de la pizarra | Calidez y un único acento sostienen la identidad | **Adoptado:** marfil, pizarra, grises cálidos y arcilla como único acento; serifa en los títulos. **Descartado:** logotipo, fuentes propias de Anthropic y cualquier marca o texto de Claude | Las fuentes de Anthropic no están instaladas; se usan Georgia y Segoe UI |
| Plan v3 | Requisitos | Criterios de accesibilidad, estados, CSP estricta, sin build | — | Adoptados como restricciones | — |

### Exploración visual
| Artifact, enlace o versión | Dirección evaluada | Decisión extraída | Estado |
| --- | --- | --- | --- |
| https://claude.ai/artifact/1REgJeY3TUesVRvp2iJoWe, v7 | "Instrumental y tranquila", papel gris y acento azul tinta | Estructura, estados y componentes | Sustituida por v8 |
| Mismo lienzo, v8 ("Paleta inspirada en Claude") | Marfil, pizarra y arcilla; serifa en títulos; seis tableros (paleta, tablero claro y oscuro, detalle, móvil, diálogos) | Dirección completa | **Aprobada** por el usuario el 2026-10-21 |

## Dirección de diseño aprobada
- **Idea rectora:** una herramienta de consulta cálida y tranquila. Los datos mandan, la decoración no.
- **Personalidad y tono:** sereno, legible y preciso. Textos breves en el idioma configurado.
- **Densidad de información:** media-alta. Tarjetas compactas con el ID, la prioridad y la fecha en monoespaciada.
- **Principio de composición:** columnas de estado como listas; el detalle de la tarea se abre en un modal sobre el tablero (decisión del usuario, 2026-10-22).
- **Dirección que se evita:** bento, gradientes, cristal, sombras decorativas, hero, métricas inventadas y emojis.
- **Riesgo visual deliberado:** la serifa en los títulos dentro de una herramienta. Da carácter y separa jerarquías sin añadir color.

## Arquitectura e interacción
- **Navegación y orientación:**
  - barra superior con «Wayfinder», selector de proyecto (`<select>`) y pestañas **Tablero · Bitácora · Errores · Capturas · Proyecto** (`<nav>`, con `aria-current`);
  - rutas por hash, con segmentos fijos en inglés que no dependen del idioma configurado: `#/<slug>/board`, `#/<slug>/task/<ID>`, `#/<slug>/log`, `#/<slug>/errors`, `#/<slug>/errors/<ERR-n>`, `#/<slug>/assets`, `#/<slug>/project`;
  - el botón de atrás funciona.
- **Inicio:** con un proyecto se abre su tablero; con varios, una lista de proyectos con contadores por estado.
- **Jerarquía de contenidos:**
  - el nombre del proyecto es el `h1` de la página;
  - las columnas son `h2` con recuento;
  - en el detalle, el título de la tarea es el encabezado principal del modal (`h1`), con «Descripción», «Historial» y «Errores (n)» como `h2`;
  - en «Errores», el `h1` es «Errores» y «Abiertos» y «Resueltos» son `h2` con recuento; en el detalle de un error, su título es el `h1` y cada campo es un `h2`.
- **Flujo principal:** abrir el tablero → ver las columnas → abrir una tarea → volver.
- **Flujo de errores:** el detalle de un error es una página, no un modal (no se apilan dos diálogos y el registro puede ser largo). Desde la tarea se abre el error (el modal se cierra) y «Atrás» vuelve a la tarea con el foco en el enlace del error. Desde el error se abre su tarea como modal; Esc o «Cerrar» vuelven al error con el foco en el enlace de la tarea.
- **Acciones:**
  - incremento 4: el enlace a la tarea, «Mostrar descartadas» y «Ver todas las hechas»;
  - incremento 5: «Nueva tarea» como acción principal, y «Aprobar» y «Descartar» en las propuestas.
- **Patrones seleccionados:** app shell mínimo, tablero como lista de columnas, detalle en modal, vacío orientado a acción, error recuperable, confirmación proporcional (solo para descartar) y feedback inmediato.
- **Patrones descartados:**
  - arrastrar y soltar, porque no aporta a un uso sobre todo de lectura y exige una alternativa de todos modos;
  - el panel lateral para el detalle: sustituido el 2026-10-22 por un modal a petición del usuario, para ver toda la información de la tarea bien estructurada. El riesgo de leer tareas largas se mitiga con un modal ancho (hasta 1000 px), desplazamiento dentro del modal y pantalla completa en compacto;
  - confirmar la aprobación, porque es reversible.

## Sistema visual
### Color y superficies
- **Superficie y fondo:**

  | Elemento | Claro | Oscuro |
  | --- | --- | --- |
  | Fondo | marfil `#FAF9F5` | `#1F1E1D` |
  | Superficie (tarjetas, paneles) | `#FFFFFF` | `#262624` |
  | Columna | `#F0EEE6` | `#1A1918` |
  | Borde | `#DEDCD1` | `#3D3D3A` |
  | Borde de control | `#87867F` | `#73726C` |

- **Texto:** pizarra `#141413` y texto suave `#5E5D59` en claro; `#F0EEE6` y `#B0AEA5` en oscuro.
- **Acción y énfasis:**
  - en claro, arcilla oscura `#A04E31` para texto, pestaña activa, foco y botón principal (texto blanco); el estado *hover* es `#7F3D26`;
  - la arcilla `#D97757` solo como decoración (franja de «En curso», punto de estado);
  - en oscuro, arcilla `#D97757` con texto pizarra en el botón principal;
  - fondo suave del acento: `#F5E6DF` en claro y `#33241E` en oscuro.
- **Estados semánticos** (texto / fondo / borde, claro → oscuro):

  | Estado o aviso | Claro | Oscuro |
  | --- | --- | --- |
  | Sin aprobar | `#6B5410` / `#F7EFD2` / borde discontinuo `#C9A82D` | `#E5C76B` / `#3A3218` |
  | Por hacer (azul pizarra desde el 2026-10-22, antes gris neutro; más apagado que el azul de «Aprobada por chat») | `#3F5A7A` / `#E6ECF2` / borde `#A9BBCF` | `#A9BFD8` / `#232B33` / borde `#3F4F61` |
  | En curso | `#A04E31` / `#F5E6DF` | `#E89A7E` / `#33241E` |
  | Hecha | `#4E5E39` / `#E9EEE1` | `#A9BE8A` / `#2A3222` |
  | Descartada (tachada) | `#5E5D59` / `#F0EEE6` (ajustado de `#73726C`, que daba 4,15:1) | `#B0AEA5` / `#262624` |
  | Aprobada por chat (azul para no confundirse con el acento) | `#1F5FAE` / `#FFFFFF` / borde `#B9D0EE` | `#8BB6EC` / borde `#35507A` |
  | Aprobada pese a aviso (con icono de advertencia) | `#A63D2E` / `#F8E1DC` / borde `#E4B5AB` | `#F0A08F` / `#3E2420` |
  | Modificada fuera de Wayfinder | `#5E5D59` / `#FFFFFF` / borde `#87867F` | — |
  | Peligro (descartar) | `#B43A2B` | `#F09383` |
- **Color por columna** (petición del usuario, 2026-10-22): cada columna de estado lleva una franja superior de 4 px y el contador como píldora de su estado. Franjas, ≥ 3:1 sobre el fondo de página y de columna: Propuestas `#A87B00` / `#E2B93B`, Por hacer `#3E6EA8` / `#86AEE0`, En curso `#C0573A` / `#E8876A`, Hechas `#4A7D32` / `#93C46F` (claro / oscuro); Descartadas usa su color de texto. El nombre de la columna sigue siendo el que da el significado.

- **Contraste objetivo:** texto ≥ 4,5:1; bordes de control, foco e iconos ≥ 3:1, en los dos temas. Se mide al implementar.

### Tipografía y espaciado
- **Familias:**
  - títulos: `Georgia, 'Times New Roman', serif`;
  - texto: `'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif`;
  - IDs y fechas: `'Cascadia Mono', Consolas, monospace`.

  Son fuentes del sistema: la CSP no permite fuentes externas.
- **Escala:** serifa 26 (título de tarea), 24 (h1 del proyecto) y 21 (columnas y secciones); sans 16 (lectura), 14 (interfaz y tarjetas, 500 en títulos de tarjeta) y 13 (etiquetas); mono 12–13. Peso de la serifa 400.
- **Espaciado:** base de 4 px. Huecos de 8, 12, 16, 24 y 32 px; márgenes de página de 32 px (16 en compacto). Ancho máximo del contenido: 1440 px.
- **Forma:** radios de 6 px (controles y etiquetas), 8 px (tarjetas), 10 px (columnas) y 12 px (diálogos); las etiquetas de estado son píldoras. Bordes de 1 px, y discontinuos en las propuestas. La única sombra es la de los diálogos.
- **Iconografía:** SVG en línea con trazo de 2 px y `aria-hidden` cuando acompaña a un texto. Sin emojis ni fuentes de iconos.

### Contrato de tokens semánticos
- **Convención técnica:** propiedades CSS personalizadas en `web/styles.css`, sobre `:root`, con el tema oscuro en `@media (prefers-color-scheme: dark)`. No hay ningún sistema previo en el repositorio.
- **Roles:**
  - `--wf-bg`, `--wf-surface`, `--wf-column`, `--wf-border`, `--wf-border-strong`;
  - `--wf-text`, `--wf-muted`, `--wf-accent`, `--wf-accent-hover`, `--wf-accent-soft`, `--wf-on-accent`, `--wf-clay`;
  - `--wf-focus`, `--wf-danger`;
  - `--wf-status-<estado>-{fg,bg,border}`, `--wf-flag-<aviso>-{fg,bg,border}`, `--wf-stripe-<estado>`;
  - `--wf-font-display`, `--wf-font-body`, `--wf-font-mono`;
  - `--wf-space-1…8`, `--wf-radius-sm|md|lg|xl`.
- **Valores locales excepcionales:** ninguno previsto.

## Componentes mínimos y estados
- **Inventario:** barra superior, aviso de conexión, columna, tarjeta de tarea, etiqueta de estado o aviso, panel de detalle, lista de bitácora por día, rejilla de capturas con visor (`<dialog>`), página de proyecto, aviso de tareas ilegibles; en el incremento 5, diálogo de nueva tarea, diálogo de confirmación de descarte y mensaje de estado; con el registro de errores, lista de errores (reutiliza el aspecto de la tarjeta), página de error y bloque de salida observada (`<pre>` desplazable).
- **Descartados:** librería de componentes, framework, arrastrar y soltar, *skeletons* animados.

## Componentes y estados
| Elemento o flujo | Estado base | Carga/progreso | Vacío | Error y recuperación | Éxito | Deshabilitado | Foco, activo y sobreflujo |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Tablero | 4 columnas: Propuestas, Por hacer, En curso, Hechas (10 últimas) | «Cargando…» con `role=status` y la estructura de columnas | Por columna: «(ninguna)»; sin tareas, un texto que invita a pedir ideas a Claude | Aviso con «Reintentar»; las tareas ilegibles se listan arriba con su motivo | — | — | Títulos largos que se parten; «Ver todas las hechas» |
| Tarjeta | ID · prioridad · fecha relativa; título como enlace; etiquetas de aviso | — | — | — | — | — | Foco visible en el enlace y en los botones; la seleccionada lleva un borde de 2 px con el acento |
| Detalle | Título, etiquetas, metadatos (`<dl>`), Markdown renderizado y sección «Historial» (`h2`): una entrada por avance (`article` con `h3` y `<time>`), de la más antigua a la más reciente, cada una con enlace «Ver en la bitácora del <día>»; la de creación sin enlace | «Cargando…» | Sin descripción: «Sin descripción». Sin entradas: «Esta tarea aún no tiene entradas en su historial.» | Tarea inexistente → mensaje y enlace al tablero | — | — | Cerrar (44 px) o Esc cierran el modal y vuelven a donde estaba la persona (la bitácora, si vino de ella; si no, el tablero con el foco en la tarjeta); el contenido se desplaza dentro del modal y se refresca solo sin perder la posición. `#/<slug>/task/<ID>/<n>` abre la tarea con el foco en la entrada `n` (si no existe, en el título) |
| Autorefresco | Aviso discreto «Actualizado · N cambios» (`aria-live=polite`) | — | — | Banner persistente «Sin conexión…» con «Reintentar» | Aviso único al reconectar | — | Nunca mueve el foco ni pisa formularios ni diálogos abiertos |
| Bitácora | Días en orden inverso con `h2` y entradas; cada avance es una línea «[ID · título] — resumen» que enlaza a su entrada del historial, y los registros automáticos llevan el enlace a la tarea en su propio párrafo. `#/<slug>/log/<día>` muestra solo ese día con «Ver toda la bitácora» | «Cargando…» | «Aún no hay bitácora.» Día sin bitácora: «No hay bitácora del <día>.» | Aviso con «Reintentar» | — | — | «Cargar días anteriores» |
| Capturas | Rejilla con el texto alternativo como pie | «Cargando…» | «Aún no hay capturas.» | Imagen rota → texto alternativo visible | — | — | El visor `<dialog>` se cierra con Esc y devuelve el foco |
| Nueva tarea (incremento 5) | Diálogo con título, descripción y prioridad | Botón deshabilitado y «Creando…» | — | Errores junto al campo, resumen enlazado y foco al primer error; el borrador se conserva | Mensaje durante ≥ 5 s | Enviar sin título → error | — |
| Descartar (incremento 5) | `alertdialog` con la consecuencia | — | — | Error → mensaje en el diálogo | Mensaje | — | Foco inicial en «Cancelar»; Esc cancela |
| Errores (lista) | `h2` «Abiertos» y «Resueltos» con recuento, los más recientes primero; cada error con ID, fecha relativa, título como único enlace, estado en texto («Abierto» con icono de aviso y `--wf-flag-risk-*`; «Resuelto» con `--wf-status-done-*`) y su tarea | «Cargando…» | Sin errores: texto que explica que Claude los registra con `wf_error`; grupo vacío: «(ninguno)» | Aviso con «Reintentar»; archivos ilegibles listados arriba con su motivo | — | — | Resueltos: 10 últimos y «Ver los N resueltos» |
| Error (página) | «← Volver a Errores», ID, título (`h1`), estado, datos (`<dl>`: tarea enlazada, archivos, fechas), un `h2` por campo con etiqueta traducida (la causa indica «hipótesis» o «confirmada») y «Notas y recurrencias» (`article` con `h3` y `<time>`) | «Cargando…» | Campo vacío: «Sin dato» | Error inexistente → `h1` «Error no encontrado» y alerta; tarea inexistente → ID con «(tarea no encontrada)», sin enlace | — | — | Foco en el `h1` al entrar; la salida observada es un `<pre>` enfocable con desplazamiento horizontal propio; la página no desborda a 320 px |
| Errores en la tarea | `h2` «Errores (n)» tras el historial; cada error como enlace «ERR-n · título» con su estado en texto | — | «Esta tarea no tiene errores registrados.» | — | — | — | Abrir un error cierra el modal; «Atrás» vuelve con el foco en ese enlace |

## Diseño adaptable y acceso equivalente
- **Compacto (< 720 px):**
  - columnas apiladas con enlaces de salto «Propuestas (2) · …»;
  - el detalle de la tarea como modal a pantalla completa, con su botón de cerrar;
  - pestañas que pasan a otra línea y objetivos táctiles de 44 px;
  - sin scroll horizontal a 320 px ni con zoom al 200 %.
- **Intermedio (720–1099 px):** columnas en una rejilla `auto-fit` (2 por fila) y el detalle como modal.
- **Amplio (≥ 1100 px):** cuatro columnas.
- **Detalle de tarea (≥ 720 px):** modal de hasta 1000 px sobre el tablero. Cabecera con ID, título, etiquetas, acciones y cerrar; debajo, dos columnas: descripción e historial a la izquierda y datos (prioridad, origen, plan, fechas) en una columna de 260 px a la derecha. En compacto, a pantalla completa con los datos antes de la descripción.
- **Teclado y foco:**
  - un enlace «Saltar al contenido» y orden de foco igual al orden visual;
  - anillo de 2 px con `--wf-focus` y 2 px de separación;
  - los diálogos nativos atrapan el foco, se cierran con Esc y devuelven el foco al control que los abrió.
- **Semántica y mensajes:**
  - `<html lang>` según el idioma, `<main>` y columnas como listas;
  - botones con nombre que incluye el título («Aprobar «…»»);
  - errores con causa y siguiente paso.
- **No depender solo del color:** estado y avisos siempre en texto; las propuestas además con borde discontinuo y las descartadas tachadas.
- **Movimiento:** solo 120 ms en el foco y en las apariciones, desactivado con `prefers-reduced-motion`.

## Observaciones y aprobación
### Feedback incorporado
- «Quiero que tenga una paleta de colores parecida a la de la web de Claude» → marfil, pizarra, grises cálidos y arcilla, más serifa en los títulos (v8).

### Supuestos y pendientes
- Fechas relativas, con la fecha exacta en `title` y en el detalle.
- Sin selector de tema: se usa `prefers-color-scheme`.
- Los contrastes de la tabla se verificarán con una medición real al implementar; si alguno no cumple, se ajustará el tono, no el rol.

### Aprobación
- **Fecha:** 2026-10-21
- **Persona que aprueba:** el usuario de la sesión («aprobado»)
- **Alcance de la aprobación:** diseño. La implementación está cubierta por el plan aprobado `Planes/2026-10-21-wayfinder-mvp.md` v3, incrementos 4 y 5.
- **Observaciones:** exploración hecha en un lienzo Claude Design (artifact) en lugar de `/design`, que no estaba disponible.

## Validación prevista para la implementación
- **Escenarios funcionales:** tablero con datos, tarea, bitácora, capturas, proyecto; repositorio sin proyectos; tarea ilegible; servidor detenido (banner) y reconexión.
- **Responsive:** capturas a 320, 768 y 1280 px en claro y oscuro, y zoom al 200 %.
- **Teclado, foco y semántica:** recorrido solo con teclado, árbol de accesibilidad (aria snapshot de Playwright) y prueba manual con NVDA documentada como no certificante.
- **Contraste y estados:** medición de los pares texto/fondo de la tabla con el cálculo de contraste WCAG.
- **Movimiento reducido:** emulación con `prefers-reduced-motion: reduce`.
- **Capturas o revisión visual:** capturas de Playwright revisadas contra el lienzo v8.

## Evidencia de revisión en ejecución
| Fecha | Cambio o flujo | Entorno y ruta | Evidencia | Resultado | Desviación aprobada o seguimiento |
| --- | --- | --- | --- | --- | --- |
| 2026-10-21 | Incremento 4: tablero, detalle, bitácora, capturas, proyecto (es/en) | `wayfinder serve` con datos de prueba; Chromium headless (Playwright 1.64.1); Windows 11 | `npm run test:e2e` 11/11; capturas `test-results/review/` a 320, 768 y 1280 px en claro y oscuro; `test/contrast.test.ts` | Coincide con el lienzo v8. Contraste medido: todos los textos ≥ 4,5:1 y foco, bordes y arcilla ≥ 3:1 en los dos temas | «Descartada» en claro ajustada de `#73726C` a `#5E5D59` (4,15 → 5,67:1). Sin verificar: prueba manual con NVDA y zoom real al 200 % del navegador (aproximado con un viewport de 640 px) |
| 2026-10-22 | Plan de bitácora e historial, incremento 5: sección Historial, enlaces bitácora ↔ entrada, vista de un día (es/en) | Fixture e2e (`historial`); Chromium headless; Windows 11 | `npm run test:e2e` 27/27 (`e2e/history.spec.ts`: foco en la entrada, «Atrás», teclado, estados vacíos, 320 px sin scroll horizontal, árbol de accesibilidad); capturas a 320 y 1280 px en claro y oscuro | Coherente con el lienzo v8: tokens existentes (`--wf-border-strong`, `--wf-focus`, tipografía mono para fechas), sin colores nuevos | Corregido de paso: la bitácora mostraba un texto «null» al final (defecto previo). Sin verificar: NVDA y zoom real al 200 % |
| 2026-10-22 | Detalle de tarea en modal (dos columnas; pantalla completa en compacto) | Fixture e2e; Chromium headless; Windows 11 | `npm run test:e2e` 28/28 (foco en el título o en la entrada enlazada, Esc y «Cerrar» vuelven al origen y devuelven el foco a la tarjeta, 640 px sin scroll horizontal); capturas a 320 y 1280 px en claro y oscuro | Coherente con el lienzo v8: mismos tokens, superficie y sombra que los diálogos existentes | Cambia una decisión aprobada (panel lateral) por petición expresa del usuario. Sin verificar: NVDA y zoom real al 200 % |
| 2026-10-23 | Registro de errores: pestaña «Errores», página de error y «Errores (n)» en la tarea (es/en) | Fixture e2e (`errores`); Chromium headless (Playwright); Windows 11 | `npm run test:e2e` 37/37 (`e2e/errors.spec.ts`: grupos y «Ver los N resueltos», campos y notas, texto hostil inerte, error → tarea → cerrar y tarea → error → Atrás con el foco en el enlace de origen, estados vacío e inexistente, 320 px sin scroll horizontal salvo el `<pre>`, árbol de accesibilidad, inglés); capturas de lista, error y tarea a 320, 768 y 1280 px en claro y oscuro | Coherente con el lienzo v8: tokens existentes (`--wf-flag-risk-*` para abierto, con icono y texto; `--wf-status-done-*` para resuelto), aspecto de tarjeta reutilizado, sin colores nuevos | Añade una pestaña a la navegación aprobada, con el plan `Planes/2026-10-23-registro-de-errores.md` v1 aprobado. Sin verificar: NVDA y zoom real al 200 % |
| 2026-10-22 | Color por columna (franja y contador) y «Por hacer» en azul pizarra | Fixture e2e; Chromium headless; Windows 11 | `test/contrast.test.ts` (franjas ≥ 3:1 sobre página y columna; textos de estado ≥ 4,5:1); capturas a 320 y 1280 px en claro y oscuro | Las cuatro columnas se distinguen sin depender solo del color (encabezado con nombre) | Amplía la paleta aprobada (nuevo color de «Por hacer» y tokens de franja) por petición expresa del usuario |

## Regresión visual automatizada
- **Herramienta:** Playwright, prevista en el plan (incremento 4) como devDependency.
- **Escenarios y baselines:** tablero vacío y tablero con datos, en claro y oscuro. La baseline solo se fija tras revisarla.
- **Entorno:** datos de prueba deterministas y reloj fijo para las fechas relativas.
