import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@posh/design-kit/components/card";
import { Badge } from "@posh/design-kit/components/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@posh/design-kit/components/table";
import type { UserTotals } from "../utils";
import { formatTokenCount, formatCredits, formatTokensFull } from "../utils";
import type { ChartMode } from "./MonthlyChart";

interface TopUsersTableProps {
  title: string;
  users: UserTotals[];
  maxRows?: number;
  mode?: ChartMode;
}

export function TopUsersTable({ title, users, maxRows = 10, mode = "claude" }: TopUsersTableProps) {
  const isClaude = mode === "claude";

  const sorted = users
    .slice()
    .filter((u) => (isClaude ? u.token_count : u.openai_credits) > 0)
    .sort((a, b) => isClaude
      ? b.token_count - a.token_count
      : b.openai_credits - a.openai_credits
    );

  const displayed = sorted.slice(0, maxRows);
  const maxVal = isClaude
    ? (displayed[0]?.token_count ?? 1)
    : (displayed[0]?.openai_credits ?? 1);

  const [animated, setAnimated] = useState(false);
  useEffect(() => {
    setAnimated(false);
    const id = requestAnimationFrame(() => setAnimated(true));
    return () => cancelAnimationFrame(id);
  }, [users, mode]);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <Badge variant="secondary" shape="pill">{displayed.length} users</Badge>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 pl-6">#</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="w-full"></TableHead>
              <TableHead className="pr-6 text-right">
                {isClaude ? "Tokens" : "Credits"}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayed.map((user, i) => {
              const val   = isClaude ? user.token_count : user.openai_credits;
              const pct   = maxVal > 0 ? (val / maxVal) * 100 : 0;
              const delay = `${i * 40}ms`;
              const barColor = isClaude ? "var(--primary)" : "#10a37f";
              return (
                <TableRow key={user.user_id}>
                  <TableCell className="pl-6 text-xs font-medium text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="whitespace-nowrap font-medium">{user.user_name}</TableCell>
                  <TableCell className="px-4">
                    <div className="h-1.5 min-w-16 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: animated ? `${pct}%` : "0%",
                          background: barColor,
                          transition: `width 1000ms cubic-bezier(0.22,1,0.36,1) ${delay}`,
                        }}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="pr-6 text-right">
                    {isClaude ? (
                      val > 0 ? (
                        <Badge variant="secondary" title={formatTokensFull(val) + " tokens"}>
                          {formatTokenCount(val)}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )
                    ) : (
                      val > 0 ? (
                        <Badge
                          variant="outline"
                          title={`$${val.toFixed(2)}`}
                          className="text-[#10a37f] border-[#10a37f]/40"
                        >
                          {formatCredits(val)}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
