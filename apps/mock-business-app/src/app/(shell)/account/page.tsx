"use client";

// ACCOUNT IS THE PERSON ALONE (MESITA-1937).
//
// IT IS THE ONLY PAGE IN THIS CONSOLE THAT IS NOT ABOUT A PLACE, and that is
// what earns it the pinned foot of the rail: every row in the scroller above it
// — Products, Profile, Customers, Activity, Settings — configures or reads the
// ONE venue the rail names. This page is you, across all of them.
//
// MESITA-1935 BRIEFLY MADE THIS A REDIRECT onto a `/settings` that meant the
// person. Pato's sketch put the two back: *"Logo / Place Explorer-Selector /
// Products / Profile / Customers / Activity / Settings / (gap) / Account."*
// Settings means the PLACE's settings again, and this page is the person again.
//
// SIGN OUT LIVES HERE AND NOWHERE ELSE, which is the constraint that decides
// which band the rail pins. `Sidebar.tsx` draws `RAIL_ROWS` only in the `solo`
// and `multi` shapes; the foot renders in all four. Putting the exit on a row
// in the scroller would be a console you cannot leave the moment the places
// stop reading.
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
            className={cn(
              SCOPE_CHIP_CLASS,
              "bg-foreground text-paper flex items-center justify-center",
            )}
          >
            <UserRound className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className={TINY_LABEL_CLASS}>You</p>
            <p className="font-display truncate text-lg font-semibold tracking-tight">
              {viewer.name}
            </p>
            <p className="text-muted-foreground truncate text-[12px]">{viewer.email}</p>
          </div>
          <button type="button" className={GHOST_PILL_BUTTON_CLASS}>
            Edit
          </button>
        </div>

        {/* THE PORTFOLIO AS A COUNT, NOT A LIST OF DOORS. Each place's own
            Settings is reached from the rail now that Settings is a row again,
            so this row states what you hold and hands off to the catalogue —
            the surface that has done the switching since MESITA-1918. */}
        <div className={SCOPE_ROW_CLASS}>
          <span
            aria-hidden
            className={cn(
              SCOPE_CHIP_CLASS,
              "bg-muted text-muted-foreground flex items-center justify-center",
            )}
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
            className={cn(
              SCOPE_CHIP_CLASS,
              "bg-muted text-muted-foreground flex items-center justify-center",
            )}
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
