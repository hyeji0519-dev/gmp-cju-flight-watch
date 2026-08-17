import { DateTime } from 'luxon';

export const config = Object.freeze({
  timezone: 'Asia/Seoul',
  stopAt: '2026-09-23T12:00:00+09:00',
  outbound: { from: 'GMP', to: 'CJU', date: '2026-09-23', notBefore: '17:00' },
  inbound: { from: 'CJU', to: 'GMP', date: '2026-09-27' },
  passengers: { adults: 2, children: 2 },
  maxResults: 10,
  searchUrl: 'https://www.google.com/travel/flights?hl=en&curr=KRW',
  stateFile: process.env.STATE_FILE || '.state/flight-watch.json',
  artifactsDir: process.env.ARTIFACTS_DIR || 'artifacts'
});

export function isExpired(now = DateTime.now().setZone(config.timezone)) {
  return now >= DateTime.fromISO(config.stopAt, { setZone: true });
}
