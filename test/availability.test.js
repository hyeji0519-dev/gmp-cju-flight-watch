import test from 'node:test';
import assert from 'node:assert/strict';
import { hasBookablePrice } from '../src/googleFlights.js';

test('가격을 제공하지 않는 운항 스케줄은 예약 가능으로 보지 않는다', () => {
  assert.equal(hasBookablePrice('Total price is unavailable. Nonstop flight with EASTAR JET.'), false);
  assert.equal(hasBookablePrice('Price unavailable'), false);
});

test('실제 원화 총가격이 표시된 결과만 예약 가능 후보로 본다', () => {
  assert.equal(hasBookablePrice('₩425,600 round trip'), true);
  assert.equal(hasBookablePrice('425,600 Korean won round trip'), true);
  assert.equal(hasBookablePrice('Schedule only'), false);
});
