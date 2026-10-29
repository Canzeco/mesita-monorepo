import { AlertTriangle, CheckCircle2, CircleDot, Loader2, Sparkles, XCircle } from "lucide-react";

export type BatchRowState =
  | "pending"
  | "running"
  | "ok"
  | "existed"
  | "enriching"
  | "refused"
  | "error";

/** Shared glyph for batch rows. Distinguishes created / already existed / enriching / failed,
 *  and refused: a Premier run left the place unchanged on purpose (MESITA-3090). */
export function StateIcon({ state }: { state: BatchRowState }) {
  if (state === "ok")
    return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />;
  if (state === "existed")
    return <CircleDot className="h-4 w-4 shrink-0 text-sky-600" />;
  if (state === "enriching")
    return <Sparkles className="h-4 w-4 shrink-0 text-amber-600" />;
  if (state === "refused")
    return <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />;
  if (state === "error")
    return <XCircle className="text-destructive h-4 w-4 shrink-0" />;
  if (state === "running")
    return <Loader2 className="text-muted-foreground h-4 w-4 shrink-0 animate-spin" />;
  return (
    <span className="border-border bg-background h-4 w-4 shrink-0 rounded-full border" />
  );
}
