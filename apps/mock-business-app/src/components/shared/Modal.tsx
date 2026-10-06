"use client";

// THE DIALOG, SAID ONCE (MESITA-1927).
//
// The console had exactly one modal before this — the Atlas tag picker inside
// `place-manage/PlaceTagsPicker.tsx` — and it spelled the whole thing inline:
// the backdrop, the Escape listener, the stopPropagation, the close button.
// A second caller copying that spelling is how two dialogs end up disagreeing
// about which one closes on a backdrop click, so the shape moves here and the
// picker keeps its own body.
//
// IT RESTORES FOCUS ON CLOSE, which the inline version did not. A dialog that
// opens from a button and returns the caret to the top of the document leaves
// a keyboard user with no idea where they are — and on this route the button
// that opens it is a purchase.
//
// It is NOT a focus TRAP. A real trap needs a sentinel at each end and a
// tabindex sweep of the subtree, and getting it half-right is worse than not
// claiming it: the honest version here is that Escape always works, focus
// lands inside on open, and it goes back where it came from on close.
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { FOCUS_RING_CLASS, ICON_TOUCH_TARGET_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

export function Modal({
  title,
  description,
  onClose,
  children,
  labelledBy = "modal-title",
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  labelledBy?: string;
}) {
  const panel = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Where the caret was before we took it. Captured on mount rather than
    // read on unmount, because by then the opener may already be gone.
    const opener = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={panel}
        // -1, not 0: the panel is a focus TARGET on open, never a tab stop of
        // its own once the user is inside it.
        tabIndex={-1}
        className={cn(
          "border-border/70 bg-card shadow-elev flex max-h-[85dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border",
          FOCUS_RING_CLASS,
        )}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
      >
        <div className="border-border flex items-start justify-between gap-3 border-b px-5 py-4">
          <div className="min-w-0">
            <h2 id={labelledBy} className="font-display text-base font-semibold tracking-tight">
              {title}
            </h2>
            {description && (
              <p className="text-muted-foreground mt-0.5 text-[12px] leading-snug">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={cn(
              "text-muted-foreground hover:text-foreground hover:bg-muted/60 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition",
              FOCUS_RING_CLASS,
              ICON_TOUCH_TARGET_CLASS,
            )}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
