/**
 * scripts/serve.ts
 *
 * Express API server:
 *  - GET /api/usage  reads data/usage.db (built by scripts/build-db.ts) and
 *                    returns a combined UsageRecord[] with both Claude tokens
 *                    and OpenAI credits per user per month.
 *
 *                    Falls back to reading raw CSV files if usage.db is absent
 *                    (OpenAI data will be missing in that case).
 *
 *  - In production, also serves dist/ as static files
 *
 * Usage:
 *   Development:   npm run dev:full   (starts this + Vite via concurrently)
 *   Production:    npm run serve      (build first, then start this)
 */

import express from "express";
import * as fs    from "fs";
import * as path  from "path";
import * as dotenv from "dotenv";
import Database   from "better-sqlite3";
import multer     from "multer";
import Anthropic  from "@anthropic-ai/sdk";
import type { UsageRecord } from "../src/data/parseReport";
import { parseSpendReport } from "../src/data/parseReport";

// dotenvx v17 config() may not populate process.env correctly; use parse+assign directly.
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const parsed = dotenv.parse(fs.readFileSync(envPath));
  for (const [k, v] of Object.entries(parsed)) {
    if (!process.env[k]) process.env[k] = v;
  }
}

const PORT     = Number(process.env.PORT ?? 3001);
const DATA_DIR = path.resolve(process.cwd(), "data");
const DIST_DIR = path.resolve(process.cwd(), "dist");
const DB_PATH  = path.join(DATA_DIR, "usage.db");

const app = express();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_ADMIN_KEY ?? "",
});

// ---------------------------------------------------------------------------
// Last-upload snapshot — used by the undo endpoint
// ---------------------------------------------------------------------------
interface UploadSnapshot {
  type: "claude" | "openai";
  // Pre-upload values for every (user_id, month) the upload touched.
  // null token_count / credits_spent means the row did not exist before.
  claude: Array<{ user_id: string; month: string; token_count: number | null }>;
  openai: Array<{ user_id: string; month: string; credits_spent: number | null }>;
  // Users inserted fresh by this upload (removed on undo if unreferenced)
  newUserIds: string[];
}
let lastUploadSnapshot: UploadSnapshot | null = null;

// ---------------------------------------------------------------------------
// Load records from SQLite database
// ---------------------------------------------------------------------------

function loadFromDatabase(): UsageRecord[] {
  const db = new Database(DB_PATH, { readonly: true });

  // Query: one row per user per month, joined with users table and both
  // usage tables (LEFT JOINs so months with only Claude or only OpenAI data
  // still appear).
  const rows = db.prepare(`
    SELECT
      u.user_id,
      u.user_name,
      m.month,
      COALESCE(c.token_count,    0) AS token_count,
      COALESCE(o.credits_spent,  0) AS openai_credits
    FROM users u
    JOIN (
      SELECT user_id, month FROM claude_usage
      UNION
      SELECT user_id, month FROM openai_usage
    ) m ON m.user_id = u.user_id
    LEFT JOIN claude_usage c ON c.user_id = u.user_id AND c.month = m.month
    LEFT JOIN openai_usage o ON o.user_id = u.user_id AND o.month = m.month
    ORDER BY m.month, u.user_name
  `).all() as Array<{
    user_id: string;
    user_name: string;
    month: string;
    token_count: number;
    openai_credits: number;
  }>;

  db.close();

  return rows.map((r) => ({
    user_id:       r.user_id,
    user_name:     r.user_name,
    token_count:   r.token_count,
    openai_credits: r.openai_credits,
    timestamp:     `${r.month}-01T00:00:00.000Z`,
  }));
}

// ---------------------------------------------------------------------------
// Fallback: load from raw CSVs (no OpenAI data)
// ---------------------------------------------------------------------------

function extractStartDate(filename: string): string | null {
  const match = filename.match(/spend-report-(\d{4}-\d{2}-\d{2})-to-/);
  if (!match) return null;
  return `${match[1]}T00:00:00.000Z`;
}

function loadFromCSVs(): UsageRecord[] {
  let csvFiles: string[];
  try {
    csvFiles = fs
      .readdirSync(DATA_DIR)
      .filter((f) => f.startsWith("spend-report-") && f.endsWith(".csv"))
      .sort();
  } catch {
    return [];
  }

  const allRecords: UsageRecord[] = [];
  for (const filename of csvFiles) {
    const timestamp = extractStartDate(filename);
    if (!timestamp) continue;
    const csvText = fs.readFileSync(path.join(DATA_DIR, filename), "utf-8");
    const { records } = parseSpendReport(csvText, timestamp);
    allRecords.push(...records);
  }
  return allRecords;
}

