import fs from 'node:fs/promises';
import path from 'node:path';

export const emptyState = () => ({ version: 1, active: [], consecutiveErrors: 0, errorAlertSent: false });

export async function loadState(file) {
  try {
    const parsed = JSON.parse(await fs.readFile(file, 'utf8'));
    return { ...emptyState(), ...parsed };
  } catch (error) {
    if (error.code !== 'ENOENT') console.warn(`상태 파일을 새로 시작합니다: ${error.message}`);
    return emptyState();
  }
}

export async function saveState(file, state) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp`;
  await fs.writeFile(temp, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  await fs.rename(temp, file);
}

export function fingerprint(match) {
  const leg = match.leg || match.outbound;
  return [match.type || 'legacy', leg.airline, leg.flightNumber, leg.date, leg.departure, leg.arrival].join('|');
}

export function unseenItineraries(itineraries, state) {
  const prior = new Set(state.active);
  return itineraries.filter((item) => !prior.has(fingerprint(item)));
}

export function markSuccess(state, itineraries) {
  return { ...state, active: itineraries.map(fingerprint), consecutiveErrors: 0, errorAlertSent: false };
}

export function markFailure(state) {
  const consecutiveErrors = state.consecutiveErrors + 1;
  return { ...state, consecutiveErrors, errorAlertSent: state.errorAlertSent || consecutiveErrors >= 3 };
}
