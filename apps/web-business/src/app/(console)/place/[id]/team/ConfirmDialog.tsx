"use client";

import { useEffect } from "react";

import { cn } from "@/lib/utils";

// In-app confirmation, replacing native window.confirm so destructive
// actions get a styled dialog instead of the browser's gray box.
export type ConfirmState = {
  title: string;
  body: string;
  confirmLabel: string;
  tone: "default" | "destructive";
  onConfirm: () => void;
};

// Styled replacement for window.confirm — backdrop + card, Escape and
// backdrop-click both cancel. Destructive actions get a red confirm button.
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  tone,
  onConfirm,
  onCancel,
}: ConfirmState & { onCancel: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
    >
      <div
        className="border-border bg-card w-full max-w-sm rounded-2xl border p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-lg font-semibold tracking-tight">
          {title}
        </h2>
        <p className="text-muted-foreground mt-1.5 text-sm">{body}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="border-border bg-background text-foreground hover:bg-muted inline-flex h-10 items-center rounded-full border px-4 text-[13px] font-semibold transition"
          >
            Cancel
          </button>
          <button
            type="button"
            autoFocus
            onClick={onConfirm}
            className={cn(
              "inline-flex h-10 items-center rounded-full px-5 text-[13px] font-semibold text-white shadow-sm transition hover:opacity-90",
              tone === "destructive" ? "bg-destructive" : "bg-pink-gradient",
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
