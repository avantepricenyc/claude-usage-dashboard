/**
 * src/data/parseReport.ts
 *
 * Parses a Claude.ai "Export Spend Report" CSV into UsageRecord[].
 *
 * Real CSV columns (as of 2026):
 *   user_email, account_uuid, product, model,
 *   total_requests, total_prompt_tokens, total_completion_tokens,
 *   total_net_spend_usd, total_gross_spend_usd, user_id
 *
 * Each CSV is a period aggregate with no date column. The caller supplies
 * the period start date (ISO string) as the timestamp — one record is
 * produced per unique user per CSV file.
 *
 * Multiple rows per user (different product × model combinations) within
 * a single file are collapsed into one UsageRecord with tokens summed.
 */

export interface UsageRecord {
  user_id: string;
  user_name: string;
  /** Claude tokens (prompt + completion) */
  token_count: number;
  /** OpenAI credits spent (USD) for the same period */
  openai_credits: number;
  timestamp: string; // ISO 8601 — start date of the reporting period
}

// ---------------------------------------------------------------------------
// Optional: override user_email display names.
// Keys are user_email values. Leave empty to use emails as-is.
// ---------------------------------------------------------------------------
export const USER_DISPLAY_NAMES: Record<string, string> = {
  // "shannon@posh.vip": "Shannon Smith",
};

// ---------------------------------------------------------------------------
// Minimal RFC-4180 CSV parser (no external dependencies)
// ---------------------------------------------------------------------------

function parseCSV(raw: string): Record<string, string>[] {
  const text = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows  = splitCSVRows(text);
  if (rows.length < 2) return [];

  const headers = parseCSVRow(rows[0]).map((h) => h.trim().toLowerCase());

  return rows.slice(1).flatMap((row) => {
    const trimmed = row.trim();
    if (!trimmed) return [];
    const values = parseCSVRow(trimmed);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = (values[i] ?? "").trim();
    });
    return [obj];
  });
}

function splitCSVRows(text: string): string[] {
  const rows: string[] = [];
  let current          = "";
  let inQuotes         = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
        current += ch;
      }
    } else if (ch === "\n" && !inQuotes) {
      rows.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current) rows.push(current);
  return rows;
}

function parseCSVRow(row: string): string[] {
  const fields: string[] = [];
  let current            = "";
  let inQuotes           = false;

  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (ch === '"') {
      if (inQuotes && row[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ParseResult {
  records: UsageRecord[];
  skipped: number;
}

/**
 * Parse the raw text of a claude.ai spend report CSV.
 *
 * @param csvText   Raw CSV file content
 * @param timestamp ISO 8601 string for the period start date (e.g. "2026-03-01T00:00:00.000Z")
 *
 * Multiple rows per user are aggregated into a single UsageRecord per user.
 * openai_credits is always 0 here — it gets merged in by the server from the DB.
 */
export function parseSpendReport(csvText: string, timestamp: string): ParseResult {
  const rows = parseCSV(csvText);

  const byUser = new Map<string, { user_name: string; token_count: number }>();
  let skipped  = 0;

  for (const row of rows) {
    const email  = row["user_email"]   ?? "";
    const uuid   = row["account_uuid"] ?? "";
    const userId = row["user_id"]      ?? uuid;
    const prompt = Number(row["total_prompt_tokens"]     ?? 0);
    const compl  = Number(row["total_completion_tokens"] ?? 0);

    if (!userId && !email) {
      skipped++;
      continue;
    }

    const stableId    = userId || uuid || email;
    const tokens      = (isNaN(prompt) ? 0 : prompt) + (isNaN(compl) ? 0 : compl);
    const displayName =
      USER_DISPLAY_NAMES[email] ??
      (email && email !== "(org service usage)" ? email : undefined) ??
      (uuid && uuid !== "(org service)" ? `key:${uuid.slice(-6)}` : "Org Service");

    const existing = byUser.get(stableId);
    if (existing) {
      existing.token_count += tokens;
    } else {
      byUser.set(stableId, { user_name: displayName, token_count: tokens });
    }
  }

  const records: UsageRecord[] = Array.from(byUser.entries()).map(
    ([user_id, { user_name, token_count }]) => ({
      user_id,
      user_name,
      token_count,
      openai_credits: 0,
      timestamp,
    })
  );

  return { records, skipped };
}
