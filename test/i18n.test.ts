import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dictionaries, resolveLang, t } from '../src/i18n/index.ts';

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

test('es and en dictionaries have exactly the same keys', () => {
  assert.deepEqual(Object.keys(dictionaries.es).sort(), Object.keys(dictionaries.en).sort());
});

test('no dictionary value is empty', () => {
  for (const [lang, dict] of Object.entries(dictionaries)) {
    for (const [key, value] of Object.entries(dict)) {
      assert.ok(value.trim().length > 0, `${lang}:${key} is empty`);
    }
  }
});

test('placeholders match between languages', () => {
  for (const key of Object.keys(dictionaries.es)) {
    assert.deepEqual(placeholders(dictionaries.es[key]), placeholders(dictionaries.en[key]), key);
  }
});

test('resolveLang honours WAYFINDER_LANG and defaults to es', () => {
  assert.equal(resolveLang({ WAYFINDER_LANG: 'en' }), 'en');
  assert.equal(resolveLang({ WAYFINDER_LANG: 'EN ' }), 'en');
  assert.equal(resolveLang({ WAYFINDER_LANG: 'fr' }), 'es');
  assert.equal(resolveLang({}), 'es');
});

test('t interpolates variables and keeps unknown placeholders', () => {
  assert.match(t('en', 'cli.unknownCommand', { command: 'foo' }), /"foo"/);
  assert.match(t('es', 'cli.unknownCommand'), /\{command\}/);
});