// ---------------------------------------------------------------------------
// GET /api/usage
// ---------------------------------------------------------------------------
app.get("/api/usage", (_req, res) => {
  try {
    let records: UsageRecord[];
    if (fs.existsSync(DB_PATH)) {
      records = loadFromDatabase();
      console.log(`[/api/usage] Loaded ${records.length} records from SQLite DB`);
    } else {
      console.warn("[/api/usage] usage.db not found — falling back to raw CSVs (no OpenAI data)");
      records = loadFromCSVs();
      console.log(`[/api/usage] Loaded ${records.length} records from CSV files`);
    }
    return res.json(records);
  } catch (err) {
    console.error("[/api/usage] Error:", err);
    return res.status(500).json({ error: "Failed to load usage data." });
  }
});

// ---------------------------------------------------------------------------
// POST /api/upload  — ingest a Claude or OpenAI CSV using AI column mapping
// ---------------------------------------------------------------------------

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function normaliseName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function ensureDb() {
  if (!fs.existsSync(DB_PATH)) {
    throw new Error("Database not found. Run: npx tsx scripts/build-db.ts first.");
  }
}

/**
 * Ask Claude to map the CSV's columns to our schema fields and detect the
 * reporting period(s). Returns structured JSON we can use directly.
 *
 * For "claude" type, target fields are:
 *   user_id, user_email, user_name, prompt_tokens, completion_tokens,
 *   total_tokens, month (YYYY-MM)
 *
 * For "openai" type, target fields are:
 *   user_name, credits_spent, month (YYYY-MM)
 */
async function detectColumnsWithAI(
  type: "claude" | "openai",
  filename: string,
  headers: string[],
  sampleRows: string[][],
): Promise<{
  mapping: Record<string, number>;   // field → column index (-1 = not found)
  months: string[];                  // detected "YYYY-MM" values
  confidence: string;
}> {
  const sampleText = [headers.join(","), ...sampleRows.map((r) => r.join(","))].join("\n");

  const systemPrompt = type === "claude"
    ? `You are a data mapping assistant. Given a CSV header and sample rows from a Claude API spend report, identify which column index (0-based) corresponds to each of these target fields. Also detect all reporting months present.

Target fields:
- user_id: stable user identifier (email, UUID, or similar)
- user_name: display name (may be same as user_id if only email exists)
- prompt_tokens: number of prompt/input tokens
- completion_tokens: number of completion/output tokens
- total_tokens: total tokens (use if prompt+completion not separate; set to -1 if prompt+completion exist separately)
- month: the reporting period as YYYY-MM per row (a date/period column, or derivable from date values; set to -1 if not present as a column)

Respond with ONLY valid JSON in this exact shape:
{
  "mapping": {
    "user_id": <column_index_or_-1>,
    "user_name": <column_index_or_-1>,
    "prompt_tokens": <column_index_or_-1>,
    "completion_tokens": <column_index_or_-1>,
    "total_tokens": <column_index_or_-1>,
    "month": <column_index_or_-1>
  },
  "months": ["YYYY-MM", ...],
  "confidence": "high|medium|low"
}`
    : `You are a data mapping assistant. Given a CSV header and sample rows from an OpenAI usage/credits report, identify which column index (0-based) corresponds to each of these target fields. Also detect all reporting months present.

Target fields:
- user_name: the user's display name or email
- credits_spent: numeric USD credits / cost / spend
- month: the reporting period as YYYY-MM (may be in a column, or derivable from date values)

Respond with ONLY valid JSON in this exact shape:
{
  "mapping": {
    "user_name": <column_index_or_-1>,
    "credits_spent": <column_index_or_-1>,
    "month": <column_index_or_-1>
  },
  "months": ["YYYY-MM", ...],
  "confidence": "high|medium|low"
}`;

  const userMsg = `Filename: ${filename}\n\nCSV sample:\n${sampleText}`;

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 512,
    system: systemPrompt,
    messages: [{ role: "user", content: userMsg }],
  });

  const text = (response.content[0] as { type: string; text: string }).text.trim();
  // Strip markdown code fences if present
  const json = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(json);
}

