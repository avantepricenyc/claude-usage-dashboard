import type { UsageRecord } from "../data";

// ---------------------------------------------------------------------------
// Time window definitions — month-granularity to match spend report CSVs
// ---------------------------------------------------------------------------

export type TimeFilter = "all" | "this-month" | "last-month";

export const TIME_FILTER_LABELS: Record<TimeFilter, string> = {
  all: "All time",
  "this-month": "This month",
  "last-month": "Last month",
};

/**
 * Returns records whose timestamp falls within the given month filter.
 * Comparison is done in UTC to match the UTC midnight timestamps written
 * by the CSV parser.
 */
export function applyTimeFilter(
  records: UsageRecord[],
  filter: TimeFilter
): UsageRecord[] {
  if (filter === "all") return records;

  const now = new Date();
  const thisYear  = now.getUTCFullYear();
  const thisMonth = now.getUTCMonth(); // 0-indexed

  if (filter === "this-month") {
    return records.filter((r) => {
      const d = new Date(r.timestamp);
      return d.getUTCFullYear() === thisYear && d.getUTCMonth() === thisMonth;
    });
  }

  if (filter === "last-month") {
    const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
    const lastYear  = thisMonth === 0 ? thisYear - 1 : thisYear;
    return records.filter((r) => {
      const d = new Date(r.timestamp);
      return d.getUTCFullYear() === lastYear && d.getUTCMonth() === lastMonth;
    });
  }

  return records;
}
