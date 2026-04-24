/**
 * src/data/index.ts — data access layer
 *
 * Fetches live usage data from the Express API server.
 *
 * To update data:
 *   1. Export a spend report from claude.ai/analytics/activity
 *   2. Save it as data/latest-report.csv
 *   3. Restart the server (npm run dev:full or npm run serve)
 */

import type { UsageRecord } from "./parseReport";

export type { UsageRecord };

const API_URL = "/api/usage";

export async function getUsageData(): Promise<UsageRecord[]> {
  const res = await fetch(API_URL);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `API returned ${res.status}`);
  }
  const records: UsageRecord[] = await res.json();
  console.info(`[data] Loaded ${records.length} records from live CSV.`);
  return records;
}
