/**
 * Formats a large number into a human-readable string.
 * Examples: 1_234_567 → "1.2M", 450_000 → "450K", 999 → "999"
 */
export function formatTokenCount(n: number): string {
  if (n >= 1_000_000_000) {
    return `${(n / 1_000_000_000).toFixed(2)}B`;
  }
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1)}K`;
  }
  return n.toLocaleString();
}

/**
 * Formats a number with thousands separators for table display.
 */
export function formatTokensFull(n: number): string {
  return n.toLocaleString();
}

/**
 * Formats an OpenAI credit amount as USD currency.
 * Examples: 1150 → "$1,150", 0.50 → "$0.50", 0 → "$0"
 */
export function formatCredits(n: number): string {
  if (n === 0) return "$0";
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
