import Link from "next/link";
import { Share2 } from "lucide-react";
import { ClassChip } from "./ClassChip";
import { MesitaMark } from "./MesitaMark";
import { NotificationBell } from "./NotificationBell";

// Shared header for Saved, Pay, Me (profile), Invite, Reservations, etc.
//
// Layout variants:
//   shell — [Logo][Share] · title · [Bell][Class]  (Saved, Pay, Me)
//   class — [Logo] · title · [Class]
//   invite — [Logo] · title · [Share]
export function SimpleHeader({
  title,
  rightAction = "class",
  userId,
}: {
  title: string;
  rightAction?: "class" | "invite" | "shell";
  /** Required when rightAction is "shell" (notification bell). */
  userId?: string;
}) {
  const showShareLeft = rightAction === "shell" || rightAction === "invite";

  return (
    <header className="border-border flex h-16 shrink-0 items-center gap-2 border-b px-4">
      <div className="flex shrink-0 items-center gap-2">
        <Link
          href="/profile"
          className="border-border bg-card shadow-glow text-secondary flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border p-2"
          aria-label="Mesita — profile"
        >
          <MesitaMark className="h-full w-full" />
        </Link>
        {showShareLeft ? (
          <Link
            href="/invite"
            aria-label="Invite friends"
            className="bg-pink-gradient shadow-glow flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white transition hover:opacity-95 active:scale-[0.98]"
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

      {rightAction === "shell" && userId ? (
        <div className="flex shrink-0 items-center gap-2">
          <NotificationBell userId={userId} />
          <ClassChip />
        </div>
      ) : (
        <ClassChip />
      )}
    </header>
  );
}
