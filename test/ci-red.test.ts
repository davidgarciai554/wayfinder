import test from 'node:test';
import assert from 'node:assert/strict';

test('temporary CI red check (WAY-26, reverted)', () => {
  assert.equal(1, 2);
});
