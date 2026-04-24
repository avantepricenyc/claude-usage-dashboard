import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sql } from '../lib/db.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const rows = await sql`
      SELECT
        u.user_id,
        u.user_name,
        m.month,
        COALESCE(c.token_count,   0) AS token_count,
        COALESCE(o.credits_spent, 0) AS openai_credits
      FROM users u
      JOIN (
        SELECT user_id, month FROM claude_usage
        UNION
        SELECT user_id, month FROM openai_usage
      ) m ON m.user_id = u.user_id
      LEFT JOIN claude_usage c ON c.user_id = u.user_id AND c.month = m.month
      LEFT JOIN openai_usage o ON o.user_id = u.user_id AND o.month = m.month
      ORDER BY m.month, u.user_name
    `

    const records = rows.map((r) => ({
      user_id:       r.user_id as string,
      user_name:     r.user_name as string,
      token_count:   Number(r.token_count),
      openai_credits: Number(r.openai_credits),
      timestamp:     `${r.month as string}-01T00:00:00.000Z`,
    }))

    return res.json(records)
  } catch (err) {
    console.error('[/api/usage] Error:', err)
    return res.status(500).json({ error: 'Failed to load usage data.' })
  }
}
