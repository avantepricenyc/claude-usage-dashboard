import type { UsageRecord } from "../data";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UserTotals {
  user_id: string;
  user_name: string;
  /** Claude tokens (prompt + completion) */
  token_count: number;
  /** OpenAI credits (USD) */
  openai_credits: number;
}

export interface MonthlyTotal {
  /** "YYYY-MM" */
  month: string;
  /** Human-readable label, e.g. "Jan 2025" */
  label: string;
  /** Claude tokens */
  token_count: number;
  /** OpenAI credits (USD) */
  openai_credits: number;
}

// ---------------------------------------------------------------------------
// Per-user aggregation
// ---------------------------------------------------------------------------

/**
 * Aggregates token totals per user from a set of records.
 * Returns users sorted descending by Claude token count, then OpenAI credits.
 */
export function aggregateByUser(records: UsageRecord[]): UserTotals[] {
  const map = new Map<string, UserTotals>();

  for (const r of records) {
    const existing = map.get(r.user_id);
    if (existing) {
      existing.token_count    += r.token_count;
      existing.openai_credits += r.openai_credits;
    } else {
      map.set(r.user_id, {
        user_id:        r.user_id,
        user_name:      r.user_name,
        token_count:    r.token_count,
        openai_credits: r.openai_credits,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (b.token_count !== a.token_count) return b.token_count - a.token_count;
    return b.openai_credits - a.openai_credits;
  });
}

/**
 * Returns the top N users by token count.
 */
export function topNUsers(records: UsageRecord[], n: number): UserTotals[] {
  return aggregateByUser(records).slice(0, n);
}

// ---------------------------------------------------------------------------
// Monthly aggregation
// ---------------------------------------------------------------------------

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Aggregates totals by calendar month across all users.
 * Returns months sorted chronologically.
 */
export function aggregateByMonth(records: UsageRecord[]): MonthlyTotal[] {
  const map = new Map<string, MonthlyTotal>();

  for (const r of records) {
    const date  = new Date(r.timestamp);
    const year  = date.getUTCFullYear();
    const month = date.getUTCMonth(); // 0-indexed
    const key   = `${year}-${String(month + 1).padStart(2, "0")}`;

    const existing = map.get(key);
    if (existing) {
      existing.token_count    += r.token_count;
      existing.openai_credits += r.openai_credits;
    } else {
      map.set(key, {
        month:          key,
        label:          `${MONTH_LABELS[month]} ${year}`,
        token_count:    r.token_count,
        openai_credits: r.openai_credits,
      });
    }
  }

  return Array.from(map.values())
    .filter((m) => m.token_count > 0 || m.openai_credits > 0)
    .sort((a, b) => a.month.localeCompare(b.month));
}

// ---------------------------------------------------------------------------
// Summary stats
// ---------------------------------------------------------------------------

export interface MoMGrowth {
  /** Percentage change this month vs last month (null if no last-month data) */
  pct: number | null;
  /** Direction: "up" | "down" | "neutral" */
  direction: "up" | "down" | "neutral";
  thisMonthTokens: number;
  lastMonthTokens: number;
  thisMonthCredits: number;
  lastMonthCredits: number;
}

export interface TopGrowingUser {
  user_name: string;
  /** Growth this month vs last month (tokens or credits depending on context) */
  growth: number;
  /** Percentage growth */
  pct: number | null;
}

export interface SummaryStats {
  totalTokensAllTime:  number;
  totalTokens30d:      number;
  totalOpenAIAllTime:  number;
  totalOpenAI30d:      number;
  activeUsers:         number;
  /** Claude token MoM */
  mom:                 MoMGrowth;
  /** OpenAI credit MoM */
  momOpenAI:           MoMGrowth;
  topGrowingUser:      TopGrowingUser | null;
  topGrowingUserOAI:   TopGrowingUser | null;
}

/**
 * Computes top-level summary statistics.
 * `recordsThisMonth` and `recordsLastMonth` should already be pre-filtered.
 */
export function computeSummary(
  allRecords: UsageRecord[],
  recordsThisMonth: UsageRecord[],
  recordsLastMonth: UsageRecord[]
): SummaryStats {
  const sumTokens  = (rs: UsageRecord[]) => rs.reduce((acc, r) => acc + r.token_count,    0);
  const sumCredits = (rs: UsageRecord[]) => rs.reduce((acc, r) => acc + r.openai_credits, 0);

  const uniqueUsers = new Set(allRecords.map((r) => r.user_id));

  const thisTokens   = sumTokens(recordsThisMonth);
  const lastTokens   = sumTokens(recordsLastMonth);
  const thisCredits  = sumCredits(recordsThisMonth);
  const lastCredits  = sumCredits(recordsLastMonth);

  const makeMoM = (current: number, prev: number, thisMonthTokens: number, lastMonthTokens: number, thisMonthCredits: number, lastMonthCredits: number): MoMGrowth => {
    const pct = prev > 0 ? ((current - prev) / prev) * 100 : null;
    return {
      pct,
      direction: pct === null ? "neutral" : pct > 0 ? "up" : pct < 0 ? "down" : "neutral",
      thisMonthTokens,
      lastMonthTokens,
      thisMonthCredits,
      lastMonthCredits,
    };
  };

  const mom       = makeMoM(thisTokens,   lastTokens,   thisTokens,  lastTokens,  thisCredits, lastCredits);
  const momOpenAI = makeMoM(thisCredits,  lastCredits,  thisTokens,  lastTokens,  thisCredits, lastCredits);

  const thisMonthByUser = aggregateByUser(recordsThisMonth);
  const lastMonthByUser = aggregateByUser(recordsLastMonth);
  const lastMonthMap    = new Map(lastMonthByUser.map((u) => [u.user_id, u]));

  const findTopGrowing = (getValue: (u: UserTotals) => number): TopGrowingUser | null => {
    let top: TopGrowingUser | null = null;
    let best = -Infinity;
    for (const user of thisMonthByUser) {
      const prev   = lastMonthMap.get(user.user_id);
      const curr   = getValue(user);
      const prevV  = prev ? getValue(prev) : 0;
      const growth = curr - prevV;
      if (growth > best) {
        best = growth;
        top  = { user_name: user.user_name, growth, pct: prevV > 0 ? (growth / prevV) * 100 : null };
      }
    }
    return top;
  };

  return {
    totalTokensAllTime: sumTokens(allRecords),
    totalTokens30d:     thisTokens,
    totalOpenAIAllTime: sumCredits(allRecords),
    totalOpenAI30d:     thisCredits,
    activeUsers:        uniqueUsers.size,
    mom,
    momOpenAI,
    topGrowingUser:    findTopGrowing((u) => u.token_count),
    topGrowingUserOAI: findTopGrowing((u) => u.openai_credits),
  };
}
