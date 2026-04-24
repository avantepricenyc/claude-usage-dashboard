/**
 * scripts/login.ts
 *
 * Exports your active claude.ai session (including httpOnly cookies like
 * sessionKey) into data/auth.json for use by fetch-report.ts.
 *
 * ── Why standard storageState() doesn't work ──────────────────────────────
 * Playwright's storageState() collects cookies via the JS cookie API, which
 * intentionally omits httpOnly cookies. claude.ai's sessionKey is httpOnly,
 * so it never appears in a standard export.
 *
 * ── Solution ──────────────────────────────────────────────────────────────
 * We use the Chrome DevTools Protocol (CDP) Network.getAllCookies command,
 * which returns ALL cookies including httpOnly ones, then write them into
 * the same auth.json format that Playwright's newContext({ storageState })
 * accepts.
 *
 * Usage:  npm run login
 *
 * Chrome must be closed (or not have the profile locked) when this runs,
 * because we open it via launchPersistentContext with your real profile.
 * If Chrome is open, quit it first, run `npm run login`, then reopen Chrome.
 */

import { chromium } from "playwright";
import * as fs   from "fs";
import * as path from "path";
import * as os   from "os";

const ANALYTICS_URL = "https://claude.ai/analytics/activity";
const OUTPUT_DIR    = path.resolve(process.cwd(), "data");
const AUTH_FILE     = path.join(OUTPUT_DIR, "auth.json");

const CHROME_PROFILE_NAME = process.env.CHROME_PROFILE ?? "Default";
const CHROME_USER_DATA    = path.join(os.homedir(), "Library/Application Support/Google/Chrome");
const CHROME_PROFILE_DIR  = path.join(CHROME_USER_DATA, CHROME_PROFILE_NAME);

function log(msg: string) { console.log(`[login] ${msg}`); }

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  if (!fs.existsSync(CHROME_PROFILE_DIR)) {
    console.error(`Chrome profile not found: ${CHROME_PROFILE_DIR}`);
    process.exit(1);
  }

  console.log("────────────────────────────────────────────────────────────");
  console.log("  NOTE: Chrome must be closed before running this script.");
  console.log("  A Chrome window will open, load claude.ai, then close.");
  console.log("  If you are already logged in it will complete in seconds.");
  console.log("────────────────────────────────────────────────────────────\n");

  const browser = await chromium.launchPersistentContext(CHROME_PROFILE_DIR, {
    headless: false,
    channel:  "chrome",
    args: [
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-sync",
      "--disable-blink-features=AutomationControlled",
    ],
  });

  const page = browser.pages()[0] ?? await browser.newPage();
  page.setDefaultTimeout(5 * 60_000);

  log("Navigating to analytics page…");
  await page.goto(ANALYTICS_URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3_000);

  const isOnClaude = (url: string) =>
    url.includes("claude.ai") && !url.includes("login");

  if (!isOnClaude(page.url())) {
    log("Not logged in — please complete login in the browser window…");
    await page.waitForURL(isOnClaude, { timeout: 5 * 60_000 }).catch(() => {
      console.error("Timed out waiting for login. Run `npm run login` again.");
      process.exit(1);
    });
    await page.waitForTimeout(2_000);
  }

  log("Session confirmed. Exporting ALL cookies via CDP (including httpOnly)…");

  // Use CDP to get all cookies — this includes httpOnly cookies that
  // storageState() intentionally omits.
  const cdpSession = await browser.newCDPSession(page);
  const { cookies } = await cdpSession.send("Network.getAllCookies") as {
    cookies: Array<{
      name: string;
      value: string;
      domain: string;
      path: string;
      expires: number;
      httpOnly: boolean;
      secure: boolean;
      sameSite?: string;
    }>;
  };

  log(`Got ${cookies.length} cookies via CDP.`);

  // Filter to just claude.ai + anthropic.com cookies
  const relevant = cookies.filter(
    (c) => c.domain.includes("claude.ai") || c.domain.includes("anthropic.com")
  );
  log(`Filtered to ${relevant.length} claude.ai / anthropic.com cookies.`);

  // Write in Playwright storageState format
  const storageState = {
    cookies: relevant.map((c) => ({
      name:     c.name,
      value:    c.value,
      domain:   c.domain,
      path:     c.path,
      expires:  c.expires,
      httpOnly: c.httpOnly,
      secure:   c.secure,
      sameSite: (c.sameSite ?? "None") as "Strict" | "Lax" | "None",
    })),
    origins: [] as unknown[],
  };

  fs.writeFileSync(AUTH_FILE, JSON.stringify(storageState, null, 2), "utf-8");
  log(`Saved ${relevant.length} cookies → ${AUTH_FILE}`);
  log("Run `npm run fetch-report` to test, or let the cron job pick it up.");

  await browser.close();
}

main().catch((err) => { console.error("[login FATAL]", err); process.exit(1); });
