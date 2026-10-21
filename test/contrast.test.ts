import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Measures the WCAG 2.x contrast of the colour pairs that docs/design/DESIGN.md commits to.
const css = readFileSync(new URL('../web/styles.css', import.meta.url), 'utf8');

function tokens(block: string): Record<string, string> {
  return Object.fromEntries([...block.matchAll(/--(wf-[\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]));
}
const lightBlock = css.slice(css.indexOf(':root {'), css.indexOf('@media (prefers-color-scheme: dark)'));
const darkBlock = css.slice(css.indexOf('@media (prefers-color-scheme: dark)'), css.indexOf('*, *::before'));
const themes = { light: tokens(lightBlock), dark: { ...tokens(lightBlock), ...tokens(darkBlock) } };

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT: Array<[string, string]> = [
  ['text', 'bg'], ['text', 'surface'], ['text', 'column'],
  ['muted', 'bg'], ['muted', 'surface'], ['muted', 'column'],
  ['accent', 'surface'], ['accent', 'bg'], ['accent', 'accent-soft'], ['on-accent', 'accent'],
  ['danger', 'surface'],
  ...['proposed', 'todo', 'progress', 'done', 'discarded'].map((s) => [`status-${s}-fg`, `status-${s}-bg`] as [string, string]),
  ...['chat', 'risk', 'outside'].map((f) => [`flag-${f}-fg`, `flag-${f}-bg`] as [string, string]),
];
const NON_TEXT: Array<[string, string]> = [['focus', 'bg'], ['focus', 'surface'], ['border-strong', 'surface'], ['clay', 'surface']];

for (const [theme, map] of Object.entries(themes)) {
  test(`text contrast ≥ 4.5:1 in the ${theme} theme`, () => {
    for (const [fg, bg] of TEXT) {
      const ratio = contrast(map[`wf-${fg}`], map[`wf-${bg}`]);
      assert.ok(ratio >= 4.5, `${theme}: ${fg} on ${bg} = ${ratio.toFixed(2)}:1`);
    }
  });
  test(`focus, control borders and the clay rail ≥ 3:1 in the ${theme} theme`, () => {
    for (const [fg, bg] of NON_TEXT) {
      const ratio = contrast(map[`wf-${fg}`], map[`wf-${bg}`]);
      assert.ok(ratio >= 3, `${theme}: ${fg} on ${bg} = ${ratio.toFixed(2)}:1`);
    }
  });
}
