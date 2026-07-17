import { Phone, Video } from "lucide-react";
import type { AutoVerifyMethod } from "./actions";

export function AutoModeToggle({
  method,
  label,
  blurb,
  enabled,
  pending,
  onToggle,
}: {
  method: AutoVerifyMethod;
  label: string;
  blurb: string;
  enabled: boolean;
  pending: boolean;
  onToggle: () => void;
}) {
  const Icon = method === "ai_call" ? Phone : Video;
  return (
    <div className="border-border bg-card flex items-start gap-4 rounded-2xl border p-5">
      <span
        className={
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full " +
          (enabled
            ? "bg-secondary/15 text-secondary"
            : "bg-muted text-muted-foreground")
        }
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-base font-semibold tracking-tight">
          {label}
        </p>
        <p className="text-muted-foreground mt-1 text-[13px] leading-relaxed">
          {blurb}
        </p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        disabled={pending}
        aria-pressed={enabled}
        className={
          "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition disabled:opacity-50 " +
          (enabled ? "bg-secondary" : "bg-muted")
        }
      >
        <span
          className={
            "bg-card inline-block h-5 w-5 transform rounded-full shadow transition " +
            (enabled ? "translate-x-6" : "translate-x-1")
          }
        />
      </button>
    </div>
  );
}
