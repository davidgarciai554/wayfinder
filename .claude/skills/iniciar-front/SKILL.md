---
name: iniciar-front
description: Inicia la dirección de diseño de un frontend desde una idea libre, URLs y capturas. Úsala antes de implementar una interfaz para explorar, recoger aprobación y crear un DESIGN.md persistente.
---

# Iniciar front

Convierte la intención visual y funcional del usuario en una dirección de diseño explícita, aprobable y persistente **antes de implementar código**. Esta skill no implementa componentes, no modifica el frontend de producción y no sustituye el proceso de planificación del repositorio.

El directorio de esta skill se instala sin cambios en `.claude/skills/iniciar-front/`; entonces se invoca como `/iniciar-front`.

## Entrada

Trabaja con `$ARGUMENTS` como una petición libre. Puede incluir una idea, objetivos, restricciones, URLs y/o imágenes adjuntas o referenciadas por ruta. No exijas un formulario.

1. Haz un inventario de las fuentes recibidas: texto, URL, captura, contexto del repositorio y limitaciones de acceso.
2. Lee primero las instrucciones aplicables, la arquitectura, la interfaz existente y cualquier `DESIGN.md` ya presente.
3. Trata URLs y capturas como referencias, no como especificaciones autoritativas. Nunca solicites credenciales para acceder a una URL privada.
4. Para cada referencia, distingue siempre:
   - **Observado:** lo visible y comprobable.
   - **Inferido:** interpretación razonable que necesita cautela.
   - **Decisión propuesta:** qué se adoptaría y cómo se adaptaría al producto.
5. No copies textos, marca, imágenes, iconos, assets ni la composición literal de una referencia ajena.

## Reglas de decisión

Extrae, cuando estén disponibles: producto, usuario, trabajo principal, plataforma, alcance, identidad existente, prioridades, restricciones técnicas y criterio de éxito.

Formula como máximo una ronda agrupada de preguntas y solo si falta un dato que pueda cambiar materialmente la identidad, estructura, interacción, alcance o accesibilidad. Ejemplos: usuario/objetivo principal, plataforma prioritaria, una referencia contradictoria, identidad obligatoria o una restricción de implementación.

Si el dato faltante no es material, declara una suposición reversible y continúa. Nunca conviertas una preferencia estética genérica en una pregunta interminable.

## Fase 1: brief y mapa de diseño

Presenta un borrador breve antes de explorar visualmente. Debe incluir:

- objetivo del producto, persona o contexto confirmado y tarea principal;
- alcance y exclusiones;
- inventario trazable de referencias;
- dirección visual: personalidad, densidad, composición, tono, tipografía, color y profundidad;
- arquitectura de información, navegación, pantallas y flujo principal;
- patrones seleccionados y antipatrones; consulta [patrones-frontend.md](Referencias/patrones-frontend.md). Si la tarea requiere interacción directa, gestos, transiciones espaciales, capas/materiales o precisión tipográfica inspirada en productos de plataforma, consulta además [patrones-apple-web.md](Referencias/patrones-apple-web.md) y documenta qué principios se adoptan o se descartan;
- estados aplicables: carga/progreso, vacío, error recuperable, éxito, deshabilitado, foco, hover/activo y sobreflujo de contenido;
- comportamiento compacto, intermedio y amplio; requisitos de teclado, foco, contraste, semántica, no dependencia exclusiva del color y movimiento reducido;
- supuestos, decisiones pendientes y una o más alternativas solo cuando exista una disyuntiva material.

La dirección debe ser específica del producto. No elijas por defecto bento, tarjetas, gradientes, cristal, tipografía de sistema, una landing con hero o animación ornamental.

## Fase 2: exploración visual y feedback

Antes de crear código o una especificación final, intenta usar `/design` para crear artboards que representen la dirección propuesta. La exploración debe mostrar contenido y estados representativos, no un moodboard ni pantallas vacías.

- Crea una dirección coherente; presenta dos o tres alternativas solo cuando comparen decisiones significativas.
- Explica por cada alternativa qué objetivo valida, qué toma de las referencias y qué rechaza.
- Pide al usuario que revise el artifact y devuelva observaciones concretas: texto, capturas anotadas, enlace/versiones o una combinación de opciones.
- No presupongas que comentarios o anotaciones del canvas se sincronizan de vuelta a la sesión.

### Si `/design` no está disponible

Declara la limitación. No afirmes que has creado artboards ni llames exploración visual a un texto. Ofrece dos opciones: esperar a una sesión o superficie compatible, o continuar mediante una exploración textual/manual claramente etiquetada. Continúa solo tras la decisión expresa del usuario.

## Fase 3: aprobación y persistencia

Tras recibir feedback, resume de forma inequívoca:

- decisiones aprobadas;
- decisiones descartadas;
- supuestos que permanecen;
- puntos pendientes;
- si la aprobación cubre solo el diseño o también la siguiente fase de planificación.

No implementes. Cuando el usuario apruebe la dirección, crea o actualiza el `DESIGN.md` definitivo. Respeta la convención del repositorio; si no existe, usa `docs/design/DESIGN.md`.

Crea el documento a partir de [Plantillas/DESIGN.md](Plantillas/DESIGN.md). El `DESIGN.md` es la fuente de verdad persistente: un enlace a artifact solo es una referencia opcional.

Finaliza indicando que cualquier implementación posterior debe leer `DESIGN.md`, seguir la planificación requerida por el repositorio y contar con la autorización correspondiente.

## Preflight

Antes de declarar terminada esta skill, aplica [validacion-visual.md](Referencias/validacion-visual.md). Indica con precisión qué se validó, qué es una decisión del usuario, qué es una suposición y qué no pudo verificarse.
