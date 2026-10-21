# Diseño frontend

> Regla de proyecto. Copia este archivo en `.claude/rules/frontend-design.md` para aplicarlo a las sesiones de Claude Code del repositorio.

## Fuente de verdad

Antes de crear o modificar una interfaz, localiza y lee `docs/design/DESIGN.md` si existe. Para un área con una convención local equivalente, usa el documento que el repositorio designe como fuente de verdad.

No introduzcas decisiones de navegación, jerarquía, patrón de interfaz, color, tipografía, espaciado, radios, sombras, iconografía, imágenes, movimiento ni comportamiento responsive que contradigan ese documento.

## Cuando falta o queda obsoleto

- Si el cambio es visualmente o funcionalmente no trivial y no hay una dirección aprobada, detente antes de implementar y usa `/iniciar-front` o el proceso de diseño definido por el repositorio.
- Si el cambio es pequeño, conserva los patrones y tokens existentes; no aproveches la ausencia de `DESIGN.md` para sustituir la identidad de la interfaz.
- Si el cambio requerido contradice una decisión aprobada, explica el conflicto, propone la actualización concreta de `DESIGN.md` y solicita la aprobación que exijan las instrucciones del repositorio antes de aplicarla.

## Implementación y cierre

- Usa los tokens, componentes, patrones y antipatrones definidos por el proyecto. No introduzcas valores visuales arbitrarios ni una estética genérica por conveniencia.
- Mantén los estados relevantes —carga, vacío, error, éxito, deshabilitado y foco— y el comportamiento adaptable y accesible ya documentados.
- Antes de finalizar un cambio frontend, realiza la revisión de la aplicación ejecutándose definida en `frontend-visual-review.md` cuando sea viable. Informa qué documento de diseño se consultó, qué decisiones respetaste o actualizaste y qué evidencia visual o funcional se verificó o quedó bloqueada.
