/**
 * scripts/browser.ts
 *
 * Shared helper that launches a Playwright persistent context using the
 * system-installed Google Chrome binary.
 *
 * Using system Chrome (not Playwright's bundled Chromium) is required because
 * claude.ai sits behind Cloudflare bot-protection. Cloudflare recognises and
 * blocks bundled Chromium's headless fingerprint; the real Chrome binary passes.
 *
 * Throws a clear error if Chrome is not found so the user knows what to install.
 */

import { chromium, type BrowserContext } from "playwright";
import * as fs   from "fs";
import * as path from "path";
import * as os   from "os";

export const CHROME_PROFILE_NAME = process.env.CHROME_PROFILE ?? "Default";
export const CHROME_USER_DATA    = path.join(
  os.homedir(),
  "Library/Application Support/Google/Chrome"
);
export const CHROME_PROFILE_DIR  = path.join(CHROME_USER_DATA, CHROME_PROFILE_NAME);

const LAUNCH_ARGS = [
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-extensions",
  "--disable-sync",
  "--disable-blink-features=AutomationControlled", // hides navigator.webdriver
];

/**
 * Copy only the Cookies + Network Persistent State files from the real Chrome
 * profile into a fresh temp directory. Fast (< 1 ms) and leaves the original
 * profile untouched.
 */
export function buildProfileSnapshot(): string {
  const tmpDir     = fs.mkdtempSync(path.join(os.tmpdir(), "cud-profile-"));
  const tmpDefault = path.join(tmpDir, "Default");
  fs.mkdirSync(tmpDefault, { recursive: true });

  for (const file of ["Cookies", "Network Persistent State"]) {
    const src = path.join(CHROME_PROFILE_DIR, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(tmpDefault, file));
    }
  }
  return tmpDir;
}

export function cleanupSnapshot(tmpDir: string) {
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* non-fatal */ }
}

/**
 * Launch a persistent Chromium context using system Chrome.
 * Always uses the real Chrome binary — required to pass Cloudflare.
 */
export async function launchWithProfile(
  tmpDir: string,
  headless = true
): Promise<BrowserContext> {
  try {
    return await chromium.launchPersistentContext(tmpDir, {
      headless,
      channel:         "chrome",
      acceptDownloads: true,
      args:            LAUNCH_ARGS,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // Surface a useful error if Chrome isn't installed
    if (msg.includes("chrome") || msg.includes("Chromium") || msg.includes("executable")) {
      throw new Error(
        "System Chrome not found.\n" +
        "  Install Google Chrome from https://www.google.com/chrome/ and re-run."
      );
    }
    throw err;
  }
}
