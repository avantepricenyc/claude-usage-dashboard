import { neon } from '@neondatabase/serverless'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required')
}

export const sql = neon(process.env.DATABASE_URL)

export async function initSchema() {
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
  // Clean up snapshots older than 24h automatically via a simple delete on read
}
