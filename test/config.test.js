import test from 'node:test';
import assert from 'node:assert/strict';
import { DateTime } from 'luxon';
import { activeLegs, config, isExpired } from '../src/config.js';

const at = (iso) => DateTime.fromISO(iso, { setZone: true });

test('감시 대상은 10/5·10/11 제주→김포 오후편, 성인 2명이다', () => {
  assert.deepEqual(config.legs, [
    { type: 'return-2026-10-05', from: 'CJU', to: 'GMP', date: '2026-10-05', notBefore: '12:00' },
    { type: 'return-2026-10-11', from: 'CJU', to: 'GMP', date: '2026-10-11', notBefore: '12:00' }
  ]);
  assert.equal(config.passengers.adults, 2);
});

test('각 구간은 출발일 정오(KST)가 지나면 감시에서 빠진다', () => {
  assert.equal(activeLegs(at('2026-10-05T11:59:59+09:00')).length, 2);
  assert.deepEqual(activeLegs(at('2026-10-05T12:00:00+09:00')).map((l) => l.date), ['2026-10-11']);
  assert.equal(activeLegs(at('2026-10-11T12:00:00+09:00')).length, 0);
});

test('KST 종료 시각 경계는 마지막 구간 기준이다', () => {
  assert.equal(isExpired(at('2026-10-11T11:59:59+09:00')), false);
  assert.equal(isExpired(at('2026-10-11T12:00:00+09:00')), true);
});
