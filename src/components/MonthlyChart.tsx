import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@posh/design-kit/components/card";
import { Badge } from "@posh/design-kit/components/badge";
import type { MonthlyTotal } from "../utils";
import { formatTokenCount, formatCredits } from "../utils";

export type ChartMode = "claude" | "openai";

interface MonthlyChartProps {
  data: MonthlyTotal[];
  mode?: ChartMode;
}

// Normalise data to a single "value" key so recharts animates between tab
// switches rather than remounting the Bar when dataKey changes.
function normalise(data: MonthlyTotal[], mode: ChartMode) {
  return data.map((d) => ({
    label: d.label,
    value: mode === "claude" ? d.token_count : d.openai_credits,
  }));
}

function ChartTooltip({
  active,
  payload,
  label,
  mode,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  mode: ChartMode;
}) {
  if (!active || !payload?.length) return null;
  const isClaude = mode === "claude";
  return (
    <div className="rounded-lg border bg-card p-3 shadow-md text-sm min-w-[160px]">
      <p className="font-medium text-foreground mb-1">{label}</p>
      <div className="flex items-center justify-between gap-4">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span
            className="inline-block size-2.5 rounded-sm"
            style={{ background: isClaude ? "var(--primary)" : "#10a37f" }}
          />
          {isClaude ? "Tokens" : "Credits"}
        </span>
        <span className="font-semibold text-foreground">
          {isClaude
            ? formatTokenCount(payload[0].value)
            : formatCredits(payload[0].value)}
        </span>
      </div>
    </div>
  );
}

export function MonthlyChart({ data, mode = "claude" }: MonthlyChartProps) {
  const isClaude = mode === "claude";
  const normalisedData = normalise(data, mode);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Monthly Usage</CardTitle>
        <Badge variant="secondary" shape="pill">All users · All time</Badge>
      </CardHeader>
      <CardContent className="pt-2">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={normalisedData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
            />
            <YAxis
              tickFormatter={(v) => isClaude ? formatTokenCount(v as number) : formatCredits(v as number)}
              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              width={64}
            />
            <Tooltip content={<ChartTooltip mode={mode} />} />
            <Bar
              dataKey="value"
              name={isClaude ? "Claude tokens" : "OpenAI credits"}
              fill={isClaude ? "var(--primary)" : "#10a37f"}
              radius={[4, 4, 0, 0]}
              isAnimationActive
              animationBegin={0}
              animationDuration={1000}
              animationEasing="ease-in-out"
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
