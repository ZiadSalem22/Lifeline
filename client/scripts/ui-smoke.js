#!/usr/bin/env node
// UI smoke test using Puppeteer: creates 5 todos and checks for taskNumber badges
async function run() {
  let puppeteer;
  try {
    // Puppeteer v24+ is published as ESM; use dynamic import so this script works under CommonJS node too.
    // `import()` returns the module namespace; puppeteer is the default export.
    puppeteer = (await import('puppeteer')).default || (await import('puppeteer'));
  } catch (e) {
    console.error('Puppeteer is not installed or failed to load. Run `npm install puppeteer --save-dev` in the client folder and re-run this script.');
    process.exit(2);
  }

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'], ignoreHTTPSErrors: true });
  const page = await browser.newPage();
  // Allow overriding the UI base URL via `UI_BASE_URL` env var. Default to the common Vite dev port 5173,
  // but also accept 5174 if Vite picked that when 5173 was busy.
  const base = process.env.UI_BASE_URL || 'https://localhost:5173';
  try {
    console.log('Opening', base);
    await page.goto(base, { waitUntil: 'networkidle2', timeout: 30000 });

    // small compatibility sleep helper — avoids using `page.waitForTimeout` which may be unavailable
    const sleep = (ms) => new Promise(res => setTimeout(res, ms));

    // Wait for the app shell to render: look for the New Todo input or Create button
    // Try common placeholders and input/button selectors used in the app
    // Prefer the add-card title input used by the app; fall back to other text inputs
    const createSelectors = [
      'input[placeholder="Title — What do you want to accomplish?"]',
      'input[placeholder="Load task #"]',
      'input[placeholder="New task"]',
      'input[placeholder="Title"]',
      'input[placeholder="Add a task"]',
      'input[type="text"]'
    ];

    let chosenSelector = null;
    for (const sel of createSelectors) {
      try {
        const h = await page.$(sel);
        if (h) { chosenSelector = sel; break; }
      } catch (_) {}
    }

    if (!chosenSelector) {
      // As a fallback, focus the document body and open the Add Task dialog if present
      console.warn('Create input not found by simple selectors; attempting to open Create Task panel');
      // Try clicking a button labelled 'Add' or 'New Task'
      const btn = await page.$x("//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'add') or contains(., 'New Task')]");
      if (btn && btn.length) await btn[0].click();
      await sleep(500);
      inputHandle = await page.$('input[type=text]');
      if (inputHandle) chosenSelector = 'input[type=text]';
    }

    if (!chosenSelector) {
      throw new Error('Could not find a task create input on the page.');
    }
    // Create 5 tasks: query the chosen selector each time (elements may re-render)
    for (let i = 1; i <= 5; i++) {
      const title = `UI Smoke Task ${i}`;
      let inputEl = await page.$(chosenSelector);
      if (!inputEl) {
        // If the add-card closed after submit, try clicking the Add Task button to re-open it
        const addBtn = await page.$('button[aria-label="Add Task"]');
        if (addBtn) {
          await addBtn.click();
          await sleep(300);
          inputEl = await page.$(chosenSelector);
        }
      }
      if (!inputEl) throw new Error('Create input disappeared during test');
      await inputEl.click({ clickCount: 3 });
      await inputEl.type(title, { delay: 50 });
      // Press Enter to submit (app should handle Enter or there may be a Save button)
      await page.keyboard.press('Enter');
      // Wait a short time for task to appear
      await sleep(500);
    }

    // Wait for task cards to render and check badges
    let badges = [];
    try {
      await page.waitForSelector('span[title^="Task #"], .task-card', { timeout: 5000 });
      badges = await page.$$eval('span[title^="Task #"], .task-number-badge, .task-card .badge, .task-card .task-number', els => els.map(e => e.textContent.trim()));
    } catch (e) {
      // Capture debug artifacts to help diagnose markup mismatch
      try {
        const fs = await import('fs');
        const baseDir = process.cwd();
        const pngPath = `${baseDir}/scripts/ui-smoke-debug.png`;
        const htmlPath = `${baseDir}/scripts/ui-smoke-debug.html`;
        await page.screenshot({ path: pngPath, fullPage: true });
        const html = await page.content();
        fs.writeFileSync(htmlPath, html, 'utf8');
        console.error('Could not find task cards. Saved debug files:', pngPath, htmlPath);
      } catch (err) {
        console.error('Failed to save debug artifacts:', err && err.message ? err.message : err);
      }
      throw e;
    }

    console.log('Badges found (sample):', badges.slice(0, 10));

    // Verify numbers 1..5 exist
    const found = [1,2,3,4,5].every(n => badges.some(b => b.includes(`#${n}`) || b === String(n) || b.includes(String(n))));
    if (!found) {
      console.error('Did not find sequential badges #1..#5 in the task list.');
      process.exit(3);
    }

    console.log('UI smoke test passed: found task number badges #1..#5');
    await browser.close();
    process.exit(0);
  } catch (err) {
    console.error('UI smoke test failed:', err && err.message ? err.message : err);
    try { await browser.close(); } catch (e) {}
    process.exit(4);
  }
}

run();
