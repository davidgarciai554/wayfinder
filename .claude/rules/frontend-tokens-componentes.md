# Tokens y componentes frontend

> Regla de proyecto. Copia este archivo en `.claude/rules/frontend-tokens-componentes.md` junto con `frontend-design.md`.

## Antes de modificar

Después de leer `docs/design/DESIGN.md`, descubre los tokens, el tema, la escala de espaciado y los componentes ya existentes en el repositorio. Respeta su convención técnica; no impongas una estructura CSS, framework ni nombres de archivos externos.

## Tokens semánticos

- Usa tokens por función visual —superficie, texto, acción, estado, foco, espaciado, tipografía, forma, profundidad y movimiento—, no valores físicos dispersos.
- Si ya existe un token que cubre el rol, úsalo. No añadas colores, tamaños, radios, sombras o transiciones arbitrarios.
- Si falta un token reutilizable, propón uno con significado, consumidores y compatibilidad con los modos o temas existentes antes de extender el sistema.
- Un valor local puede mantenerse solo cuando no expresa una decisión reutilizable; no lo promociones a token por anticipación.
- No uses el color como único portador de significado y conserva foco visible, contraste y comportamiento con movimiento reducido.

## Componentes mínimos

- Reutiliza primero el componente que ya resuelva el caso de uso.
- Crea un componente nuevo únicamente cuando exista comportamiento, estado, accesibilidad o composición reutilizable demostrable; documenta su propósito y límites.
- No crees bibliotecas preventivas ni abstracciones genéricas que oculten la jerarquía, el flujo o el modelo de información.
- Todo componente interactivo define sus estados aplicables, teclado, foco, semántica, errores, vacíos y adaptación por tamaño cuando correspondan.

## Cierre

Al finalizar un cambio de interfaz, indica:

- tokens y componentes reutilizados, creados o descartados;
- cualquier valor local excepcional y su motivo;
- estados y accesibilidad comprobados;
- si la decisión requiere actualizar `docs/design/DESIGN.md`, el contrato de tokens o el inventario de componentes.
