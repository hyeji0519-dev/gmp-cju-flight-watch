import { DateTime } from 'luxon';
import { config, isExpired } from './config.js';
import { searchGoogleFlights } from './googleFlights.js';
import { loadState, markFailure, markSuccess, saveState, unseenItineraries } from './state.js';
import { formatItinerary, sendTelegram } from './telegram.js';

const now = DateTime.now().setZone(config.timezone);
if (isExpired(now)) {
  console.log(`조회 종료 시각(${config.stopAt})이 지나 정상 종료합니다.`);
  process.exit(0);
}

const state = await loadState(config.stateFile);
try {
  const itineraries = await searchGoogleFlights(config);
  const unseen = unseenItineraries(itineraries, state);
  console.log(`예약 가능 추정 조합 ${itineraries.length}개, 새 조합 ${unseen.length}개.`);
  for (const item of unseen) {
    if (process.env.DRY_RUN === '1') console.log(formatItinerary(item, now.toFormat('yyyy-LL-dd HH:mm:ss')));
    else await sendTelegram(formatItinerary(item, now.toFormat('yyyy-LL-dd HH:mm:ss')));
  }
  await saveState(config.stateFile, markSuccess(state, itineraries));
} catch (error) {
  console.error(`항공편 검색 실패: ${error.message}`);
  const failed = markFailure(state);
  if (failed.consecutiveErrors >= 3 && !state.errorAlertSent) {
    await sendTelegram(`항공권 감시 점검 필요\n검색 오류가 ${failed.consecutiveErrors}회 연속 발생했습니다. GitHub Actions 로그와 artifact를 확인하세요.\n확인 시각(KST): ${now.toFormat('yyyy-LL-dd HH:mm:ss')}`).catch((sendError) => console.error(sendError.message));
  }
  await saveState(config.stateFile, failed);
  process.exitCode = 1;
}
