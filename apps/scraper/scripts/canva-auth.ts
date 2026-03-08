import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const STORAGE_PATH = path.resolve(import.meta.dirname, '../canva-auth-state.json');
const CHROME_PROFILE = path.join(
  process.env.HOME || '',
  'Library/Application Support/Google/Chrome/Profile 1'
);

async function main() {
  console.log('==========================================================');
  console.log(' Close Chrome completely first! (Cmd+Q)');
  console.log(' Waiting 15 seconds...');
  console.log('==========================================================\n');

  await new Promise(r => setTimeout(r, 15000));

  console.log('Opening Chrome with your profile (Olcay - Jotform)...\n');

  const context = await chromium.launchPersistentContext(CHROME_PROFILE, {
    headless: false,
    channel: 'chrome',
    args: ['--disable-blink-features=AutomationControlled'],
    ignoreDefaultArgs: ['--enable-automation'],
  });

  // Capture search API requests and responses
  const searchCalls: { url: string; reqHeaders: Record<string, string>; reqBody: string; resBody: string }[] = [];

  // Intercept requests to get headers and body
  context.on('request', (request) => {
    const url = request.url();
    if (url.includes('/_ajax/appsearch/')) {
      const headers = request.headers();
      const postData = request.postData() || '';
      console.log(`\n[REQ] POST ${url}`);
      console.log(`  Body: ${postData.substring(0, 200)}`);
      console.log(`  Content-Type: ${headers['content-type']}`);
      console.log(`  Cookie length: ${(headers['cookie'] || '').length}`);
      // Save for matching with response
      searchCalls.push({
        url,
        reqHeaders: headers,
        reqBody: postData,
        resBody: '', // filled in response handler
      });
    }
  });

  context.on('response', async (response) => {
    const url = response.url();
    if (url.includes('/_ajax/appsearch/')) {
      try {
        const body = await response.text();
        // Match with the request
        const call = searchCalls.find(c => c.url === url && !c.resBody);
        if (call) call.resBody = body;
        console.log(`[RES] ${url} → ${body.length} bytes`);
      } catch {}
    }
  });

  const page = context.pages()[0] || await context.newPage();

  // Navigate to /apps
  console.log('Loading /apps page...');
  await page.goto('https://www.canva.com/apps', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);

  // Find and use the search input
  console.log('Searching for "form"...');
  const searchInput = await page.$('input[type="search"], input[placeholder*="Search"], input[aria-label*="Search"], input[aria-label*="search"]');
  if (searchInput) {
    await searchInput.click();
    await page.waitForTimeout(500);
    await searchInput.fill('form');
    await page.waitForTimeout(1000);
    await page.keyboard.press('Enter');
  } else {
    await page.goto('https://www.canva.com/your-apps?q=form', { waitUntil: 'domcontentloaded', timeout: 60000 });
  }

  // Wait for search results
  console.log('Waiting 15s for search API calls...');
  await page.waitForTimeout(15000);

  // Save all captured search API calls
  console.log(`\n=== CAPTURED ${searchCalls.length} SEARCH API CALLS ===`);
  searchCalls.forEach((call, i) => {
    console.log(`\n--- Call ${i + 1}: ${call.url} ---`);
    console.log(`Request body: ${call.reqBody.substring(0, 300)}`);
    console.log(`Response length: ${call.resBody.length}`);

    // Save full details
    fs.writeFileSync(`/tmp/canva-search-call-${i}.json`, JSON.stringify({
      url: call.url,
      requestHeaders: call.reqHeaders,
      requestBody: call.reqBody,
      responseBody: call.resBody,
    }, null, 2));
  });

  // Save auth state
  const state = await context.storageState();
  fs.writeFileSync(STORAGE_PATH, JSON.stringify(state, null, 2));
  console.log(`\nAuth state saved: ${STORAGE_PATH}`);

  await context.close();
}

main().catch(e => { console.error(e); process.exit(1); });
