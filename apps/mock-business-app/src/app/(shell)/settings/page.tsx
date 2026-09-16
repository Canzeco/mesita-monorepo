"use client";

// SETTINGS — THE ONE CONFIGURATION DESTINATION (MESITA-1935).
//
// Pato: *"put accounts in setting. make it clearer. check instagram sidebar as
// reference."* This page is the "accounts in setting" half; the rail's foot is
// the "clearer" half. There used to be two rows that both meant configuration —
// Settings in the scroller and Account pinned under it — and a reader had to
// learn which one held what. Now there is one, and it is pinned.
//
// IT IS THE PERSON FIRST, THE PLACES SECOND. That order is the whole page: You
// is the only thing here that is true in every state, including a failed read,
// which is exactly why this page and not a place page holds Sign out.
//
// WHY SIGN OUT IS HERE AND NOWHERE ELSE. The rail draws its rows only in the
// `solo` and `multi` shapes; `unknown` (the read failed) and `zero` (no places
// yet) get one button and no rows. The foot is the only band that renders in
// all four, so the exit has to live behind it. A Settings that lived in the
// scroller would be a console you cannot leave the moment the places stop
// reading.
//
// ONE CARD PER SCOPE, rows divided by hairlines — not a card per row. Three
// bordered boxes say the rows are unrelated; they are one scope, read top to
// bottom. `divide-y` needs the rows to be DIRECT children of the card, which is
// why nothing here wraps them.
//
// FULL WIDTH. The console is fluid and this page caps nothing — "one column"
// means one FULL WIDTH column, which is the max-width that has been deleted
// twice already.
import Link from "next/link";
import { Building2, LogOut, UserRound } from "lucide-react";
import { useMock } from "@/mock/MockStore";
import { placePageHref } from "@/lib/console-routes";
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/shared/Badges";
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

export default function SettingsPage() {
  const { viewer, world } = useMock();

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-[12px]">
          You, and the places you can change.
        </p>
      </header>

      <section className="flex flex-col gap-2">
        <p className={TINY_LABEL_CLASS}>You</p>
        <div className={SCOPE_CARD_CLASS}>
          <div className={SCOPE_ROW_CLASS}>
            <span
              aria-hidden
              className={cn(
                SCOPE_CHIP_CLASS,
                "bg-foreground text-background flex items-center justify-center",
              )}
            >
              <UserRound className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className={TINY_LABEL_CLASS}>Name</p>
              <p className="font-display truncate text-lg font-semibold tracking-tight">
                {viewer.name}
              </p>
              <p className="text-muted-foreground truncate text-[12px]">{viewer.email}</p>
            </div>
            <button type="button" className={GHOST_PILL_BUTTON_CLASS}>
              Edit
            </button>
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
            {/* The real one is a full-width pill by DEFAULT; in a compact slot
                it has to be told otherwise, or it silently becomes a 56px bar
                across the row. A ghost pill like its neighbour, because two
                rows at one rank must not carry two shapes. */}
            <button type="button" disabled className={GHOST_PILL_BUTTON_CLASS}>
              Sign out
            </button>
          </div>
        </div>
      </section>

      {/* THE PLACES SECTION IS HOW `/places/<id>/settings` STAYS REACHABLE.
          Its rail row left with MESITA-1935, and a page nothing links to is a
          page only a typed address can find. Each row is a door to that ONE
          place's Team and Developers — the role gate still runs on arrival, so
          a viewer who follows a row gets the same `notFound` as a viewer who
          types the address. */}
      <section className="flex flex-col gap-2">
        <p className={TINY_LABEL_CLASS}>Places</p>
        {world.viewerError ? (
          <EmptyState
            kind="failed"
            title="Places could not be read"
            hint="Nothing has been established about what you hold. Your session above is unaffected."
          />
        ) : world.places.length === 0 ? (
          <EmptyState
            title="No places yet"
            hint="A place is what Team and Developers belong to, so there is nothing to configure until there is one."
          />
        ) : (
          <div className={SCOPE_CARD_CLASS}>
            {world.places.map((place) => (
              <Link
                key={place.id}
                href={placePageHref(place.id, "settings")}
                className={cn(SCOPE_ROW_CLASS, "hover:bg-muted transition")}
              >
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
                  <p className={TINY_LABEL_CLASS}>Team and developers</p>
                  <p className="font-display truncate text-lg font-semibold tracking-tight">
                    {place.name}
                  </p>
                </div>
                <Badge tone={place.myRole === "owner" ? "gold" : "neutral"}>
                  {place.myRole}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </section>

      <p className={INFO_BOX_CLASS}>
        Nothing on this page is an account. There is no sign-in in this app, no
        password to change, and no record of you anywhere — the name above is a
        constant in a fixture file.
      </p>
    </div>
  );
}
