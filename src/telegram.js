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

export function formatMatch(item, checkedAt) {
  const isOutbound = item.type === 'outbound';
  const title = isOutbound ? '서울→제주 2인 예약 가능 출발편 발견' : '제주→서울 2인 예약 가능 귀국편 발견';
  const route = isOutbound ? '김포(GMP) → 제주(CJU)' : '제주(CJU) → 김포(GMP)';
  return [
    title,
    '',
    `구간: ${route}`,
    `항공편: ${item.leg.airline} ${item.leg.flightNumber}`,
    `${item.leg.date} ${item.leg.departure} → ${item.leg.arrival}`,
    item.price ? `검색 가격: ${item.price}` : null,
    `검색 결과: ${item.url}`,
    `확인 시각(KST): ${checkedAt}`,
    '',
    '※ 성인 2명 편도 검색에서 실제 가격과 결과가 반환된 것을 기준으로 한 예약 가능 추정입니다.',
    '실시간으로 좌석이 소진될 수 있으니 직접 최종 확인하세요.'
  ].filter(Boolean).join('\n');
}
