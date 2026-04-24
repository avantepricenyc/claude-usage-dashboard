/**
 * scripts/build-db.ts
 *
 * Builds (or rebuilds) data/usage.db — the single SQLite database that
 * powers the dashboard.
 *
 * Tables
 * ──────
 * users
 *   user_id   TEXT PRIMARY KEY   — stable key (claude user_id, uuid, or email)
 *   user_name TEXT               — display name (full name preferred)
 *
 * claude_usage
 *   id           INTEGER PRIMARY KEY
 *   user_id      TEXT REFERENCES users(user_id)
 *   month        TEXT   — "YYYY-MM"
 *   token_count  INTEGER
 *
 * openai_usage
 *   id             INTEGER PRIMARY KEY
 *   user_id        TEXT REFERENCES users(user_id)
 *   month          TEXT   — "YYYY-MM"
 *   credits_spent  REAL   — USD credits consumed
 *
 * Sources
 * ───────
 * Claude  : data/spend-report-YYYY-MM-DD-to-YYYY-MM-DD.csv
 * OpenAI  : data/openai-credits.json  (converted from xlsx once, committed)
 *
 * Run
 * ───
 *   npx tsx scripts/build-db.ts
 */

import * as fs   from "fs";
import * as path from "path";
import Database  from "better-sqlite3";
import { parseSpendReport } from "../src/data/parseReport";

const DATA_DIR = path.resolve(process.cwd(), "data");
const DB_PATH  = path.join(DATA_DIR, "usage.db");
const OAI_PATH = path.join(DATA_DIR, "openai-credits.json");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UserMeta { user_id: string; user_name: string }

// ---------------------------------------------------------------------------
// Name normalisation
// ---------------------------------------------------------------------------

