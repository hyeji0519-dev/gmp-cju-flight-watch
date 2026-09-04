import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const clean = (value = '') => value.replace(/\s+/g, ' ').trim();

export const hasBookablePrice = (text) => {
  if (/total price is unavailable|price unavailable/i.test(text)) return false;
  return /₩\s*[\d,]+|\b[\d,]+\s*(?:Korean won|KRW)\b/i.test(text);
};

const time24 = (h, m, ampm) => {
  let hour = Number(h) % 12;
  if (/PM/i.test(ampm)) hour += 12;
  return `${String(hour).padStart(2, '0')}:${m}`;
};

// tfs: Google Flights search parameter (base64 protobuf).
// Structure discovered by inspection: trip type + fixed byte + outbound leg + return leg + trailing.
// Always encoded as round-trip because one-way tfs codes get normalized back to round-trip anyway;
// we parse the "Departing flights" section which is the outbound leg either way.
function buildTfs(outbound, returnLeg) {
  const bytes = [
    0x08, 0x1c,   // trip type: round trip
    0x10, 0x02    // fixed
  ];
  const appendLeg = (leg) => {
    bytes.push(0x1a, 0x1e, 0x12, 0x0a);
    for (const c of leg.date) bytes.push(c.charCodeAt(0));
    bytes.push(0x6a, 0x07, 0x08, 0x01, 0x12, 0x03);
    for (const c of leg.from) bytes.push(c.charCodeAt(0));
    bytes.push(0x72, 0x07, 0x08, 0x01, 0x12, 0x03);
    for (const c of leg.to) bytes.push(c.charCodeAt(0));
  };
  appendLeg(outbound);
  appendLeg(returnLeg);
  bytes.push(
    0x40, 0x01, 0x48, 0x01, 0x70, 0x01,
    0x82, 0x01, 0x0b,
    0x08, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x01,
    0x98, 0x01, 0x01
  );
  return Buffer.from(bytes).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function buildSearchUrl(leg) {
  // Pair the leg we care about with an arbitrary return leg (+7 days). We only ever parse the
  // outbound section, so the return leg is discarded downstream.
  const dt = new Date(`${leg.date}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + 7);
  const returnDate = dt.toISOString().slice(0, 10);
  const dummy = { from: leg.to, to: leg.from, date: returnDate };
  const tfs = buildTfs(leg, dummy);
  return `https://www.google.com/travel/flights?hl=en&curr=KRW&tfs=${tfs}`;
}

async function setPassengerCount(page, adults) {
  if (adults <= 1) return;
  const paxBtn = page.locator('button[aria-label*="passenger"]').first();
  await paxBtn.click();
  await page.waitForTimeout(600);
  const addAdult = page.locator('button[aria-label="Add adult"]').first();
  for (let i = 1; i < adults; i += 1) {
    await addAdult.click();
    await page.waitForTimeout(150);
  }
  // Done button — the FIRST visible <button> whose exact text is "Done"
  const doneBtn = page.locator('button').filter({ hasText: /^Done$/ }).first();
  await doneBtn.click();
  await page.waitForTimeout(2500); // let results refresh
}

function parseAriaLabel(label, date) {
  const priceMatch = label.match(/From\s+([\d,]+)\s+(?:South\s+Korean\s+won|KRW|₩)/i)
    || label.match(/₩\s*([\d,]+)/);
  const bookable = hasBookablePrice(label);
  const airlineMatch = label.match(/Nonstop flight with ([^.]+?)\./i)
    || label.match(/flight with ([^.]+?)\./i);
  const depMatch = label.match(/Leaves\s+.+?\s+at\s+(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  const arrMatch = label.match(/arrives at\s+.+?\s+at\s+(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  return {
    airline: airlineMatch ? clean(airlineMatch[1]) : '항공사 확인 필요',
    flightNumber: '편명 별도 확인',
    date,
    departure: depMatch ? time24(depMatch[1], depMatch[2], depMatch[3]) : null,
    arrival: arrMatch ? time24(arrMatch[1], arrMatch[2], arrMatch[3]) : null,
    price: priceMatch ? `₩${priceMatch[1]}` : null,
    bookable
  };
}

async function searchOneWay(config, type, leg, notBefore = '00:00') {
  await fs.mkdir(config.artifactsDir, { recursive: true });
  const browser = await chromium.launch({ headless: process.env.HEADLESS !== '0' });
  const context = await browser.newContext({ locale: 'en-US', timezoneId: config.timezone });
  const page = await context.newPage();
  try {
    const url = buildSearchUrl(leg);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    if (/captcha|unusual traffic/i.test(await page.title()) || await page.locator('iframe[src*="recaptcha"]').count()) {
      throw new Error('Google이 CAPTCHA 또는 비정상 트래픽 확인을 요구했습니다(우회하지 않음).');
    }
    // Wait for the passenger UI to render (marker that the SPA has hydrated).
    await page.locator('button[aria-label*="passenger"]').first().waitFor({ state: 'visible', timeout: 60000 });
    await setPassengerCount(page, config.passengers.adults);
    const cards = page.locator('div[role="link"][aria-label*="Nonstop flight with"]');
    await cards.first().waitFor({ state: 'visible', timeout: 90000 });

    const results = [];
    const total = Math.min(await cards.count(), 60);
    for (let i = 0; i < total; i += 1) {
      const label = await cards.nth(i).getAttribute('aria-label');
      if (!label) continue;
      const parsed = parseAriaLabel(label, leg.date);
      if (!parsed.bookable || !parsed.departure || !parsed.arrival) continue;
      if (parsed.departure < notBefore) continue;
      results.push({ type, leg: parsed, price: parsed.price, url: page.url() });
      if (results.length >= config.maxResults) break;
    }
    return results;
  } catch (error) {
    await page.screenshot({ path: path.join(config.artifactsDir, 'failure.png'), fullPage: true }).catch(() => {});
    await fs.writeFile(path.join(config.artifactsDir, 'failure.html'), await page.content()).catch(() => {});
    throw error;
  } finally {
    await browser.close();
  }
}

export async function searchGoogleFlights(config) {
  const MAX_ATTEMPTS = 3;
  const inbounds = config.inbounds ?? (config.inbound ? [config.inbound] : []);
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const outbound = await searchOneWay(config, 'outbound', config.outbound, config.outbound.notBefore);
      const inboundResults = [];
      for (const leg of inbounds) {
        const legResults = await searchOneWay(config, `inbound-${leg.date}`, leg);
        inboundResults.push(...legResults);
      }
      return [...outbound, ...inboundResults].slice(0, config.maxResults);
    } catch (error) {
      lastError = error;
      if (attempt < MAX_ATTEMPTS) {
        console.warn(`Google Flights 조회 ${attempt}차 실패, 새 브라우저로 재시도합니다: ${error.message}`);
        await new Promise((resolve) => setTimeout(resolve, 5000 * attempt));
      }
    }
  }
  throw lastError;
}
