import { CheckCircle2, Loader2, XCircle } from "lucide-react";

type BatchRowStatus = "pending" | "running" | "ok" | "error";

/** Shared pending/running/ok/error glyph for Create + Enrich batch tables. */
export function StatusIcon({ status }: { status: BatchRowStatus }) {
  if (status === "ok")
    return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />;
  if (status === "error")
    return <XCircle className="text-destructive h-4 w-4 shrink-0" />;
  if (status === "running")
    return <Loader2 className="text-muted-foreground h-4 w-4 shrink-0 animate-spin" />;
  return (
    <span className="border-border bg-background h-4 w-4 shrink-0 rounded-full border" />
  );
}
