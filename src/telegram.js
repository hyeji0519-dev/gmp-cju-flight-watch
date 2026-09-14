function credentials() {
  return { token: process.env.TELEGRAM_BOT_TOKEN, chatId: process.env.TELEGRAM_CHAT_ID };
}

export async function sendTelegram(text) {
  const { token, chatId } = credentials();
  if (!token || !chatId) {
    console.log('텔레그램 Secret이 없어 발송을 안전하게 건너뜁니다.');
    return false;
  }
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true })
  });
  if (!response.ok) throw new Error(`텔레그램 전송 실패(HTTP ${response.status})`);
  return true;
}

const AIRPORTS = { GMP: '김포', CJU: '제주', ICN: '인천' };
const airportName = (code) => (AIRPORTS[code] ? `${AIRPORTS[code]}(${code})` : code);

export function formatMatch(item, checkedAt, adults = 2) {
  const { leg } = item;
  const from = leg.from || 'CJU';
  const to = leg.to || 'GMP';
  return [
    `${AIRPORTS[from] || from}→${AIRPORTS[to] || to} ${adults}인 예약 가능 항공편 발견`,
    '',
    `구간: ${airportName(from)} → ${airportName(to)}`,
    `항공편: ${leg.airline} ${leg.flightNumber}`,
    `${leg.date} ${leg.departure} → ${leg.arrival}`,
    item.price ? `검색 가격: ${item.price}` : null,
    `검색 결과: ${item.url}`,
    `확인 시각(KST): ${checkedAt}`,
    '',
    `※ 성인 ${adults}명 편도 검색에서 실제 가격과 결과가 반환된 것을 기준으로 한 예약 가능 추정입니다.`,
    '실시간으로 좌석이 소진될 수 있으니 직접 최종 확인하세요.'
  ].filter(Boolean).join('\n');
}
