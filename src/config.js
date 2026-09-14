import { DateTime } from 'luxon';

export const config = Object.freeze({
  timezone: 'Asia/Seoul',
  // 감시할 편도 구간 목록. notBefore 이전 출발편은 제외합니다.
  // 각 구간은 해당 날짜의 notBefore 시각(KST)이 지나면 자동으로 감시에서 빠집니다.
  legs: [
    { type: 'return-2026-10-05', from: 'CJU', to: 'GMP', date: '2026-10-05', notBefore: '12:00' },
    { type: 'return-2026-10-11', from: 'CJU', to: 'GMP', date: '2026-10-11', notBefore: '12:00' }
  ],
  // 좌석 2석 이상 필요: 성인 2명으로 검색해 가격이 정상 반환되는지 확인합니다.
  passengers: { adults: 2, children: 0 },
  maxResults: 20,
  searchUrl: 'https://www.google.com/travel/flights?hl=en&curr=KRW',
  stateFile: process.env.STATE_FILE || '.state/flight-watch.json',
  artifactsDir: process.env.ARTIFACTS_DIR || 'artifacts'
});

export function legDeadline(leg) {
  return DateTime.fromISO(`${leg.date}T${leg.notBefore || '00:00'}`, { zone: config.timezone });
}

// 아직 출발 시간대가 지나지 않은 구간만 반환합니다.
export function activeLegs(now = DateTime.now().setZone(config.timezone), legs = config.legs) {
  return legs.filter((leg) => now < legDeadline(leg));
}

// 마지막 구간의 출발 시간대까지 지나면 전체 감시를 종료합니다.
export function isExpired(now = DateTime.now().setZone(config.timezone)) {
  return activeLegs(now).length === 0;
}
