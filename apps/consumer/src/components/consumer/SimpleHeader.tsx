import Link from "next/link";
import type { ReactNode } from "react";
import { Share2 } from "lucide-react";
import { ClassChip } from "./ClassChip";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// Shared header for Saved, QR, Inbox, Me (profile), Invite, Reservations, etc.
// SimpleHeader is the default top chrome for most shell routes.
//
//   share — [Logo] · title (true center) · [Share][Plan] — share overlays, not in flow
//   class — [Logo] · title · [Plan]
export function SimpleHeader({
  title,
  rightAction = "class",
}: {
  title: ReactNode;
  rightAction?: "class" | "share";
}) {
  const isShare = rightAction === "share";

  return (
    <header className="border-border relative flex h-16 shrink-0 items-center border-b px-4">
      <div className="relative z-10 flex w-10 shrink-0 items-center">
        <Link
          href={CONSUMER_ROUTES.me.class}
          className="bg-primary shadow-glow flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-xl leading-none"
          aria-label="Mesita — profile"
        >
          <span role="img" aria-label="Peacock">
            🦚
          </span>
        </Link>
      </div>

      {/* Centered as if only logo + plan chip exist — share is overlaid, not in flow */}
      <h1 className="font-display pointer-events-none absolute inset-x-0 truncate px-20 text-center text-xl leading-tight font-semibold tracking-tight">
        {title}
      </h1>

      <div className="relative z-10 ml-auto flex w-10 shrink-0 items-center justify-end">
        <ClassChip />
      </div>

      {isShare ? (
        <Link
          href={CONSUMER_ROUTES.invite}
          aria-label="Invite friends"
          className="border-border bg-card text-foreground/70 hover:bg-muted absolute top-1/2 right-[calc(1rem+2.5rem+0.5rem)] z-10 flex h-10 w-10 shrink-0 -translate-y-1/2 items-center justify-center rounded-2xl border transition active:scale-[0.98]"
        >
          <Share2 className="h-5 w-5" />
        </Link>
      ) : null}
    </header>
  );
}
