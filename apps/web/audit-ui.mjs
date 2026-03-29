import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = 'http://localhost:3000';
const DIR = '/tmp/vibeedit-screenshots';

const pages = [
  { name: 'landing-top', url: '/', scroll: 0 },
  { name: 'landing-pain', url: '/', scroll: 900 },
  { name: 'landing-mid', url: '/', scroll: 2000 },
  { name: 'landing-pricing', url: '/', scroll: 3500 },
  { name: 'landing-bottom', url: '/', scroll: 5000 },
  { name: 'login', url: '/login', scroll: 0 },
  { name: 'register', url: '/register', scroll: 0 },
  { name: 'pricing', url: '/pricing', scroll: 0 },
  { name: 'dashboard', url: '/dashboard', scroll: 0 },
];

async function run() {
  mkdirSync(DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });

  for (const p of pages) {
    const page = await ctx.newPage();
    try {
      await page.goto(`${BASE}${p.url}`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(1500); // let animations settle
      if (p.scroll > 0) {
        await page.evaluate((y) => window.scrollTo(0, y), p.scroll);
        await page.waitForTimeout(800);
      }
      const path = `${DIR}/${p.name}.png`;
      await page.screenshot({ path, fullPage: false });
      console.log(`✓ ${p.name} → ${path}`);
    } catch (e) {
      console.log(`✗ ${p.name}: ${e.message}`);
    }
    await page.close();
  }

  await browser.close();
  console.log(`\nAll screenshots saved to ${DIR}/`);
}

run();
