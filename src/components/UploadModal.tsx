import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@posh/design-kit/components/card";

interface UploadModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

type PlatformType = "claude" | "openai";

function formatMonthLabel(yyyymm: string): string {
  const [y, mo] = yyyymm.split("-");
  const date = new Date(Number(y), Number(mo) - 1, 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

interface UploadStats {
  newUsers: number;
  newRecords: number;
  updatedRecords: number;
}

export function UploadModal({ onClose, onSuccess }: UploadModalProps) {
  const [platform, setPlatform] = useState<PlatformType | null>(null);
  const [file, setFile]         = useState<File | null>(null);
  const [status, setStatus]     = useState<"idle" | "uploading" | "success" | "error" | "undoing" | "undone">("idle");
  const [message, setMessage]   = useState<string>("");
  const [stats, setStats]       = useState<UploadStats | null>(null);
  const [undoToken, setUndoToken] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const canSubmit = platform !== null && file !== null && status !== "uploading";

  async function handleSubmit() {
    if (!canSubmit || !file || !platform) return;

    setStatus("uploading");
    setMessage("");

    const form = new FormData();
    form.append("file", file);
    form.append("type", platform);

    try {
      const res  = await fetch("/api/upload", { method: "POST", body: form });
      const body = await res.json() as {
        ok?: boolean; error?: string;
        ingested?: number; skipped?: number; months?: string[];
        newUsers?: number; newRecords?: number; updatedRecords?: number;
        undoToken?: string;
      };

      if (!res.ok || !body.ok) {
        setStatus("error");
        setMessage(body.error ?? `Server error ${res.status}`);
        return;
      }

      const monthLabels = (body.months ?? []).map(formatMonthLabel).join(", ");
      setStatus("success");
      setMessage(monthLabels ? `Data imported for ${monthLabels}.` : "Data imported successfully.");
      setStats({
        newUsers:       body.newUsers       ?? 0,
        newRecords:     body.newRecords     ?? 0,
        updatedRecords: body.updatedRecords ?? 0,
      });
      setUndoToken(body.undoToken ?? null);
      onSuccess();
    } catch (err) {
      setStatus("error");
      setMessage((err as Error).message ?? "Upload failed.");
    }
  }

  async function handleUndo() {
    setStatus("undoing");
    setMessage("");
    try {
      const res  = await fetch("/api/upload/undo", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ undoToken }),
      });
      const body = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) {
        setStatus("error");
        setMessage(body.error ?? `Undo failed (${res.status})`);
        return;
      }
      setStatus("undone");
      setMessage("Last upload has been reverted.");
      setUndoToken(null);
      onSuccess();
    } catch (err) {
      setStatus("error");
      setMessage((err as Error).message ?? "Undo failed.");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <Card className="w-full max-w-md mx-4 shadow-xl">
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-base">Upload Usage CSV</CardTitle>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none cursor-pointer"
            aria-label="Close"
          >
            ✕
          </button>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">

          {/* Platform selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Platform</label>
            <div className="flex gap-2">
              {(["claude", "openai"] as PlatformType[]).map((p) => (
                <button
                  key={p}
                  onClick={() => { setPlatform(p); setStatus("idle"); setMessage(""); }}
                  className={[
                    "flex-1 rounded-md border px-4 py-2 text-sm font-medium transition-colors cursor-pointer",
                    platform === p
                      ? p === "claude"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-[#10a37f] bg-[#10a37f]/10 text-[#10a37f]"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30",
                  ].join(" ")}
                >
                  {p === "claude" ? "Claude" : "OpenAI"}
                </button>
              ))}
            </div>
          </div>

          {/* File picker */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">CSV File</label>
            <p className="text-xs text-muted-foreground">
              Any CSV format — columns and reporting period are detected automatically.
            </p>
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 rounded-md border border-dashed border-border px-4 py-3 text-sm text-muted-foreground hover:border-foreground/40 hover:text-foreground transition-colors cursor-pointer"
            >
              <span className="text-base">↑</span>
              {file ? file.name : "Choose a CSV file…"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setStatus("idle");
                setMessage("");
              }}
            />
          </div>

          {/* Uploading / undoing indicator */}
          {(status === "uploading" || status === "undoing") && (
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground italic">
              {status === "uploading" ? "Detecting columns and importing data…" : "Reverting last upload…"}
            </div>
          )}

          {/* Success panel */}
          {status === "success" && stats && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center size-5 rounded-full bg-green-500 text-white text-xs font-bold leading-none">✓</span>
                <span className="text-sm font-medium text-green-600 dark:text-green-400">Success!</span>
                <span className="text-sm text-muted-foreground">{message}</span>
              </div>
              <div className="flex flex-col gap-0.5 pl-7 text-xs text-muted-foreground">
                <span>New Users Added: {stats.newUsers}</span>
                <span>New Usage Records: {stats.newRecords}</span>
                <span>Updated Usage Records: {stats.updatedRecords}</span>
              </div>
            </div>
          )}

          {/* Error / undone message */}
          {message && status !== "uploading" && status !== "undoing" && status !== "success" && (
            <p className={[
              "rounded-md px-3 py-2 text-sm",
              status === "error"  ? "bg-destructive/10 text-destructive" : "",
              status === "undone" ? "bg-muted/60 text-muted-foreground" : "",
            ].join(" ")}>
              {message}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              {status === "success" || status === "undone" ? "Close" : "Cancel"}
            </button>
            {status === "success" && (
              <button
                onClick={handleUndo}
                className="flex-1 rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors cursor-pointer"
              >
                Undo Upload
              </button>
            )}
            {status !== "success" && status !== "undone" && (
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className={[
                  "flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors",
                  canSubmit
                    ? "bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
                    : "bg-muted text-muted-foreground cursor-not-allowed",
                ].join(" ")}
              >
                {status === "uploading" ? "Uploading…" : "Upload"}
              </button>
            )}
          </div>

        </CardContent>
      </Card>
    </div>
  );
}
