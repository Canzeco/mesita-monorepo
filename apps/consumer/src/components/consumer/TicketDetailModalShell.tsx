"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

export function TicketDetailModalShell({
  children,
}: {
  children: React.ReactNode;
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
    <div className="absolute inset-0 z-50 flex flex-col overflow-hidden bg-background">
      <header className="bg-background/90 z-20 flex shrink-0 items-center gap-2 px-3 py-3 backdrop-blur">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className="border-border bg-card text-foreground hover:bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={2.25} />
        </button>
        <p className="font-display flex-1 truncate text-center text-sm font-semibold">
          Ticket details
        </p>
        <span className="h-9 w-9 shrink-0" />
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}

