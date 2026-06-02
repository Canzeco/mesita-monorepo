import Link from "next/link";
import { Share2 } from "lucide-react";
import { ClassChip } from "./ClassChip";
import { MesitaMark } from "./MesitaMark";

// Shared header for Saved, Pay, Inbox, Me (profile), Invite, Reservations, etc.
//
//   share — [Logo] · title · [Share][Class]  (Saved, Pay, Me, Inbox)
//   class — [Logo] · title · [Class]
export function SimpleHeader({
  title,
  rightAction = "class",
}: {
  title: string;
  rightAction?: "class" | "share";
}) {
  return (
    <header className="border-border flex h-16 shrink-0 items-center gap-2 border-b px-4">
      <Link
        href="/profile"
        className="border-border bg-card shadow-glow text-secondary flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border p-2"
        aria-label="Mesita — profile"
      >
        <MesitaMark className="h-full w-full" />
      </Link>

      <div className="flex min-w-0 flex-1 items-center justify-center px-1">
        <h1 className="font-display truncate text-xl leading-tight font-semibold tracking-tight">
          {title}
        </h1>
      </div>

      {rightAction === "share" ? (
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/invite"
            aria-label="Invite friends"
            className="bg-pink-gradient shadow-glow flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white transition hover:opacity-95 active:scale-[0.98]"
          >
            <Share2 className="h-5 w-5" />
          </Link>
          <ClassChip />
        </div>
      ) : (
        <ClassChip />
      )}
    </header>
  );
}
