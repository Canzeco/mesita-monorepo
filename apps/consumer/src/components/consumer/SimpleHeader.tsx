import Link from "next/link";
import { Share2 } from "lucide-react";
import { ClassChip } from "./ClassChip";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// Shared header for Saved, QR, Inbox, Me (profile), Invite, Reservations, etc.
// Explore is the exception — it uses DiscoverHeader.
//
//   share — [Logo][Share] · title · [Plan]
//   class — [Logo] · title · [Plan]
export function SimpleHeader({
  title,
  rightAction = "class",
}: {
  title: string;
  rightAction?: "class" | "share";
}) {
  const isShare = rightAction === "share";

  return (
    <header className="border-border flex h-16 shrink-0 items-center gap-2 border-b px-4">
      <div className="flex shrink-0 items-center gap-2">
        <Link
          href={CONSUMER_ROUTES.me.plan}
          className="bg-primary shadow-glow flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-xl leading-none"
          aria-label="Mesita — profile"
        >
          <span role="img" aria-label="Peacock">
            🦚
          </span>
        </Link>
        {isShare ? (
          <Link
            href={CONSUMER_ROUTES.share}
            aria-label="Invite friends"
            className="border-border bg-card text-foreground/70 hover:bg-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition active:scale-[0.98]"
          >
            <Share2 className="h-5 w-5" />
          </Link>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-center px-1">
        <h1 className="font-display truncate text-xl leading-tight font-semibold tracking-tight">
          {title}
        </h1>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <ClassChip />
      </div>
    </header>
  );
}
