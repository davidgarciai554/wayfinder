---
name: implementar-front
description: Implementa un cambio frontend acotado desde un diseño y plan aprobados, reutilizando el sistema existente y verificando el resultado real.
---

# Implementar front

Conecta una dirección de diseño aprobada con una implementación frontend real, pequeña y verificable. Úsala para implementar o modificar una interfaz cuando el cambio ya tenga alcance y decisiones de diseño definidos.

Se instala sin cambios en `.claude/skills/implementar-front/` y se invoca como `/implementar-front`.

Esta skill **orquesta** el trabajo; no sustituye el proceso de planificación, el perfil `Programador`, las reglas frontend ni `/probar-web-playwright`.

## Preflight: autorización y contexto

Antes de editar:

1. Lee las instrucciones aplicables, el estado del repositorio y `ERRORES.md` si existe.
2. Localiza y lee el documento de diseño aplicable —normalmente `docs/design/DESIGN.md`—, las reglas frontend instaladas y el código, tokens, tema, componentes, pruebas y validaciones existentes en el área afectada.
3. Identifica el flujo, ruta o pantalla solicitada, los llamadores, los datos/estados disponibles, el stack y el mecanismo real de ejecución. No presupongas framework, estructura CSS, gestor de paquetes, navegador ni comando.
4. Clasifica el cambio con las instrucciones del repositorio:
   - **No trivial:** altera dirección visual, navegación, interacción, estados, responsive, accesibilidad, arquitectura de componentes o comportamiento observable. Identifica el plan Markdown aprobado y confirma que el alcance lo cubre.
   - **Claramente trivial y reversible:** conserva estrictamente los patrones y tokens existentes. No fuerces un `DESIGN.md` o plan nuevo si las instrucciones locales no lo exigen.

No empieces a editar y explica el bloqueo si ocurre cualquiera de estos casos:

- el cambio no trivial no tiene dirección de diseño aprobada o el documento está insuficiente/contradictorio para una decisión material;
- falta el plan aprobado, el alcance solicitado queda fuera de él o la autorización disponible cubre solo el diseño;
- una decisión requerida de jerarquía, navegación, composición, color, tipografía, espaciado, iconografía, movimiento, responsive o acceso equivalente no está aprobada;
- no puedes determinar qué validación real corresponde al repositorio.

En esos casos, deriva a `/iniciar-front`, al proceso de planes o a la decisión concreta necesaria. No rellenes el hueco con una interfaz genérica ni actualices un `DESIGN.md` materialmente por tu cuenta.

## Mapa del incremento

Antes de cada incremento, deja explícito qué resultado observable implementará y qué decisiones existentes consume:

- flujo, persona, acción principal, jerarquía y patrón de interfaz;
- tokens, componentes y capacidades ya reutilizables;
- estados aplicables: carga, vacío, error/recuperación, éxito, deshabilitado, foco, activo y sobreflujo;
- comportamiento compacto, intermedio y amplio;
- acceso equivalente: teclado, foco, semántica, mensajes, contraste/no dependencia exclusiva de color y movimiento reducido cuando aplique;
- validación específica que demostrará el resultado.

Limita un incremento a un cambio revisable. No avances dejando una desviación material, una regresión conocida o una comprobación necesaria sin declarar.

## Implementación mínima y fiel

1. Reutiliza primero el patrón, componente, token, dependencia y mecanismo ya presentes que cubran el caso sin deformar su propósito.
2. Implementa solo lo trazable al documento de diseño, al plan aprobado y al comportamiento solicitado. Conserva las convenciones técnicas del repositorio.
3. Crea un token, componente o variante únicamente si hay una necesidad reutilizable demostrable. Documenta el propósito, consumidores y límites mediante el mecanismo existente del proyecto.
4. No crees una biblioteca preventiva, abstracciones genéricas, configuraciones, dependencias, design system paralelo, valores visuales arbitrarios ni variantes para necesidades hipotéticas.
5. Si descubres que una decisión aprobada no funciona o debe cambiar materialmente, detente: describe la desviación, su impacto y la actualización de diseño o plan que requiere aprobación.

Aplica las reglas locales de diseño, tokens/componentes y revisión visual cuando existan. Esta skill no las redefine: son los contratos detallados del proyecto.

## Validación y cierre

1. Descubre y ejecuta primero la validación más específica del cambio; después, las comprobaciones existentes proporcionales al riesgo. No inventes comandos ni desactives controles para obtener un resultado aparente.
2. Cuando exista una vía real, revisa la interfaz ejecutándose frente al documento de diseño con contenido y estados representativos. Usa la ficha de revisión visual o el mecanismo equivalente cuando sea proporcional.
3. Usa `/probar-web-playwright` solo cuando el flujo requiera pruebas web o regresión visual y Playwright ya exista o su incorporación haya sido aprobada. No instales, configures ni generes baselines como atajo.
4. Ante un fallo, conserva la evidencia producida, consulta `ERRORES.md` y registra el error relevante siguiendo la convención del repositorio.

Al cerrar, informa con precisión:

- documento de diseño y plan aprobados consultados; alcance realmente implementado;
- flujo, archivos o componentes afectados y decisiones de diseño materializadas;
- tokens/componentes reutilizados, creados o descartados, y cualquier valor local excepcional;
- estados, tamaños y requisitos de acceso equivalente comprobados o no aplicables;
- comandos, escenarios, aplicación en ejecución y evidencia realmente revisados;
- desviaciones aprobadas, bloqueos, riesgos y validaciones que no pudieron ejecutarse.

Una prueba, una captura o un snapshot no sustituyen por sí solos la revisión funcional, visual y de acceso equivalente que el cambio requiera.

## Límites

- No explora referencias, propone direcciones visuales, crea artboards ni aprueba `DESIGN.md`: eso corresponde a `/iniciar-front`.
- No crea ni aprueba planes; una aprobación de diseño no autoriza por sí sola un cambio no trivial.
- No sustituye las reglas de frontend, la revisión de la aplicación ejecutándose ni la estrategia de Playwright del proyecto.
- No afirma conformidad WCAG, compatibilidad total con tecnologías asistivas ni comportamiento en hardware real sin evidencia específica.

## Preflight de cierre

Antes de declarar terminado el trabajo, confirma que el resultado corresponde al alcance aprobado, que cualquier desviación está visible y que el cierre distingue entre **verificado**, **no aplicable** y **bloqueado**. No conviertas una inferencia del código en evidencia de ejecución.
