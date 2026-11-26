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

test('A11Y-4: generated English lines and labels are marked lang="en" only in generated records', () => {
  const log = md.render('status: todo -> in-progress\ntrivial: true\nCambio pequeño.\n\n- Files: web/app.js\n- Next: revisión visual', { generated: true });
  assert.match(log, /<span lang="en">status: todo -&gt; in-progress<\/span>\n<span lang="en">trivial: true<\/span>\nCambio pequeño\./);
  assert.match(log, /<li><span lang="en">Files:<\/span> web\/app\.js<\/li>/);
  assert.match(log, /<li><span lang="en">Next:<\/span> revisión visual<\/li>/);
  assert.match(md.render('Resolved. Fields: solution, cause_kind.\nNota libre.', { generated: true }), /^<p><span lang="en">Resolved\. Fields: solution, cause_kind\.<\/span>\nNota libre\.<\/p>/);
  assert.match(md.render('Created (task: FAL-1).', { generated: true }), /<span lang="en">Created \(task: FAL-1\)\.<\/span>/);
  // The person's own text is left alone, also when it only looks like a label.
  assert.doesNotMatch(md.render('Hoy status: todo -> done\n\nFiles sin dos puntos', { generated: true }), /lang=/);
  // Outside generated records nothing is marked, and the text stays escaped.
  assert.doesNotMatch(md.render('status: todo -> done'), /lang=/);
  assert.doesNotMatch(md.render('- Files: <img src=x>', { generated: true }), /<img/);
});
