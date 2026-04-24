/**
 * scripts/migrate-to-neon.ts
 *
 * One-time migration: reads all data from data/usage.db (SQLite)
 * and inserts it into the Neon Postgres database specified by DATABASE_URL.
 *
 * Usage:
 *   DATABASE_URL=<your-neon-url> npx tsx scripts/migrate-to-neon.ts
 */

import Database from 'better-sqlite3'
import { neon } from '@neondatabase/serverless'
import * as path from 'path'
import * as dotenv from 'dotenv'
import * as fs from 'fs'

// Load .env
const envPath = path.resolve(process.cwd(), '.env')
if (fs.existsSync(envPath)) {
  const parsed = dotenv.parse(fs.readFileSync(envPath))
  for (const [k, v] of Object.entries(parsed)) {
    if (!process.env[k]) process.env[k] = v
  }
}

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL is not set. Add it to .env or pass it as an env var.')
  process.exit(1)
}

const sql = neon(process.env.DATABASE_URL)
const DB_PATH = path.resolve(process.cwd(), 'data/usage.db')

if (!fs.existsSync(DB_PATH)) {
  console.error(`ERROR: SQLite database not found at ${DB_PATH}`)
  process.exit(1)
}

const db = new Database(DB_PATH, { readonly: true })

async function main() {
  console.log('Creating Postgres schema...')

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      user_id   TEXT PRIMARY KEY,
      user_name TEXT NOT NULL
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS claude_usage (
      id          SERIAL PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(user_id),
      month       TEXT NOT NULL,
      token_count INTEGER NOT NULL DEFAULT 0,
      UNIQUE(user_id, month)
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_claude_month ON claude_usage(month)`
  await sql`CREATE INDEX IF NOT EXISTS idx_claude_user  ON claude_usage(user_id)`
  await sql`
    CREATE TABLE IF NOT EXISTS openai_usage (
      id            SERIAL PRIMARY KEY,
      user_id       TEXT NOT NULL REFERENCES users(user_id),
      month         TEXT NOT NULL,
      credits_spent REAL NOT NULL DEFAULT 0,
      UNIQUE(user_id, month)
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_oai_month ON openai_usage(month)`
  await sql`CREATE INDEX IF NOT EXISTS idx_oai_user  ON openai_usage(user_id)`
  await sql`
    CREATE TABLE IF NOT EXISTS upload_snapshots (
      token       TEXT PRIMARY KEY,
      snapshot    JSONB NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  console.log('Schema ready.')

  // Migrate users
  const users = db.prepare('SELECT user_id, user_name FROM users').all() as Array<{ user_id: string; user_name: string }>
  console.log(`Migrating ${users.length} users...`)
  for (const u of users) {
    await sql`INSERT INTO users (user_id, user_name) VALUES (${u.user_id}, ${u.user_name}) ON CONFLICT(user_id) DO NOTHING`
  }

  // Migrate claude_usage
  const claudeRows = db.prepare('SELECT user_id, month, token_count FROM claude_usage').all() as Array<{ user_id: string; month: string; token_count: number }>
  console.log(`Migrating ${claudeRows.length} claude_usage rows...`)
  for (const r of claudeRows) {
    await sql`
      INSERT INTO claude_usage (user_id, month, token_count) VALUES (${r.user_id}, ${r.month}, ${r.token_count})
      ON CONFLICT(user_id, month) DO UPDATE SET token_count = EXCLUDED.token_count
    `
  }

  // Migrate openai_usage
  const openaiRows = db.prepare('SELECT user_id, month, credits_spent FROM openai_usage').all() as Array<{ user_id: string; month: string; credits_spent: number }>
  console.log(`Migrating ${openaiRows.length} openai_usage rows...`)
  for (const r of openaiRows) {
    await sql`
      INSERT INTO openai_usage (user_id, month, credits_spent) VALUES (${r.user_id}, ${r.month}, ${r.credits_spent})
      ON CONFLICT(user_id, month) DO UPDATE SET credits_spent = EXCLUDED.credits_spent
    `
  }

  db.close()
  console.log('Migration complete!')
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
