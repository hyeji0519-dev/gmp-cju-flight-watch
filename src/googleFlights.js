import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const clean = (value = '') => value.replace(/\s+/g, ' ').trim();
const time24 = (text) => {
  const m = text.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return null;
  let hour = Number(m[1]) % 12;
  if (m[3].toUpperCase() === 'PM') hour += 12;
  return `${String(hour).padStart(2, '0')}:${m[2]}`;
};

async function clickNamed(page, names) {
  for (const name of names) {
    const target = page.getByRole('button', { name, exact: false }).first();
    if (await target.count()) { await target.click(); return; }
  }
  throw new Error(`버튼을 찾지 못함: ${names.join(', ')}`);
}

async function clickVisible(locator) {
  for (let i = 0; i < await locator.count(); i += 1) {
    const candidate = locator.nth(i);
    if (await candidate.isVisible()) { await candidate.click(); return; }
  }
  throw new Error('화면에 보이는 버튼을 찾지 못했습니다.');
}

async function setAirport(page, label, code) {
  const field = page.locator(`[aria-label^="${label}"]`).first();
  await field.click();
  const kind = /from/i.test(label) ? 'origin' : 'destination';
  const dialog = page.getByRole('dialog', { name: `Enter your ${kind}` });
  const input = dialog.getByRole('combobox').first();
  await input.fill(code);
  await page.waitForTimeout(800);
  await page.locator(`[aria-label*="(${code})"]`).first().click();
}

async function setPassengers(page) {
  await clickNamed(page, [/passenger/i, /1 passenger/i]);
  const addAdult = page.locator('button[aria-label="Add adult"]').last();
  const addChild = page.locator('button[aria-label="Add child aged 2 to 11"]').last();
  if (!await addAdult.count() || !await addChild.count()) throw new Error('승객 추가 버튼 구조를 인식하지 못했습니다.');
  await addAdult.click(); // adult 1 -> 2
  await addChild.click();
  await addChild.click(); // child 0 -> 2
  await clickNamed(page, [/done/i]);
}

async function setDates(page, outbound, inbound) {
  const departure = page.locator('input[aria-label="Departure"]').first();
  await departure.click();

  const dateLabel = (iso) => new Intl.DateTimeFormat('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'
  }).format(new Date(`${iso}T12:00:00Z`));
  const selectCalendarDate = async (iso) => {
    const label = dateLabel(iso);
    for (let month = 0; month < 18; month += 1) {
      const day = page.locator(`[aria-label="${label}"]`).last();
      if (await day.count() && await day.isVisible()) { await day.click(); return; }
      await page.locator('button[aria-label="Next"]').last().click();
    }
    throw new Error(`달력에서 날짜를 찾지 못했습니다: ${label}`);
  };

  await selectCalendarDate(outbound);
  await selectCalendarDate(inbound);
  const calendar = page.getByRole('dialog').last();
  await clickVisible(page.getByRole('button', { name: /^Done/ }));
  await calendar.waitFor({ state: 'hidden', timeout: 10000 });
}

async function cards(page) {
  const result = page.locator('[aria-label*="flight with"][aria-label$="Select flight"]');
  await result.first().waitFor({ state: 'visible', timeout: 60000 });
  return result;
}

async function waitForLeg(page, originName) {
  const result = page.locator(`[aria-label*="flight with"][aria-label*="Leaves ${originName}"][aria-label$="Select flight"]`);
  await result.first().waitFor({ state: 'visible', timeout: 60000 });
  return result;
}

async function parseCard(card, date) {
  const label = clean(await card.getAttribute('aria-label'));
  const text = `${label} ${clean(await card.innerText())}`;
  const times = [...text.matchAll(/\b\d{1,2}:\d{2}\s*(?:AM|PM)\b/gi)].map((m) => time24(m[0])).filter(Boolean);
  const flight = text.match(/\b([A-Z0-9]{2})\s?(\d{2,4})\b/);
  const price = text.match(/₩[\d,]+/)?.[0] || null;
  const airline = label.match(/flight with (.+?)\. Leaves/i)?.[1] || '항공사 확인 필요';
  return { airline, flightNumber: flight ? `${flight[1]}${flight[2]}` : '편명 확인 필요', date, departure: times[0], arrival: times[1], price };
}

async function searchOnce(config) {
  await fs.mkdir(config.artifactsDir, { recursive: true });
  const browser = await chromium.launch({ headless: process.env.HEADLESS !== '0' });
  const context = await browser.newContext({ locale: 'en-US', timezoneId: config.timezone });
  const page = await context.newPage();
  try {
    await page.goto(config.searchUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    if (/captcha|unusual traffic/i.test(await page.title()) || await page.locator('iframe[src*="recaptcha"]').count()) {
      throw new Error('Google이 CAPTCHA 또는 비정상 트래픽 확인을 요구했습니다(우회하지 않음).');
    }
    await setPassengers(page);
    await setAirport(page, 'Where from', config.outbound.from);
    await setAirport(page, 'Where to', config.outbound.to);
    await setDates(page, config.outbound.date, config.inbound.date);
    await page.locator('button[aria-label="Search"]').click();

    const outboundCards = await cards(page);
    const outbound = [];
    for (let i = 0; i < Math.min(await outboundCards.count(), 50); i += 1) {
      const card = outboundCards.nth(i);
      const parsed = await parseCard(card, config.outbound.date);
      if (parsed.departure && parsed.departure >= config.outbound.notBefore) {
        outbound.push({ parsed, label: await card.getAttribute('aria-label') });
      }
    }
    const results = [];
    for (const choice of outbound.slice(0, 5)) {
      await cards(page);
      const selectedCard = page.getByRole('link', { name: choice.label, exact: true });
      await selectedCard.waitFor({ state: 'visible' });
      await selectedCard.focus();
      await selectedCard.press('Enter');
      const inboundCards = await waitForLeg(page, 'Jeju');
      for (let j = 0; j < Math.min(await inboundCards.count(), 20); j += 1) {
        const inbound = await parseCard(inboundCards.nth(j), config.inbound.date);
        if (!inbound.departure || !inbound.arrival) continue;
        results.push({
          outbound: choice.parsed,
          inbound,
          totalPrice: inbound.price || choice.parsed.price,
          url: page.url()
        });
        if (results.length >= config.maxResults) break;
      }
      await page.goBack({ waitUntil: 'domcontentloaded' });
      await waitForLeg(page, 'Gimpo');
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
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return await searchOnce(config);
    } catch (error) {
      lastError = error;
      if (attempt < 2) console.warn(`Google Flights 조회 ${attempt}차 실패, 새 브라우저로 재시도합니다: ${error.message}`);
    }
  }
  throw lastError;
}
