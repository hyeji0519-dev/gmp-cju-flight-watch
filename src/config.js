import { DateTime } from 'luxon';

export const config = Object.freeze({
  timezone: 'Asia/Seoul',
  // 10/5 오후 출발편이 대상이므로 당일 정오 이후에는 감시를 멈춥니다.
  stopAt: '2026-10-05T12:00:00+09:00',
  // 감시할 편도 구간 목록. notBefore 이전 출발편은 제외합니다.
  legs: [
    { type: 'return-2026-10-05', from: 'CJU', to: 'GMP', date: '2026-10-05', notBefore: '12:00' }
  ],
  // 좌석 2석 이상 필요: 성인 2명으로 검색해 가격이 정상 반환되는지 확인합니다.
  passengers: { adults: 2, children: 0 },
  maxResults: 20,
  searchUrl: 'https://www.google.com/travel/flights?hl=en&curr=KRW',
  stateFile: process.env.STATE_FILE || '.state/flight-watch.json',
  artifactsDir: process.env.ARTIFACTS_DIR || 'artifacts'
});

export function isExpired(now = DateTime.now().setZone(config.timezone)) {
  return now >= DateTime.fromISO(config.stopAt, { setZone: true });
}
