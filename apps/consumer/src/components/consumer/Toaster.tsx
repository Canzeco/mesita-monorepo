"use client";

import { useEffect, useState } from "react";
import { Check, AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { subscribeToToasts, toast, type Toast } from "@/lib/toast";

// Stacked toaster. Mounts inside the consumer shell so toasts float above
// the modal slot + bottom nav. Each toast slides up + fades in via
// tw-animate-css; auto-dismisses after its duration (toast.ts owns the
// timer). Tone drives the icon + accent color.

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => subscribeToToasts(setToasts), []);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[100] flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <ToastCard key={t.id} t={t} />
      ))}
    </div>
  );
}

function ToastCard({ t }: { t: Toast }) {
  const Icon = t.tone === "success" ? Check : t.tone === "error" ? AlertCircle : null;
  // emerald-600 / red-600 read against the light card; the lighter 400
  // variants we used before were tuned for the old dark surface.
  const iconClass =
    t.tone === "success"
      ? "text-emerald-600"
      : t.tone === "error"
        ? "text-red-600"
        : "text-foreground";
  return (
    <div
      role="status"
      className={cn(
        "animate-in slide-in-from-bottom-2 fade-in pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-full border bg-card/95 px-4 py-2.5 text-sm shadow-elev backdrop-blur duration-200",
        t.tone === "error" ? "border-red-500/40" : "border-border",
      )}
    >
      {Icon && (
        <Icon className={cn("h-4 w-4 shrink-0", iconClass)} strokeWidth={2.5} />
      )}
      <span className="text-foreground flex-1 leading-snug">{t.message}</span>
      {t.action && (
        <button
          type="button"
          onClick={() => {
            t.action?.onClick();
            toast.dismiss(t.id);
          }}
          className="text-secondary hover:bg-muted -mr-2 shrink-0 rounded-full px-3 py-1 text-xs font-semibold"
        >
          {t.action.label}
        </button>
      )}
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => toast.dismiss(t.id)}
        className="text-muted-foreground hover:bg-muted -mr-1 shrink-0 rounded-full p-1"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
