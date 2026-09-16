"use client";

// ACCOUNT IS THE PERSON ALONE.
//
// ONE CARD, rows divided by hairlines — not three cards with gaps between them.
// Three bordered boxes say the rows are unrelated; they are one scope, read top
// to bottom. `divide-y` needs the rows to be DIRECT children of the card, which
// is why nothing here wraps them.
//
// FULL WIDTH. The console is fluid and Account caps nothing. There is no
// max-width constant for this page and adding one back has been the same
// mistake twice — "one column" means one FULL WIDTH column.
import Link from "next/link";
import { Building2, LogOut, UserRound } from "lucide-react";
import { useMock } from "@/mock/MockStore";
import { SHELL_ROUTES } from "@/lib/console-routes";
import {
  GHOST_PILL_BUTTON_CLASS,
  SCOPE_CARD_CLASS,
  SCOPE_CHIP_CLASS,
  SCOPE_ROW_CLASS,
  TINY_LABEL_CLASS,
  INFO_BOX_CLASS,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import { day } from "@/lib/format";

export default function AccountPage() {
  const { viewer, world } = useMock();

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Account</h1>
        <p className="text-muted-foreground text-[12px]">You, and what you can reach.</p>
      </header>

      <div className={SCOPE_CARD_CLASS}>
        <div className={SCOPE_ROW_CLASS}>
          <span
            aria-hidden
            className={cn(SCOPE_CHIP_CLASS, "bg-foreground text-background flex items-center justify-center")}
          >
            <UserRound className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className={TINY_LABEL_CLASS}>You</p>
            <p className="font-display truncate text-lg font-semibold tracking-tight">{viewer.name}</p>
            <p className="text-muted-foreground truncate text-[12px]">{viewer.email}</p>
          </div>
          <button type="button" className={GHOST_PILL_BUTTON_CLASS}>Edit</button>
        </div>

        <div className={SCOPE_ROW_CLASS}>
          <span
            aria-hidden
            className={cn(SCOPE_CHIP_CLASS, "bg-muted text-muted-foreground flex items-center justify-center")}
          >
            <Building2 className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className={TINY_LABEL_CLASS}>Places you hold</p>
            <p className="font-display truncate text-lg font-semibold tracking-tight">
              {world.viewerError ? "—" : world.places.length}
            </p>
            <p className="text-muted-foreground truncate text-[12px]">
              {world.viewerError
                ? "Could not be read. Nothing has been established about what you hold."
                : world.places.length === 0
                  ? "None yet."
                  : world.places.map((p) => p.name).join(" · ")}
            </p>
          </div>
          <Link href={SHELL_ROUTES.places} className={GHOST_PILL_BUTTON_CLASS}>
            All places
          </Link>
        </div>

        <div className={SCOPE_ROW_CLASS}>
          <span
            aria-hidden
            className={cn(SCOPE_CHIP_CLASS, "bg-muted text-muted-foreground flex items-center justify-center")}
          >
            <LogOut className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className={TINY_LABEL_CLASS}>Session</p>
            <p className="font-display truncate text-lg font-semibold tracking-tight">
              Since {day(viewer.joinedAt)}
            </p>
            <p className="text-muted-foreground truncate text-[12px]">
              There is no session here to end.
            </p>
          </div>
          {/* The real one is a full-width pill by DEFAULT; in a compact slot it
              has to be told otherwise, or it silently becomes a 56px bar across
              the row. Here it is a ghost pill like its two neighbours, because
              three rows at one rank must not carry three shapes. */}
          <button type="button" disabled className={GHOST_PILL_BUTTON_CLASS}>
            Sign out
          </button>
        </div>
      </div>

      <p className={INFO_BOX_CLASS}>
        Nothing on this page is an account. There is no sign-in in this app, no
        password to change, and no record of you anywhere — the name above is a
        constant in a fixture file.
      </p>
    </div>
  );
}
