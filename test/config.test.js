import test from 'node:test';
import assert from 'node:assert/strict';
import { DateTime } from 'luxon';
import { config, isExpired } from '../src/config.js';

test('KST 종료 시각 경계', () => {
  assert.equal(isExpired(DateTime.fromISO('2026-10-05T11:59:59+09:00')), false);
  assert.equal(isExpired(DateTime.fromISO('2026-10-05T12:00:00+09:00')), true);
});

test('감시 대상은 10/5 제주→김포 오후편, 성인 2명이다', () => {
  assert.equal(config.legs.length, 1);
  assert.deepEqual(config.legs[0], { type: 'return-2026-10-05', from: 'CJU', to: 'GMP', date: '2026-10-05', notBefore: '12:00' });
  assert.equal(config.passengers.adults, 2);
});
