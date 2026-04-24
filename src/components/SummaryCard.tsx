import { StatCard } from "@posh/design-kit/components/stat-card";

interface SummaryCardProps {
  title: string;
  value: string;
  subtitle?: string;
  direction?: "up" | "down" | "neutral";
}

export function SummaryCard({ title, value, subtitle, direction = "neutral" }: SummaryCardProps) {
  return (
    <StatCard
      label={title}
      value={value}
      trend={subtitle ? { value: subtitle, direction, comparisonLabel: "" } : undefined}
      className="rounded-2xl border border-border bg-card px-6 py-5"
    />
  );
}
