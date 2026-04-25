import { useEffect, useMemo, useState } from "react";

import { getUsageData, type UsageRecord } from "../data";
import {
  aggregateByMonth,
  aggregateByUser,
  applyTimeFilter,
  computeSummary,
  formatTokenCount,
  formatCredits,
  type TimeFilter,
} from "../utils";
import {
  AllUsersTable,
  MonthlyChart,
  SummaryCard,
  TopUsersTable,
  UploadModal,
  type ChartMode,
} from "../components";

export function Dashboard() {
  const [records, setRecords]               = useState<UsageRecord[]>([]);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState<string | null>(null);
  const [tab, setTab]                       = useState<ChartMode>("claude");
  const [allUsersFilter, setAllUsersFilter] = useState<TimeFilter>("all");
  const [uploadOpen, setUploadOpen]         = useState(false);

  function refreshData() {
    getUsageData()
      .then(setRecords)
      .catch((err: Error) => setError(err.message));
  }

  useEffect(() => {
    getUsageData()
      .then(setRecords)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const recordsThisMonth = useMemo(() => applyTimeFilter(records, "this-month"), [records]);
  const recordsLastMonth = useMemo(() => applyTimeFilter(records, "last-month"), [records]);

  const summary = useMemo(
    () => computeSummary(records, recordsThisMonth, recordsLastMonth),
    [records, recordsThisMonth, recordsLastMonth]
  );

  const allUsersThisMonth = useMemo(() => aggregateByUser(recordsThisMonth), [recordsThisMonth]);
  const monthlyData    = useMemo(() => aggregateByMonth(records), [records]);

  const filteredRecords = useMemo(
    () => applyTimeFilter(records, allUsersFilter),
    [records, allUsersFilter]
  );
  const allUsersSorted = useMemo(() => aggregateByUser(filteredRecords), [filteredRecords]);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Loading usage data…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="loading-screen">
        <p className="font-semibold text-destructive">Failed to load data</p>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  const isClaude = tab === "claude";

  // Claude card strings
  const claudeTopUser    = summary.topGrowingUser;
  const claudeTopUserStr = claudeTopUser
    ? (claudeTopUser.pct !== null ? `+${claudeTopUser.pct.toFixed(0)}% vs last month` : "New this month")
    : null;

  // OpenAI card strings
  const oaiTopUser    = summary.topGrowingUserOAI;
  const oaiTopUserStr = oaiTopUser
    ? (oaiTopUser.pct !== null ? `+${oaiTopUser.pct.toFixed(0)}% vs last month` : "New this month")
    : null;

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto flex max-w-screen-xl flex-col gap-6 px-6 py-8">

        {/* Title row + tab switcher */}
        <div className="rise-in flex items-center justify-between gap-4" style={{ animationDelay: "0ms" }}>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Posh Token Consumption
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Data is manually sourced via CSV — last import as of 04/24/2026
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => setUploadOpen(true)}
              className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors whitespace-nowrap cursor-pointer"
            >
              Upload Usage CSV
            </button>

            <div className="flex gap-1 rounded-lg bg-muted p-1">
            {(["claude", "openai"] as ChartMode[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={[
                  "rounded-md px-4 py-1.5 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer",
                  tab === t
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                {t === "claude" ? "Claude" : "OpenAI"}
              </button>
            ))}
            </div>
          </div>
        </div>


        {/* Summary cards */}
        <div className="rise-in grid grid-cols-2 gap-4 lg:grid-cols-4" style={{ animationDelay: "160ms" }}>
          {isClaude ? (
            <>
              <SummaryCard
                title="All time · tokens"
                value={formatTokenCount(summary.totalTokensAllTime)}
              />
              <SummaryCard
                title="This month · tokens"
                value={formatTokenCount(summary.totalTokens30d)}
              />
              <SummaryCard
                title="Month-over-month"
                value={summary.mom.pct !== null ? `${summary.mom.pct >= 0 ? "+" : ""}${summary.mom.pct.toFixed(1)}%` : "—"}
                subtitle="vs last month"
                direction={summary.mom.direction}
              />
              {claudeTopUser ? (
                <SummaryCard
                  title="Top growing user"
                  value={claudeTopUser.user_name}
                  subtitle={claudeTopUserStr ?? undefined}
                  direction="up"
                />
              ) : (
                <SummaryCard title="Top growing user" value="—" />
              )}
            </>
          ) : (
            <>
              <SummaryCard
                title="All time · credits"
                value={formatCredits(summary.totalOpenAIAllTime)}
              />
              <SummaryCard
                title="This month · credits"
                value={formatCredits(summary.totalOpenAI30d)}
              />
              <SummaryCard
                title="Month-over-month"
                value={summary.momOpenAI.pct !== null ? `${summary.momOpenAI.pct >= 0 ? "+" : ""}${summary.momOpenAI.pct.toFixed(1)}%` : "—"}
                subtitle="vs last month"
                direction={summary.momOpenAI.direction}
              />
              {oaiTopUser ? (
                <SummaryCard
                  title="Top growing user"
                  value={oaiTopUser.user_name}
                  subtitle={oaiTopUserStr ?? undefined}
                  direction="up"
                />
              ) : (
                <SummaryCard title="Top growing user" value="—" />
              )}
            </>
          )}
        </div>

        {/* Monthly chart */}
        <div className="rise-in" style={{ animationDelay: "240ms" }}>
          <MonthlyChart data={monthlyData} mode={tab} />
        </div>

        {/* Top 10 users this month */}
        <div className="rise-in" style={{ animationDelay: "320ms" }}>
          <TopUsersTable
            title="Top 10 · This month"
            users={allUsersThisMonth}
            mode={tab}
          />
        </div>

        {/* All users */}
        <div className="rise-in" style={{ animationDelay: "400ms" }}>
          <AllUsersTable
            users={allUsersSorted}
            filter={allUsersFilter}
            onFilterChange={setAllUsersFilter}
            mode={tab}
          />
        </div>

      </main>

      {uploadOpen && (
        <UploadModal
          onClose={() => setUploadOpen(false)}
          onSuccess={refreshData}
        />
      )}
    </div>
  );
}