app.post("/api/upload", upload.single("file"), async (req, res) => {
  try {
    ensureDb();

    const type = (req.body as Record<string, string>).type as "claude" | "openai";
    const file = req.file;

    if (!file) return res.status(400).json({ error: "No file uploaded." });
    if (!type) return res.status(400).json({ error: "Missing 'type' field (claude or openai)." });

    const csvText  = file.buffer.toString("utf-8");
    const filename = file.originalname ?? "";

    // Parse CSV into rows
    const rawLines = csvText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter(Boolean);
    if (rawLines.length < 2) {
      return res.status(400).json({ error: "CSV must have a header row and at least one data row." });
    }

    const parseRow = (line: string): string[] =>
      line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));

    const headers    = parseRow(rawLines[0]);
    const dataLines  = rawLines.slice(1);
    const sampleRows = dataLines.slice(0, 5).map(parseRow);

    // Ask Claude to map columns
    let aiResult: Awaited<ReturnType<typeof detectColumnsWithAI>>;
    try {
      aiResult = await detectColumnsWithAI(type, filename, headers, sampleRows);
      console.log(`[/api/upload] AI column mapping (${type}):`, JSON.stringify(aiResult));
    } catch (aiErr) {
      console.error("[/api/upload] AI mapping failed:", aiErr);
      return res.status(500).json({ error: "AI column detection failed. Check ANTHROPIC_API_KEY is set." });
    }

    const { mapping, months: aiMonths } = aiResult;
    const db = new Database(DB_PATH);

    // Ensure unique indexes exist
    try {
      db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_claude_user_month ON claude_usage(user_id, month)");
      db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_oai_user_month ON openai_usage(user_id, month)");
    } catch { /* already exist */ }

    const upsertUser = db.prepare("INSERT OR IGNORE INTO users (user_id, user_name) VALUES (?, ?)");

    if (type === "claude") {
      // For standard Claude spend reports, use the existing parser if the filename matches
      const stdMatch = filename.match(/spend-report-(\d{4}-\d{2})-\d{2}-to-/);
      if (stdMatch) {
        const month     = stdMatch[1];
        const timestamp = `${month}-01T00:00:00.000Z`;
        const { records, skipped } = parseSpendReport(csvText, timestamp);

        if (records.length === 0) {
          db.close();
          return res.status(400).json({ error: "No valid records found in Claude CSV." });
        }

        // Snapshot pre-upload state for undo
        const snapshot: UploadSnapshot = { type: "claude", claude: [], openai: [], newUserIds: [] };
        const existingUserIds = new Set(
          (db.prepare("SELECT user_id FROM users").all() as Array<{ user_id: string }>).map((r) => r.user_id)
        );
        for (const r of records) {
          const prev = db.prepare("SELECT token_count FROM claude_usage WHERE user_id = ? AND month = ?")
            .get(r.user_id, month) as { token_count: number } | undefined;
          snapshot.claude.push({ user_id: r.user_id, month, token_count: prev?.token_count ?? null });
          if (!existingUserIds.has(r.user_id)) snapshot.newUserIds.push(r.user_id);
        }

        const upsertUsage = db.prepare(`
          INSERT INTO claude_usage (user_id, month, token_count) VALUES (?, ?, ?)
          ON CONFLICT(user_id, month) DO UPDATE SET token_count = token_count + excluded.token_count
        `);
        db.transaction(() => {
          for (const r of records) {
            upsertUser.run(r.user_id, r.user_name);
            upsertUsage.run(r.user_id, month, r.token_count);
          }
        })();
        db.close();
        lastUploadSnapshot = snapshot;
        const newUsers      = snapshot.newUserIds.length;
        const newRecords    = snapshot.claude.filter((r) => r.token_count === null).length;
        const updatedRecords = snapshot.claude.filter((r) => r.token_count !== null).length;
        console.log(`[/api/upload] Claude standard: ${records.length} records for ${month} (${skipped} skipped)`);
        return res.json({ ok: true, ingested: records.length, skipped, months: [month], newUsers, newRecords, updatedRecords });
      }

      // AI-mapped path for non-standard Claude CSVs
      const { user_id: userIdCol, user_name: userNameCol,
              prompt_tokens: promptCol, completion_tokens: completionCol,
              total_tokens: totalCol, month: monthCol } = mapping as Record<string, number>;

      const fallbackMonth = aiMonths[0] ?? null;
      if (!fallbackMonth && (monthCol === undefined || monthCol < 0)) {
        db.close();
        return res.status(400).json({ error: "Could not detect reporting month from CSV. Ensure the file contains date information." });
      }

      const upsertUsage = db.prepare(`
        INSERT INTO claude_usage (user_id, month, token_count) VALUES (?, ?, ?)
        ON CONFLICT(user_id, month) DO UPDATE SET token_count = token_count + excluded.token_count
      `);

      // Snapshot pre-upload state for undo
      const snapshot: UploadSnapshot = { type: "claude", claude: [], openai: [], newUserIds: [] };
      const existingUserIds = new Set(
        (db.prepare("SELECT user_id FROM users").all() as Array<{ user_id: string }>).map((r) => r.user_id)
      );
      // Track which (user_id, month) pairs we've already snapshotted to avoid duplicates
      const snapshotted = new Set<string>();

      const detectedMonths = new Set<string>(aiMonths);
      let ingested = 0, skipped = 0;
      db.transaction(() => {
        for (const line of dataLines) {
          const cols = parseRow(line);
          const userId   = userIdCol   >= 0 ? cols[userIdCol]   ?? "" : "";
          const userName = userNameCol >= 0 ? cols[userNameCol] ?? "" : userId;
          if (!userId && !userName) { skipped++; continue; }
          const stableId = userId || normaliseName(userName);

          // Resolve row month
          const rowMonth = (monthCol >= 0 && monthCol !== -1 && monthCol !== undefined)
            ? (cols[monthCol] ?? "").trim().slice(0, 7) // take YYYY-MM prefix if full date
            : fallbackMonth;
          if (!rowMonth) { skipped++; continue; }
          detectedMonths.add(rowMonth);

          let tokens = 0;
          if (totalCol >= 0 && totalCol !== -1) {
            tokens = parseInt(cols[totalCol] ?? "0", 10) || 0;
          } else {
            const p = parseInt(cols[promptCol] ?? "0", 10) || 0;
            const c = parseInt(cols[completionCol] ?? "0", 10) || 0;
            tokens  = p + c;
          }

          const snapKey = `${stableId}|${rowMonth}`;
          if (!snapshotted.has(snapKey)) {
            const prev = db.prepare("SELECT token_count FROM claude_usage WHERE user_id = ? AND month = ?")
              .get(stableId, rowMonth) as { token_count: number } | undefined;
            snapshot.claude.push({ user_id: stableId, month: rowMonth, token_count: prev?.token_count ?? null });
            snapshotted.add(snapKey);
          }
          if (!existingUserIds.has(stableId)) { snapshot.newUserIds.push(stableId); existingUserIds.add(stableId); }

          upsertUser.run(stableId, userName || stableId);
          upsertUsage.run(stableId, rowMonth, tokens);
          ingested++;
        }
      })();
      db.close();
      lastUploadSnapshot = snapshot;
      const newUsers       = snapshot.newUserIds.length;
      const newRecords     = snapshot.claude.filter((r) => r.token_count === null).length;
      const updatedRecords = snapshot.claude.filter((r) => r.token_count !== null).length;

      const months = Array.from(detectedMonths).sort();
      console.log(`[/api/upload] Claude AI-mapped: ${ingested} records for [${months.join(", ")}] (${skipped} skipped)`);
      return res.json({ ok: true, ingested, skipped, months, newUsers, newRecords, updatedRecords });
    }

    if (type === "openai") {
      const { user_name: userNameCol, credits_spent: creditsCol, month: monthCol } =
        mapping as Record<string, number>;

      if (userNameCol === undefined || creditsCol === undefined) {
        db.close();
        return res.status(400).json({ error: "AI could not identify user name and credits columns in this CSV." });
      }

      const existingUsers = db.prepare("SELECT user_id, user_name FROM users").all() as Array<{ user_id: string; user_name: string }>;
      const nameToUserId  = new Map<string, string>();
      for (const u of existingUsers) nameToUserId.set(normaliseName(u.user_name), u.user_id);

      const existingUserIds = new Set(existingUsers.map((u) => u.user_id));

      const upsertUsage = db.prepare(`
        INSERT INTO openai_usage (user_id, month, credits_spent) VALUES (?, ?, ?)
        ON CONFLICT(user_id, month) DO UPDATE SET credits_spent = credits_spent + excluded.credits_spent
      `);

      // Fallback month from AI detection if no per-row column
      const fallbackMonth = aiMonths[0] ?? null;

      // Snapshot pre-upload state for undo
      const snapshot: UploadSnapshot = { type: "openai", claude: [], openai: [], newUserIds: [] };

      let ingested = 0, skipped = 0;
      const detectedMonths = new Set<string>(aiMonths);

      db.transaction(() => {
        for (const line of dataLines) {
          const cols   = parseRow(line);
          const name   = userNameCol >= 0 ? (cols[userNameCol] ?? "").trim() : "";
          const amount = creditsCol  >= 0 ? parseFloat(cols[creditsCol] ?? "0") : NaN;

          if (!name || isNaN(amount)) { skipped++; continue; }

          const rowMonth = (monthCol >= 0 && monthCol !== -1)
            ? (cols[monthCol] ?? "").trim()
            : fallbackMonth;

          if (!rowMonth) { skipped++; continue; }
          detectedMonths.add(rowMonth);

          const norm = normaliseName(name);
          let userId = nameToUserId.get(norm);
          if (!userId) {
            userId = `openai:${norm}`;
            upsertUser.run(userId, name);
            nameToUserId.set(norm, userId);
          }

          const prev = db.prepare("SELECT credits_spent FROM openai_usage WHERE user_id = ? AND month = ?")
            .get(userId, rowMonth) as { credits_spent: number } | undefined;
          snapshot.openai.push({ user_id: userId, month: rowMonth, credits_spent: prev?.credits_spent ?? null });
          if (!existingUserIds.has(userId)) { snapshot.newUserIds.push(userId); existingUserIds.add(userId); }

          upsertUsage.run(userId, rowMonth, amount);
          ingested++;
        }
      })();
      db.close();
      lastUploadSnapshot = snapshot;
      const newUsers       = snapshot.newUserIds.length;
      const newRecords     = snapshot.openai.filter((r) => r.credits_spent === null).length;
      const updatedRecords = snapshot.openai.filter((r) => r.credits_spent !== null).length;

      const months = Array.from(detectedMonths).sort();
      console.log(`[/api/upload] OpenAI AI-mapped: ${ingested} records for [${months.join(", ")}] (${skipped} skipped)`);
      return res.json({ ok: true, ingested, skipped, months, newUsers, newRecords, updatedRecords });
    }

    return res.status(400).json({ error: "Invalid type. Must be 'claude' or 'openai'." });

  } catch (err) {
    console.error("[/api/upload] Error:", err);
    return res.status(500).json({ error: (err as Error).message ?? "Upload failed." });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/upload/undo  — revert the most recent upload
// ---------------------------------------------------------------------------
app.delete("/api/upload/undo", (_req, res) => {
  if (!lastUploadSnapshot) {
    return res.status(404).json({ error: "No upload to undo." });
  }

  try {
    const snap = lastUploadSnapshot;
    const db   = new Database(DB_PATH);

    db.transaction(() => {
      // Restore claude_usage rows
      for (const row of snap.claude) {
        if (row.token_count === null) {
          db.prepare("DELETE FROM claude_usage WHERE user_id = ? AND month = ?").run(row.user_id, row.month);
        } else {
          db.prepare("INSERT INTO claude_usage (user_id, month, token_count) VALUES (?, ?, ?) ON CONFLICT(user_id, month) DO UPDATE SET token_count = excluded.token_count")
            .run(row.user_id, row.month, row.token_count);
        }
      }

      // Restore openai_usage rows
      for (const row of snap.openai) {
        if (row.credits_spent === null) {
          db.prepare("DELETE FROM openai_usage WHERE user_id = ? AND month = ?").run(row.user_id, row.month);
        } else {
          db.prepare("INSERT INTO openai_usage (user_id, month, credits_spent) VALUES (?, ?, ?) ON CONFLICT(user_id, month) DO UPDATE SET credits_spent = excluded.credits_spent")
            .run(row.user_id, row.month, row.credits_spent);
        }
      }

      // Remove users that were newly created by the upload and are now unreferenced
      for (const uid of snap.newUserIds) {
        const inClaude = db.prepare("SELECT 1 FROM claude_usage WHERE user_id = ? LIMIT 1").get(uid);
        const inOpenai = db.prepare("SELECT 1 FROM openai_usage WHERE user_id = ? LIMIT 1").get(uid);
        if (!inClaude && !inOpenai) {
          db.prepare("DELETE FROM users WHERE user_id = ?").run(uid);
        }
      }
    })();

    db.close();
    lastUploadSnapshot = null;
    console.log("[/api/upload/undo] Reverted last upload");
    return res.json({ ok: true });
  } catch (err) {
    console.error("[/api/upload/undo] Error:", err);
    return res.status(500).json({ error: (err as Error).message ?? "Undo failed." });
  }
});

// ---------------------------------------------------------------------------
// Static file serving (production only)
// ---------------------------------------------------------------------------
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get("/{*path}", (_req, res) => res.sendFile(path.join(DIST_DIR, "index.html")));
}

app.listen(PORT, () => {
  console.log(`[serve] API server listening on http://localhost:${PORT}`);
  if (fs.existsSync(DIST_DIR)) {
    console.log(`[serve] Serving production build from dist/`);
  } else {
    console.log(`[serve] API-only mode — start Vite separately with npm run dev`);
  }
  if (fs.existsSync(DB_PATH)) {
    console.log(`[serve] Using SQLite database: ${DB_PATH}`);
  } else {
    console.log(`[serve] WARNING: usage.db not found — run: npx tsx scripts/build-db.ts`);
  }
});
