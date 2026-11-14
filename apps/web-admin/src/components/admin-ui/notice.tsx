import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { Alert } from "./ui/alert";

export type NoticeTone = "error" | "warning" | "info" | "success";

const ICON = { error: AlertCircle, warning: AlertTriangle, info: Info, success: CheckCircle2 } as const;

/** The one inline notice; not dismissible. `error` is an alert, success and info are polite. */
export function Notice({
  tone = "error",
  className,
  children,
}: {
  tone?: NoticeTone;
  /** Layout only (margin). */
  className?: string;
  children: React.ReactNode;
}) {
  const Icon = ICON[tone];
  const live =
    tone === "error"
      ? { role: "alert" as const }
      : tone === "warning"
        ? {}
        : { "aria-live": "polite" as const };
  return (
    <Alert tone={tone} className={className} {...live}>
      <Icon aria-hidden />
      <div className="min-w-0 font-medium">{children}</div>
    </Alert>
  );
}