function normaliseName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// ---------------------------------------------------------------------------
// Hand-curated map: normalised OpenAI display name → canonical UserMeta.
//
// Claude-matched entries share the posh.vip email user_id so their data
// merges with Claude records.  OpenAI-only entries get an "openai:" prefix.
// ---------------------------------------------------------------------------
const KNOWN_ALIASES: Record<string, UserMeta> = {
  // ── Claude-matched ────────────────────────────────────────────────────────
  shannonb:          { user_id: "shannon@posh.vip",  user_name: "Shannon B"           },
  aaronfree:         { user_id: "aaron@posh.vip",    user_name: "Aaron Free"          },
  adi:               { user_id: "adi@posh.vip",      user_name: "Adi"                 },
  b:                 { user_id: "bastian@posh.vip",  user_name: "Bastian Delalande"   },
  bastiandelalan:    { user_id: "bastian@posh.vip",  user_name: "Bastian Delalande"   },
  bastiandelalande:  { user_id: "bastian@posh.vip",  user_name: "Bastian Delalande"   },
  camrynkirk:        { user_id: "camryn@posh.vip",   user_name: "Camryn Kirk"         },
  demarioasquitt:    { user_id: "demario@posh.vip",  user_name: "Demario Asquitt"     },
  emmadowns:         { user_id: "emma@posh.vip",     user_name: "Emma Downs"          },
  ethanharsh:        { user_id: "ethan@posh.vip",    user_name: "Ethan Harsh"         },
  hungtang:          { user_id: "hung@posh.vip",     user_name: "Hung Tang"           },
  jamesmedina:       { user_id: "james@posh.vip",    user_name: "James Medina"        },
  jimyang:           { user_id: "jim@posh.vip",      user_name: "Jim Yang"            },
  joemclachlan:      { user_id: "joe@posh.vip",      user_name: "Joe McLachlan"       },
  josephiacona:      { user_id: "joseph@posh.vip",   user_name: "Joseph Iacona"       },
  nadiamounzih:      { user_id: "nadia@posh.vip",    user_name: "Nadia Mounzih"       },
  sventvedt:         { user_id: "sven@posh.vip",     user_name: "Sven Tvedt"          },
  tyscearce:         { user_id: "ty@posh.vip",       user_name: "Ty Scearce"          },
  // ── OpenAI-only ───────────────────────────────────────────────────────────
  absalazar:         { user_id: "openai:absalazar",  user_name: "Ab Salazar"          },
  abbykmetz:         { user_id: "openai:abby",       user_name: "Abby Kmetz"          },
  annaliasunderland: { user_id: "openai:annalia",    user_name: "Annalia Sunderland"  },
  arlenoharonian:    { user_id: "openai:arlen",      user_name: "Arlen Oharonian"     },
  avanteprice:       { user_id: "openai:avante",     user_name: "Avante Price"        },
  carln:             { user_id: "openai:carl",       user_name: "Carl N"              },
  carolinereyda:     { user_id: "openai:caroline",   user_name: "Caroline Reyda"      },
  chelseaalterman:   { user_id: "openai:chelsea",    user_name: "Chelsea Alterman"    },
  daniaceves:        { user_id: "openai:daniaceves", user_name: "Dani Aceves"         },
  daniedelstein:     { user_id: "openai:daniedelstein", user_name: "Dani Edelstein"   },
  danielcostello:    { user_id: "openai:daniel",     user_name: "Daniel Costello"     },
  danielabao:        { user_id: "openai:daniela",    user_name: "Daniela Bao"         },
  daviddavidov:      { user_id: "openai:daviddavidov", user_name: "David Davidov"     },
  davidkitchener:    { user_id: "openai:davidk",     user_name: "David Kitchener"     },
  dougan:            { user_id: "openai:dougan",     user_name: "Dougan"              },
  elitaylorlemire:   { user_id: "openai:eli",        user_name: "Eli Taylor-Lemire"   },
  ericwolfe:         { user_id: "openai:eric",       user_name: "Eric Wolfe"          },
  esthercho:         { user_id: "openai:esther",     user_name: "Esther Cho"          },
  gabbiebernier:     { user_id: "openai:gabbie",     user_name: "Gabbie Bernier"      },
  gabrielabrown:     { user_id: "openai:gabby",      user_name: "Gabriela Brown"      },
  garrettfisch:      { user_id: "openai:garrett",    user_name: "Garrett Fisch"       },
  gracebelden:       { user_id: "openai:grace",      user_name: "Grace Belden"        },
  guillermomarte:    { user_id: "openai:guillermo",  user_name: "Guillermo Marte"     },
  haley:             { user_id: "openai:haley",      user_name: "Haley"               },
  haroldsolomon:     { user_id: "openai:harold",     user_name: "Harold Solomon"      },
  jacetaylor:        { user_id: "openai:jace",       user_name: "Jace Taylor"         },
  jadkojakali:       { user_id: "openai:jad",        user_name: "Jad Kojakali"        },
  jeffdiers:         { user_id: "openai:jeff",       user_name: "Jeff Diers"          },
  jonathanbeaubien:  { user_id: "openai:jonathan",   user_name: "Jonathan Beaubien"   },
  katecollins:       { user_id: "openai:kate",       user_name: "Kate Collins"        },
  kevenduran:        { user_id: "openai:keven",      user_name: "Keven Duran"         },
  kristytijerina:    { user_id: "openai:kristy",     user_name: "Kristy Tijerina"     },
  lawrencehennessy:  { user_id: "openai:lawrence",   user_name: "Lawrence Hennessy"   },
  lucystronach:      { user_id: "openai:lucy",       user_name: "Lucy Stronach"       },
  lukasjuhas:        { user_id: "openai:lukas",      user_name: "Lukas Juhas"         },
  mia:               { user_id: "openai:mia",        user_name: "Mia"                 },
  michaelruffolo:    { user_id: "openai:michael",    user_name: "Michael Ruffolo"     },
  natalielucas:      { user_id: "openai:natalie",    user_name: "Natalie Lucas"       },
  pavlostiftikidis:  { user_id: "openai:pavlos",     user_name: "Pavlos Tiftikidis"   },
  racheltrail:       { user_id: "openai:rachel",     user_name: "Rachel Trail"        },
  ragelthys:         { user_id: "openai:ragel",      user_name: "Ragel Thys"          },
  robertdong:        { user_id: "openai:robert",     user_name: "Robert Dong"         },
  sabrinacohan:      { user_id: "openai:sabrina",    user_name: "Sabrina Cohan"       },
  sarahprice:        { user_id: "openai:sarah",      user_name: "Sarah Price"         },
  sabineandre:       { user_id: "openai:sabine",     user_name: "Sabine Andre"        },
  teddyeisenstein:   { user_id: "openai:teddy",      user_name: "Teddy Eisenstein"    },
  thembadaniels:     { user_id: "openai:themba",     user_name: "Themba Daniels"      },
  victorochoa:       { user_id: "openai:victor",     user_name: "Victor Ochoa"        },
  willheyman:        { user_id: "openai:will",       user_name: "Will Heyman"         },
  zachhickman:       { user_id: "openai:zach",       user_name: "Zach Hickman"        },
  emoryscott:        { user_id: "openai:emory",      user_name: "Emory Scott"         },
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (!fs.existsSync(OAI_PATH)) {
    console.error(`[build-db] ${OAI_PATH} not found. Run: npx tsx scripts/convert-oai-xlsx.ts`);
    process.exit(1);
  }

  // 1. Read OpenAI JSON
  type OaiRow = { user: string; month: string; credits_spent: number };
  const oaiRows: OaiRow[] = JSON.parse(fs.readFileSync(OAI_PATH, "utf-8"));

  // 2. Parse all Claude CSVs
  const csvFiles = fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.startsWith("spend-report-") && f.endsWith(".csv"))
    .sort();

  const claudeUserMeta = new Map<string, UserMeta>(); // user_id → meta
  type ClaudeMonth = { user_id: string; month: string; token_count: number };
  const claudeMonthly: ClaudeMonth[] = [];

  for (const filename of csvFiles) {
    const match = filename.match(/spend-report-(\d{4}-\d{2})-\d{2}-to-/);
    if (!match) continue;
    const month = match[1]; // "YYYY-MM"
    const timestamp = `${month}-01T00:00:00.000Z`;
    const csvText = fs.readFileSync(path.join(DATA_DIR, filename), "utf-8");
    const { records } = parseSpendReport(csvText, timestamp);

    for (const r of records) {
      // Prefer more complete user_name if we see the same user_id again
      const existing = claudeUserMeta.get(r.user_id);
      if (!existing || r.user_name.length > existing.user_name.length) {
        claudeUserMeta.set(r.user_id, { user_id: r.user_id, user_name: r.user_name });
      }
      const existingMonth = claudeMonthly.find((m) => m.user_id === r.user_id && m.month === month);
      if (existingMonth) {
        existingMonth.token_count += r.token_count;
      } else {
        claudeMonthly.push({ user_id: r.user_id, month, token_count: r.token_count });
      }
    }
  }

  // 3. Resolve OpenAI users → canonical user_id
  type OaiMonth = { user_id: string; month: string; credits_spent: number };
  const oaiMonthly: OaiMonth[] = [];
  const extraUsers = new Map<string, UserMeta>(); // OpenAI-only users not in claudeUserMeta

  for (const row of oaiRows) {
    if (!row.user || row.user === "user") continue;

    const norm = normaliseName(row.user);
    let userMeta: UserMeta | undefined;

    // 1. Alias table (highest priority)
    if (KNOWN_ALIASES[norm]) {
      userMeta = KNOWN_ALIASES[norm];
      // If this maps to a Claude email, ensure it's in claudeUserMeta
      if (!claudeUserMeta.has(userMeta.user_id) && !userMeta.user_id.startsWith("openai:")) {
        claudeUserMeta.set(userMeta.user_id, userMeta);
      }
      if (userMeta.user_id.startsWith("openai:")) {
        extraUsers.set(userMeta.user_id, userMeta);
      }
    }

    // 2. Fallback: unmatched → synthetic openai: key
    if (!userMeta) {
      const syntheticId = `openai:${norm}`;
      userMeta = extraUsers.get(syntheticId) ?? { user_id: syntheticId, user_name: row.user };
      extraUsers.set(syntheticId, userMeta);
      console.warn(`[build-db] Unmatched OpenAI user: "${row.user}" → ${syntheticId}`);
    }

    const existingMonth = oaiMonthly.find(
      (m) => m.user_id === userMeta!.user_id && m.month === row.month
    );
    if (existingMonth) {
      existingMonth.credits_spent += row.credits_spent;
    } else {
      oaiMonthly.push({ user_id: userMeta.user_id, month: row.month, credits_spent: row.credits_spent });
    }
  }

  // 4. Build SQLite DB
  if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  const db = new Database(DB_PATH);

  db.exec(`
    CREATE TABLE users (
      user_id   TEXT PRIMARY KEY,
      user_name TEXT NOT NULL
    );
    CREATE TABLE claude_usage (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     TEXT NOT NULL REFERENCES users(user_id),
      month       TEXT NOT NULL,
      token_count INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX idx_claude_month ON claude_usage(month);
    CREATE INDEX idx_claude_user  ON claude_usage(user_id);
    CREATE TABLE openai_usage (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       TEXT NOT NULL REFERENCES users(user_id),
      month         TEXT NOT NULL,
      credits_spent REAL NOT NULL DEFAULT 0
    );
    CREATE INDEX idx_oai_month ON openai_usage(month);
    CREATE INDEX idx_oai_user  ON openai_usage(user_id);
  `);

  const upsertUser = db.prepare(
    "INSERT OR REPLACE INTO users (user_id, user_name) VALUES (?, ?)"
  );
  const insertUsers = db.transaction((entries: UserMeta[]) => {
    for (const u of entries) upsertUser.run(u.user_id, u.user_name);
  });

  const allUsers: UserMeta[] = [
    ...Array.from(claudeUserMeta.values()),
    ...Array.from(extraUsers.values()),
  ];
  // Deduplicate by user_id
  const uniqueUsers = Array.from(
    new Map(allUsers.map((u) => [u.user_id, u])).values()
  );
  insertUsers(uniqueUsers);

  const insertClaude = db.prepare(
    "INSERT INTO claude_usage (user_id, month, token_count) VALUES (?, ?, ?)"
  );
  const insertClaudeBatch = db.transaction((rows: ClaudeMonth[]) => {
    for (const r of rows) insertClaude.run(r.user_id, r.month, r.token_count);
  });
  insertClaudeBatch(claudeMonthly);

  const insertOai = db.prepare(
    "INSERT INTO openai_usage (user_id, month, credits_spent) VALUES (?, ?, ?)"
  );
  const insertOaiBatch = db.transaction((rows: OaiMonth[]) => {
    for (const r of rows) insertOai.run(r.user_id, r.month, r.credits_spent);
  });
  insertOaiBatch(oaiMonthly);

  db.close();

  console.log(`[build-db] ✓ ${DB_PATH}`);
  console.log(`  users        : ${uniqueUsers.length}`);
  console.log(`  claude rows  : ${claudeMonthly.length}`);
  console.log(`  openai rows  : ${oaiMonthly.length}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
