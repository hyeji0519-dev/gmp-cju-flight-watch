import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, fingerprint, markFailure, markSuccess, unseenItineraries } from '../src/state.js';

const itinerary = {
  type: 'outbound',
  leg: { airline: 'Test Air', flightNumber: 'TA123', date: '2026-09-23', departure: '17:00', arrival: '18:10' }
};

test('같은 조합은 중복 알림하지 않고, 사라졌다 재등장하면 알린다', () => {
  const initial = emptyState();
  assert.equal(unseenItineraries([itinerary], initial).length, 1);
  const present = markSuccess(initial, [itinerary]);
  assert.equal(unseenItineraries([itinerary], present).length, 0);
  const disappeared = markSuccess(present, []);
  assert.equal(unseenItineraries([itinerary], disappeared).length, 1);
  assert.equal(present.active[0], fingerprint(itinerary));
});

test('연속 오류는 누적되고 성공 시 초기화된다', () => {
  const failed = markFailure(markFailure(markFailure(emptyState())));
  assert.equal(failed.consecutiveErrors, 3);
  assert.equal(failed.errorAlertSent, true);
  const recovered = markSuccess(failed, []);
  assert.equal(recovered.consecutiveErrors, 0);
  assert.equal(recovered.errorAlertSent, false);
});
