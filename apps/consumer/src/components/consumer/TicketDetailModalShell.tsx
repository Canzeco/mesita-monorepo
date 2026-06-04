"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

// Ticket details render as a bottom sheet that slides up from the bottom and
// stops short of the top — the page underneath stays partly visible behind a
// dimmed backdrop. Tapping the backdrop or pressing Escape closes it.
export function TicketDetailModalShell({
  children,
  title = "Your visit",
}: {
  children: React.ReactNode;
  title?: string;
}) {
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") router.back();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <div className="pointer-events-auto absolute inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Close"
        onClick={() => router.back()}
        className="animate-in fade-in absolute inset-0 cursor-default bg-black/40 backdrop-blur-sm duration-300"
      />

      <div className="animate-in slide-in-from-bottom bg-background border-border relative flex max-h-[90%] min-h-0 flex-col overflow-hidden rounded-t-2xl border-t shadow-[0_-12px_32px_rgba(0,0,0,0.25)] duration-300 ease-out">
        <div className="bg-foreground/20 mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full" />

        <header className="flex shrink-0 items-center gap-2 px-3 pt-2 pb-3">
          <span className="h-8 w-8 shrink-0" />
          <p className="font-display flex-1 truncate text-center text-sm font-semibold">
            {title}
          </p>
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Close"
            className="border-border bg-card text-foreground hover:bg-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition"
          >
            <X className="h-4 w-4" strokeWidth={2.25} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
