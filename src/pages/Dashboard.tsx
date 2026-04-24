import { useEffect, useMemo, useRef, useState } from "react";

const AI_QUOTES = [
  "The question of whether a computer can think is no more interesting than the question of whether a submarine can swim. — Edsger Dijkstra",
  "Artificial intelligence is the new electricity. — Andrew Ng",
  "AI is probably the most important thing humanity has ever worked on. — Sundar Pichai",
  "The development of full artificial intelligence could spell the end of the human race… or its greatest flourishing. — Stephen Hawking",
  "AI will be the best or worst thing ever for humanity. We don't know which yet. — Elon Musk",
  "We are at a moment where AI has the potential to compress decades of scientific progress into just a few years. — Dario Anthropic",
  "AI is not a substitute for human intelligence; it is a tool to amplify human creativity. — Fei-Fei Li",
  "The real risk with AI isn't malice but competence. — Nick Bostrom",
  "Intelligence is the ability to adapt to change. — Stephen Hawking",
  "By far the greatest danger of artificial intelligence is that people conclude too early that they understand it. — Eliezer Yudkowsky",
  "Machine intelligence is the last invention that humanity will ever need to make. — Nick Bostrom",
  "AI won't replace humans, but humans who use AI will replace humans who don't.",
  "The pace of progress in artificial intelligence is incredibly fast. — Elon Musk",
  "Every aspect of learning or any other feature of intelligence can in principle be so precisely described that a machine can be made to simulate it. — John McCarthy",
  "Anything that could give rise to smarter-than-human intelligence — in the form of AI — is one of the most transformative and potentially dangerous technologies in human history. — Sam Altman",
  "AI is a mirror — it reflects the best and worst of human ingenuity back at us.",
  "The potential benefits of AI are huge, so are the dangers. — Dave Waters",
  "A year from now, AI will have done things we currently believe are impossible.",
  "We're moving from a world where computing power was scarce to a world where it is almost free. — Marc Andreessen",
  "AI is like electricity — once it's everywhere, you stop noticing it and start relying on it.",
  "What we want is a machine that can learn from experience. — Alan Turing",
  "The automation of factories has already decimated jobs in traditional manufacturing. AI is about to do the same to knowledge work.",
  "In the long history of humankind, those who learned to collaborate and improvise most effectively have prevailed. — Charles Darwin",
  "The measure of intelligence is the ability to change. — Albert Einstein",
  "Imagination is more important than knowledge. For knowledge is limited, whereas imagination embraces the entire world. — Albert Einstein",
  "The greatest achievement of humanity is not its works of art, science, or technology, but the recognition of its own dysfunction. — Eckhart Tolle",
  "We are living in the most extraordinary moment in history — AI gives us the tools to solve problems we've only dreamed of solving.",
  "To invent tomorrow you must understand today. — James Burke",
  "The best way to predict the future is to invent it. — Alan Kay",
  "We cannot solve our problems with the same thinking we used when we created them. — Albert Einstein",
];

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
  const quote = useRef(AI_QUOTES[Math.floor(Math.random() * AI_QUOTES.length)]).current;

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

        {/* Quote banner */}
        <div className="rise-in rounded-xl border border-border bg-card px-5 py-3" style={{ animationDelay: "80ms" }}>
          <p className="text-sm text-muted-foreground italic">🚀  &ldquo;{quote}&rdquo;</p>
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
