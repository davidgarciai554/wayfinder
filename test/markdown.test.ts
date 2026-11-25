import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRenderer } from '../src/markdown.ts';

const levels = (html: string) => [...html.matchAll(/<(h[1-6])>/g)].map((m) => m[1]);
const md = createRenderer('/assets');

test('headings move one level down: the page owns <h1>', () => {
  assert.deepEqual(levels(md.render('# A\n\n## B\n\n###### F')), ['h2', 'h3', 'h6']);
  assert.deepEqual(levels(md.render('## A')), ['h3']);
});

test('A11Y-6: with headingBase, the highest heading becomes that level whatever the Markdown starts at', () => {
  assert.deepEqual(levels(md.render('## A\n\n### B\n\n## C', { headingBase: 2 })), ['h2', 'h3', 'h2']);
  assert.deepEqual(levels(md.render('# A\n\n## B', { headingBase: 2 })), ['h2', 'h3']);
  assert.deepEqual(levels(md.render('### A\n\n###### B', { headingBase: 2 })), ['h2', 'h5']);
  assert.equal(levels(md.render('Sin encabezados.', { headingBase: 2 })).length, 0);
});
