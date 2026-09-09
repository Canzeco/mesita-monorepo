"use client";

// The console's one modal shell.
//
// A question that costs the page nothing to answer belongs inline; a question
// with a permanent consequence — "which country is this Stripe account in",
// answered once and never again — does not belong sitting open on a summary
// card, where two selects and a caveat paragraph read as clutter around the
// button they gate (Pato, 2026-09-09). The card keeps ONE control; this holds
// what that control asks for.
//
// Same chrome as PlaceTagsPicker's picker, extracted so the second modal in
// the console does not fork a third set of z-index and backdrop values.

import { useEffect } from "react";
import { X } from "lucide-react";

export function Modal({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // The page behind must not scroll under a modal — on a phone the backdrop
  // is the whole viewport, so a stray touch scrolls a document the reader
  // cannot see.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="border-border/70 bg-card shadow-elev flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl border"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="border-border flex items-start justify-between gap-3 border-b px-5 py-4">
          <div className="min-w-0">
            <h3 className="font-display text-base font-semibold tracking-tight">
              {title}
            </h3>
            {description && (
              <p className="text-muted-foreground mt-0.5 text-[12px] leading-relaxed">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground hover:bg-muted/60 -mr-1.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
