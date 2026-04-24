import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sql } from '../lib/db.js'
import Anthropic from '@anthropic-ai/sdk'
import formidable from 'formidable'
import fs from 'fs'
import crypto from 'crypto'
import { parseSpendReport } from '../src/data/parseReport.js'

export const config = { api: { bodyParser: false } }

function normaliseName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

// Skip non-person entries (service accounts, org-level rows, etc.)
function isServiceAccount(userId: string, userName: string): boolean {
  return userId.startsWith('(') || userName.toLowerCase().includes('org service')
}

function parseRow(line: string): string[] {
  return line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' })

async function detectColumnsWithAI(
  type: 'claude' | 'openai',
  filename: string,
  headers: string[],
  sampleRows: string[][],
) {
  const sampleText = [headers.join(','), ...sampleRows.map((r) => r.join(','))].join('\n')

  const systemPrompt =
    type === 'claude'
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
}`

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 512,
    system: systemPrompt,
    messages: [{ role: 'user', content: `Filename: ${filename}\n\nCSV sample:\n${sampleText}` }],
  })

  const text = (response.content[0] as { type: string; text: string }).text.trim()
  const json = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  return JSON.parse(json) as {
    mapping: Record<string, number>
    months: string[]
    confidence: string
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Parse multipart form
  const form = formidable({ maxFileSize: 10 * 1024 * 1024 })
  let fields: formidable.Fields
  let files: formidable.Files
  try {
    ;[fields, files] = await form.parse(req)
  } catch {
    return res.status(400).json({ error: 'Failed to parse form data.' })
  }

  const type = Array.isArray(fields.type) ? fields.type[0] : fields.type
  if (!type || (type !== 'claude' && type !== 'openai')) {
    return res.status(400).json({ error: "Missing or invalid 'type' field (claude or openai)." })
  }

  const fileArr = files.file
  const file = Array.isArray(fileArr) ? fileArr[0] : fileArr
  if (!file) {
    return res.status(400).json({ error: 'No file uploaded.' })
  }

  const csvText = fs.readFileSync(file.filepath, 'utf-8')
  const filename = file.originalFilename ?? ''

  const rawLines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(Boolean)
  if (rawLines.length < 2) {
    return res.status(400).json({ error: 'CSV must have a header row and at least one data row.' })
  }

  const headers = parseRow(rawLines[0])
  const dataLines = rawLines.slice(1)
  const sampleRows = dataLines.slice(0, 5).map(parseRow)

  let aiResult: Awaited<ReturnType<typeof detectColumnsWithAI>>
  try {
    aiResult = await detectColumnsWithAI(type, filename, headers, sampleRows)
    console.log(`[/api/upload] AI mapping (${type}):`, JSON.stringify(aiResult))
  } catch (aiErr) {
    console.error('[/api/upload] AI mapping failed:', aiErr)
    return res.status(500).json({ error: 'AI column detection failed. Check ANTHROPIC_API_KEY is set.' })
  }

  const { mapping, months: aiMonths } = aiResult
  const undoToken = crypto.randomUUID()

  try {
    if (type === 'claude') {
      // Standard Claude spend-report filename path
      const stdMatch = filename.match(/spend-report-(\d{4}-\d{2})-\d{2}-to-/)
      if (stdMatch) {
        const month = stdMatch[1]
        const timestamp = `${month}-01T00:00:00.000Z`
        const { records: rawRecords, skipped } = parseSpendReport(csvText, timestamp)
        const records = rawRecords.filter((r) => !isServiceAccount(r.user_id, r.user_name))

        if (records.length === 0) {
          return res.status(400).json({ error: 'No valid records found in Claude CSV.' })
        }

        // Snapshot pre-upload state
        const existingUserIds = new Set(
          (await sql`SELECT user_id FROM users`).map((r) => r.user_id as string),
        )
        const snapshot: { claude: Array<{ user_id: string; month: string; token_count: number | null }>; openai: never[]; newUserIds: string[] } = {
          claude: [],
          openai: [],
          newUserIds: [],
        }
        for (const r of records) {
          const prev = await sql`SELECT token_count FROM claude_usage WHERE user_id = ${r.user_id} AND month = ${month}`
          snapshot.claude.push({ user_id: r.user_id, month, token_count: prev[0]?.token_count ?? null })
          if (!existingUserIds.has(r.user_id)) snapshot.newUserIds.push(r.user_id)
        }

        for (const r of records) {
          await sql`INSERT INTO users (user_id, user_name) VALUES (${r.user_id}, ${r.user_name}) ON CONFLICT(user_id) DO NOTHING`
          await sql`
            INSERT INTO claude_usage (user_id, month, token_count) VALUES (${r.user_id}, ${month}, ${r.token_count})
            ON CONFLICT(user_id, month) DO UPDATE SET token_count = claude_usage.token_count + EXCLUDED.token_count
          `
        }

        await sql`INSERT INTO upload_snapshots (token, snapshot) VALUES (${undoToken}, ${JSON.stringify({ type: 'claude', ...snapshot })})`

        const newUsers = snapshot.newUserIds.length
        const newRecords = snapshot.claude.filter((r) => r.token_count === null).length
        const updatedRecords = snapshot.claude.filter((r) => r.token_count !== null).length
        return res.json({ ok: true, ingested: records.length, skipped, months: [month], newUsers, newRecords, updatedRecords, undoToken })
      }

      // AI-mapped path for non-standard Claude CSVs
      const { user_id: userIdCol, user_name: userNameCol, prompt_tokens: promptCol, completion_tokens: completionCol, total_tokens: totalCol, month: monthCol } = mapping
      const fallbackMonth = aiMonths[0] ?? null
      if (!fallbackMonth && (monthCol === undefined || monthCol < 0)) {
        return res.status(400).json({ error: 'Could not detect reporting month from CSV.' })
      }

      const existingUserIds = new Set(
        (await sql`SELECT user_id FROM users`).map((r) => r.user_id as string),
      )
      const snapshot = { claude: [] as Array<{ user_id: string; month: string; token_count: number | null }>, openai: [] as never[], newUserIds: [] as string[] }
      const snapshotted = new Set<string>()
      const detectedMonths = new Set<string>(aiMonths)
      let ingested = 0, skippedCount = 0

      for (const line of dataLines) {
        const cols = parseRow(line)
        const userId = userIdCol >= 0 ? (cols[userIdCol] ?? '') : ''
        const userName = userNameCol >= 0 ? (cols[userNameCol] ?? '') : userId
        if (!userId && !userName) { skippedCount++; continue }
        const stableId = userId || normaliseName(userName)
        if (isServiceAccount(stableId, userName)) { skippedCount++; continue }

        const rowMonth = monthCol >= 0 && monthCol !== -1
          ? (cols[monthCol] ?? '').trim().slice(0, 7)
          : fallbackMonth
        if (!rowMonth) { skippedCount++; continue }
        detectedMonths.add(rowMonth)

        let tokens = 0
        if (totalCol >= 0 && totalCol !== -1) {
          tokens = parseInt(cols[totalCol] ?? '0', 10) || 0
        } else {
          const p = parseInt(cols[promptCol] ?? '0', 10) || 0
          const c = parseInt(cols[completionCol] ?? '0', 10) || 0
          tokens = p + c
        }

        const snapKey = `${stableId}|${rowMonth}`
        if (!snapshotted.has(snapKey)) {
          const prev = await sql`SELECT token_count FROM claude_usage WHERE user_id = ${stableId} AND month = ${rowMonth}`
          snapshot.claude.push({ user_id: stableId, month: rowMonth, token_count: prev[0]?.token_count ?? null })
          snapshotted.add(snapKey)
        }
        if (!existingUserIds.has(stableId)) { snapshot.newUserIds.push(stableId); existingUserIds.add(stableId) }

        await sql`INSERT INTO users (user_id, user_name) VALUES (${stableId}, ${userName || stableId}) ON CONFLICT(user_id) DO NOTHING`
        await sql`
          INSERT INTO claude_usage (user_id, month, token_count) VALUES (${stableId}, ${rowMonth}, ${tokens})
          ON CONFLICT(user_id, month) DO UPDATE SET token_count = claude_usage.token_count + EXCLUDED.token_count
        `
        ingested++
      }

      await sql`INSERT INTO upload_snapshots (token, snapshot) VALUES (${undoToken}, ${JSON.stringify({ type: 'claude', ...snapshot })})`

      const months = Array.from(detectedMonths).sort()
      const newUsers = snapshot.newUserIds.length
      const newRecords = snapshot.claude.filter((r) => r.token_count === null).length
      const updatedRecords = snapshot.claude.filter((r) => r.token_count !== null).length
      return res.json({ ok: true, ingested, skipped: skippedCount, months, newUsers, newRecords, updatedRecords, undoToken })
    }

    if (type === 'openai') {
      const { user_name: userNameCol, credits_spent: creditsCol, month: monthCol } = mapping

      if (userNameCol === undefined || creditsCol === undefined) {
        return res.status(400).json({ error: 'AI could not identify user name and credits columns.' })
      }

      const existingUsers = await sql`SELECT user_id, user_name FROM users`
      const nameToUserId = new Map<string, string>()
      for (const u of existingUsers) nameToUserId.set(normaliseName(u.user_name as string), u.user_id as string)
      const existingUserIds = new Set(existingUsers.map((u) => u.user_id as string))

      const fallbackMonth = aiMonths[0] ?? null
      const snapshot = { claude: [] as never[], openai: [] as Array<{ user_id: string; month: string; credits_spent: number | null }>, newUserIds: [] as string[] }
      const detectedMonths = new Set<string>(aiMonths)
      let ingested = 0, skippedCount = 0

      for (const line of dataLines) {
        const cols = parseRow(line)
        const name = userNameCol >= 0 ? (cols[userNameCol] ?? '').trim() : ''
        const amount = creditsCol >= 0 ? parseFloat(cols[creditsCol] ?? '0') : NaN
        if (!name || isNaN(amount)) { skippedCount++; continue }

        const rowMonth = monthCol >= 0 && monthCol !== -1
          ? (cols[monthCol] ?? '').trim()
          : fallbackMonth
        if (!rowMonth) { skippedCount++; continue }
        detectedMonths.add(rowMonth)

        const norm = normaliseName(name)
        let userId = nameToUserId.get(norm)
        if (!userId) {
          userId = `openai:${norm}`
          await sql`INSERT INTO users (user_id, user_name) VALUES (${userId}, ${name}) ON CONFLICT(user_id) DO NOTHING`
          nameToUserId.set(norm, userId)
        }

        const prev = await sql`SELECT credits_spent FROM openai_usage WHERE user_id = ${userId} AND month = ${rowMonth}`
        snapshot.openai.push({ user_id: userId, month: rowMonth, credits_spent: prev[0]?.credits_spent ?? null })
        if (!existingUserIds.has(userId)) { snapshot.newUserIds.push(userId); existingUserIds.add(userId) }

        await sql`
          INSERT INTO openai_usage (user_id, month, credits_spent) VALUES (${userId}, ${rowMonth}, ${amount})
          ON CONFLICT(user_id, month) DO UPDATE SET credits_spent = openai_usage.credits_spent + EXCLUDED.credits_spent
        `
        ingested++
      }

      await sql`INSERT INTO upload_snapshots (token, snapshot) VALUES (${undoToken}, ${JSON.stringify({ type: 'openai', ...snapshot })})`

      const months = Array.from(detectedMonths).sort()
      const newUsers = snapshot.newUserIds.length
      const newRecords = snapshot.openai.filter((r) => r.credits_spent === null).length
      const updatedRecords = snapshot.openai.filter((r) => r.credits_spent !== null).length
      return res.json({ ok: true, ingested, skipped: skippedCount, months, newUsers, newRecords, updatedRecords, undoToken })
    }

    return res.status(400).json({ error: "Invalid type. Must be 'claude' or 'openai'." })
  } catch (err) {
    console.error('[/api/upload] Error:', err)
    return res.status(500).json({ error: (err as Error).message ?? 'Upload failed.' })
  }
}
