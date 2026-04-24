/**
 * scripts/fetch-report.ts
 *
 * Fetches per-user token usage from the Anthropic Admin API and writes
 * data/latest-report.json for the dashboard to consume.
 *
 * Requires:  ANTHROPIC_ADMIN_KEY in .env (starts with sk-ant-admin-...)
 * Get one:   console.anthropic.com/settings/admin-keys  (org admin only)
 *
 * What it calls:
 *   GET /v1/organizations/users               — member list (id → name + email)
 *   GET /v1/organizations/usage_report/messages
 *       group_by[]=api_key_id, bucket_width=1d, last 90 days
 *
 * NOTE ON COVERAGE
 * ─────────────────
 * The Admin API usage_report covers **API key usage** and **claude.ai chat
 * usage that counts as overage on seat-based plans**. Standard seat-based
 * chat usage (within the included seat allowance) does NOT appear here —
 * it appears only in the spend-report CSV on claude.ai/analytics/activity.
 *
 * If your team is on a seat-based plan and usage is within seat limits, the
 * numbers from this API will be lower than the CSV export. In that case the
 * CSV export approach (see scripts/fetch-report-csv.ts) is the right source.
 *
 * Run:   npm run fetch-report
 * Cron:  0 6 * * * cd /path/to/project && npx tsx scripts/fetch-report.ts >> /tmp/fetch-report.log 2>&1
 */

import * as fs   from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BASE_URL   = "https://api.anthropic.com";
const API_VER    = "2023-06-01";
const OUTPUT_DIR = path.resolve(process.cwd(), "data");
const OUT_FILE   = path.join(OUTPUT_DIR, "latest-report.json");
const ARCHIVE_DIR = path.join(OUTPUT_DIR, "archive");

/** How many days back to fetch (Admin API max per request is 31d; we paginate) */
const DAYS_BACK = 90;

function log(msg: string) {
  console.log(`[fetch-report ${new Date().toISOString()}] ${msg}`);
}

// ---------------------------------------------------------------------------
// Typed API helpers
// ---------------------------------------------------------------------------

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface UsageBucket {
  starting_at: string;
  ending_at: string;
  results: {
    api_key_id: string | null;
    uncached_input_tokens: number;
    cache_read_input_tokens: number;
    cache_creation: { ephemeral_1h_input_tokens: number; ephemeral_5m_input_tokens: number };
    output_tokens: number;
  }[];
}

// Shape written to latest-report.json — consumed by src/data/parseReport.ts
export interface ApiUsageRecord {
  user_id: string;
  user_name: string;
  token_count: number;
  timestamp: string; // ISO 8601
}

