import test from 'node:test';
import assert from 'node:assert/strict';
import { DateTime } from 'luxon';
import { isExpired } from '../src/config.js';

test('KST 종료 시각 경계', () => {
  assert.equal(isExpired(DateTime.fromISO('2026-09-23T11:59:59+09:00')), false);
  assert.equal(isExpired(DateTime.fromISO('2026-09-23T12:00:00+09:00')), true);
});
