/**
 * scripts/debug-page.ts
 *
 * Navigates to the analytics page and dumps:
 *  - A screenshot → data/debug-screenshot.png
 *  - The full page HTML → data/debug-page.html
 *  - All button/interactive element text printed to console
 *
 * Requires data/auth.json — run `npm run login` first if it doesn't exist.
 *
 * Run:  npm run debug-page
 */

import { chromium } from "playwright";
import * as fs   from "fs";
import * as path from "path";

const ANALYTICS_URL  = "https://claude.ai/analytics/activity";
const OUTPUT_DIR     = path.resolve(process.cwd(), "data");
const AUTH_FILE      = path.join(OUTPUT_DIR, "auth.json");
const SCREENSHOT_OUT = path.join(OUTPUT_DIR, "debug-screenshot.png");
const HTML_OUT       = path.join(OUTPUT_DIR, "debug-page.html");

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  if (!fs.existsSync(AUTH_FILE)) {
    console.error("No auth.json found — run `npm run login` first.");
    process.exit(1);
  }

  const browser = await chromium.launch({
    headless: true,
    channel:  "chrome",
    args: ["--disable-blink-features=AutomationControlled"],
  });

  const context = await browser.newContext({ storageState: AUTH_FILE });
  const page    = context.pages()[0] ?? await context.newPage();
  page.setDefaultTimeout(60_000);

  try {
    console.log("Navigating…");
    await page.goto(ANALYTICS_URL, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(8_000);

    await page.screenshot({ path: SCREENSHOT_OUT, fullPage: true });
    console.log(`Screenshot → ${SCREENSHOT_OUT}`);

    const html = await page.content();
    fs.writeFileSync(HTML_OUT, html, "utf-8");
    console.log(`HTML       → ${HTML_OUT}`);

    const elements = await page.evaluate(() => {
      const results: { tag: string; text: string; ariaLabel: string }[] = [];
      document.querySelectorAll("button, [role='button'], a[href]").forEach((el) => {
        results.push({
          tag:       el.tagName.toLowerCase(),
          text:      (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 120),
          ariaLabel: el.getAttribute("aria-label") ?? "",
        });
      });
      return results;
    });

    console.log(`\nInteractive elements (${elements.length}):\n`);
    elements.forEach((el, i) => {
      const label = el.ariaLabel ? ` [aria="${el.ariaLabel}"]` : "";
      console.log(`  ${String(i + 1).padStart(3)}. <${el.tag}>${label} "${el.text}"`);
    });

  } finally {
    await browser.close();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
