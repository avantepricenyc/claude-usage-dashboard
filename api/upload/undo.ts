import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sql } from '../../lib/db.js'

interface SnapshotData {
  type: 'claude' | 'openai'
  claude: Array<{ user_id: string; month: string; token_count: number | null }>
  openai: Array<{ user_id: string; month: string; credits_spent: number | null }>
  newUserIds: string[]
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { undoToken } = req.body as { undoToken?: string }
  if (!undoToken) {
    return res.status(400).json({ error: 'undoToken is required.' })
  }

  // Clean up old snapshots (> 24h) opportunistically
  await sql`DELETE FROM upload_snapshots WHERE created_at < NOW() - INTERVAL '24 hours'`

  const rows = await sql`SELECT snapshot FROM upload_snapshots WHERE token = ${undoToken}`
  if (rows.length === 0) {
    return res.status(404).json({ error: 'Undo token not found or already used.' })
  }

  const snap = rows[0].snapshot as SnapshotData

  try {
    // Restore claude_usage rows
    for (const row of snap.claude) {
      if (row.token_count === null) {
        await sql`DELETE FROM claude_usage WHERE user_id = ${row.user_id} AND month = ${row.month}`
      } else {
        await sql`
          INSERT INTO claude_usage (user_id, month, token_count) VALUES (${row.user_id}, ${row.month}, ${row.token_count})
          ON CONFLICT(user_id, month) DO UPDATE SET token_count = EXCLUDED.token_count
        `
      }
    }

    // Restore openai_usage rows
    for (const row of snap.openai) {
      if (row.credits_spent === null) {
        await sql`DELETE FROM openai_usage WHERE user_id = ${row.user_id} AND month = ${row.month}`
      } else {
        await sql`
          INSERT INTO openai_usage (user_id, month, credits_spent) VALUES (${row.user_id}, ${row.month}, ${row.credits_spent})
          ON CONFLICT(user_id, month) DO UPDATE SET credits_spent = EXCLUDED.credits_spent
        `
      }
    }

    // Remove newly-created users that are now unreferenced
    for (const uid of snap.newUserIds) {
      const inClaude = await sql`SELECT 1 FROM claude_usage WHERE user_id = ${uid} LIMIT 1`
      const inOpenai = await sql`SELECT 1 FROM openai_usage WHERE user_id = ${uid} LIMIT 1`
      if (inClaude.length === 0 && inOpenai.length === 0) {
        await sql`DELETE FROM users WHERE user_id = ${uid}`
      }
    }

    // Delete the used snapshot token
    await sql`DELETE FROM upload_snapshots WHERE token = ${undoToken}`

    return res.json({ ok: true })
  } catch (err) {
    console.error('[/api/upload/undo] Error:', err)
    return res.status(500).json({ error: (err as Error).message ?? 'Undo failed.' })
  }
}