async function apiFetch<T>(path: string, adminKey: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "x-api-key":         adminKey,
      "anthropic-version": API_VER,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${res.status} for ${path}: ${body}`);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Fetch all org members (paginated)
// ---------------------------------------------------------------------------

async function fetchAllUsers(adminKey: string): Promise<AdminUser[]> {
  const users: AdminUser[] = [];
  let afterId: string | undefined;

  while (true) {
    const qs = new URLSearchParams({ limit: "1000" });
    if (afterId) qs.set("after_id", afterId);

    const page = await apiFetch<{
      data: AdminUser[];
      has_more: boolean;
      last_id: string;
    }>(`/v1/organizations/users?${qs}`, adminKey);

    users.push(...page.data);
    if (!page.has_more) break;
    afterId = page.last_id;
  }

  log(`Fetched ${users.length} org members`);
  return users;
}

// ---------------------------------------------------------------------------
// Fetch usage report in 31-day windows, paginating within each window
// ---------------------------------------------------------------------------

async function fetchUsageBuckets(
  adminKey: string,
  startingAt: Date,
  endingAt: Date
): Promise<UsageBucket[]> {
  const buckets: UsageBucket[] = [];
  let pageToken: string | undefined;

  const qs = new URLSearchParams({
    starting_at: startingAt.toISOString(),
    ending_at:   endingAt.toISOString(),
    bucket_width: "1d",
    limit:        "31",
    "group_by[]": "api_key_id",
  });

  while (true) {
    if (pageToken) qs.set("page", pageToken);

    const page = await apiFetch<{
      data: UsageBucket[];
      has_more: boolean;
      next_page: string;
    }>(`/v1/organizations/usage_report/messages?${qs}`, adminKey);

    buckets.push(...page.data);
    if (!page.has_more) break;
    pageToken = page.next_page;
  }

  return buckets;
}

// ---------------------------------------------------------------------------
// Fetch API keys so we can map api_key_id → user
// ---------------------------------------------------------------------------

interface ApiKey {
  id: string;
  name: string;
  created_by: { id: string; type: string } | null;
}

async function fetchAllApiKeys(adminKey: string): Promise<ApiKey[]> {
  const keys: ApiKey[] = [];
  let afterId: string | undefined;

  while (true) {
    const qs = new URLSearchParams({ limit: "1000" });
    if (afterId) qs.set("after_id", afterId);

    const page = await apiFetch<{
      data: ApiKey[];
      has_more: boolean;
      last_id: string;
    }>(`/v1/organizations/api_keys?${qs}`, adminKey);

    keys.push(...page.data);
    if (!page.has_more) break;
    afterId = page.last_id;
  }

  log(`Fetched ${keys.length} API keys`);
  return keys;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const adminKey = process.env.ANTHROPIC_ADMIN_KEY;
  if (!adminKey) {
    console.error(
      "\n[fetch-report ERROR] ANTHROPIC_ADMIN_KEY is not set.\n" +
      "  1. Go to console.anthropic.com/settings/admin-keys\n" +
      "  2. Create an Admin API key (starts with sk-ant-admin-...)\n" +
      "  3. Add it to your .env:  ANTHROPIC_ADMIN_KEY=sk-ant-admin-...\n"
    );
    process.exit(1);
  }

  fs.mkdirSync(OUTPUT_DIR,  { recursive: true });
  fs.mkdirSync(ARCHIVE_DIR, { recursive: true });

  // ── 1. Fetch org members and API keys ──────────────────────────────────
  const [users, apiKeys] = await Promise.all([
    fetchAllUsers(adminKey),
    fetchAllApiKeys(adminKey).catch(() => {
      log("Could not fetch API keys (insufficient permissions) — usage will show org-level only");
      return [] as ApiKey[];
    }),
  ]);

  // Build lookup maps
  const userById  = new Map(users.map((u) => [u.id,    u]));
  const userByKey = new Map<string, AdminUser>(); // api_key_id → user

  for (const key of apiKeys) {
    if (key.created_by?.type === "user") {
      const user = userById.get(key.created_by.id);
      if (user) userByKey.set(key.id, user);
    }
  }

  // ── 2. Fetch usage in 31-day windows covering the last DAYS_BACK days ──
  const now   = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - DAYS_BACK);

  const allBuckets: UsageBucket[] = [];

  // Walk backwards in 31-day windows
  let windowEnd = new Date(now);
  while (windowEnd > start) {
    const windowStart = new Date(windowEnd);
    windowStart.setDate(windowStart.getDate() - 31);
    if (windowStart < start) windowStart.setTime(start.getTime());

    log(`Fetching usage ${windowStart.toISOString().slice(0, 10)} → ${windowEnd.toISOString().slice(0, 10)}`);
    const buckets = await fetchUsageBuckets(adminKey, windowStart, windowEnd);
    allBuckets.push(...buckets);

    windowEnd = new Date(windowStart);
  }

  log(`Got ${allBuckets.length} daily buckets total`);

  // ── 3. Flatten into UsageRecord[] ──────────────────────────────────────
  const records: ApiUsageRecord[] = [];

  for (const bucket of allBuckets) {
    for (const result of bucket.results) {
      const tokenCount =
        (result.uncached_input_tokens ?? 0) +
        (result.cache_read_input_tokens ?? 0) +
        (result.output_tokens ?? 0) +
        (result.cache_creation?.ephemeral_1h_input_tokens ?? 0) +
        (result.cache_creation?.ephemeral_5m_input_tokens ?? 0);

      if (tokenCount === 0) continue;

      // Resolve user from API key, fall back to "Unknown / Org-level"
      const user = result.api_key_id
        ? userByKey.get(result.api_key_id)
        : undefined;

      records.push({
        user_id:     user?.id    ?? result.api_key_id ?? "org",
        user_name:   user?.name  ?? user?.email ?? (result.api_key_id ? `key:${result.api_key_id.slice(-6)}` : "Org-level"),
        token_count: tokenCount,
        timestamp:   bucket.starting_at,
      });
    }
  }

  log(`Built ${records.length} usage records`);

  // ── 4. Write output ────────────────────────────────────────────────────
  fs.writeFileSync(OUT_FILE, JSON.stringify(records, null, 2), "utf-8");
  log(`Saved → ${OUT_FILE}`);

  const ts   = new Date().toISOString().replace(/[:.]/g, "-");
  const arch = path.join(ARCHIVE_DIR, `report-${ts}.json`);
  fs.copyFileSync(OUT_FILE, arch);
  log(`Archived → ${arch}`);

  log("Done.");
}

main().catch((err) => {
  console.error("[fetch-report FATAL]", err);
  process.exit(1);
});
