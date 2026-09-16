"use client";

// THE CATALOGUE — the caller's places and the pool, in one matrix.
//
// It is the one screen whose job is to say what it could and could not read,
// which is why a failed read lands here rather than on a place: there is no
// place a failed read can name, and this table can print the failure as a row
// of dashes instead of a row of zeroes.
//
// THE IDENTITY COLUMN IS PINNED and its background is OPAQUE — a sticky cell
// slides OVER its neighbours, so a translucent tint lets them read through it.
// The header pins to ITS OWN scrollport with no `top-[…]` offset, because
// `position: sticky` resolves `top` against the nearest scrolling ancestor and
// this header's is the card, not the page.
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { useMock } from "@/mock/MockStore";
import { Section } from "@/components/shared/Section";
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/shared/Badges";
import { PlaceChip } from "@/components/console/PlaceChip";
import {
  STATES_COL_CELL,
  STATES_COL_HEAD,
  STATES_HEAD_BG,
  STATES_HEAD_STICKY,
  CTA_BUTTON_CLASS,
  GHOST_PILL_BUTTON_CLASS,
} from "@/lib/ui-classes";
import {
  SHELL_ROUTES,
  ownedFromParam,
  placeRootHref,
  placesHref,
} from "@/lib/console-routes";
import { placeTabHref } from "@/lib/place-tabs";
import { cn } from "@/lib/utils";

const STATE_COLUMNS = [
  ["Verified", (p: { verified: boolean }) => p.verified],
  ["Partner", (p: { partnered: boolean }) => p.partnered],
  ["Promoting", (p: { promoting: boolean }) => p.promoting],
  ["Pickup", (p: { pickupOrders: boolean }) => p.pickupOrders],
  ["Delivery", (p: { deliveryOrders: boolean }) => p.deliveryOrders],
  ["Reservations", (p: { reservations: boolean }) => p.reservations],
  ["Rewards", (p: { visitRewards: boolean }) => p.visitRewards],
  ["Credits", (p: { credits: boolean }) => p.credits],
] as const;

function Cell({ on }: { on: boolean }) {
  return on ? (
    <>
      <Check className="text-foreground mx-auto h-4 w-4" aria-hidden />
      <span className="sr-only">yes</span>
    </>
  ) : (
    <>
      <Minus className="text-muted-foreground/50 mx-auto h-4 w-4" aria-hidden />
      <span className="sr-only">no</span>
    </>
  );
}

export default function PlacesPage() {
  const search = useSearchParams();
  const owned = ownedFromParam(search.get("owned")) ?? "mine";
  const { world, hydrated } = useMock();

  if (!hydrated) {
    return <p className="text-muted-foreground text-sm" role="status">Reading…</p>;
  }

  // THE FAILED READ IS NOT AN EMPTY LIST, and this is the screen where telling
  // them apart matters most: "you hold no places" on the morning the API is
  // down is a sentence a restaurant will act on.
  if (world.viewerError) {
    return (
      <Section title="Places" description="Your places, and the ones Mesita knows about.">
        <EmptyState
          kind="failed"
          title="Could not read your places"
          hint="Nothing has been established about what you hold — only that we could not ask. Nothing has been created or removed."
        />
      </Section>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Places</h1>
          <p className="text-muted-foreground text-[12px]">
            Yours, and the ones nobody holds yet.
          </p>
        </div>
        <div className="flex gap-1.5">
          <Link
            href={placesHref("mine")}
            aria-current={owned === "mine" ? "page" : undefined}
            className={cn(
              GHOST_PILL_BUTTON_CLASS,
              owned === "mine" && "border-foreground text-foreground",
            )}
          >
            Mine
          </Link>
          <Link
            href={placesHref("public")}
            aria-current={owned === "public" ? "page" : undefined}
            className={cn(
              GHOST_PILL_BUTTON_CLASS,
              owned === "public" && "border-foreground text-foreground",
            )}
          >
            Public
          </Link>
          <Link href={SHELL_ROUTES.placesNew} className={CTA_BUTTON_CLASS}>
            Add your place
          </Link>
        </div>
      </header>

      {owned === "mine" ? (
        world.places.length === 0 ? (
          // THE DOOR COMES BEFORE THE FILTER. An empty list with a filter row
          // above it and no way out reads as a console that is broken rather
          // than as an account that has not started.
          <EmptyState
            title="You hold no places yet"
            hint="Add yours and the rail fills in: eight products, all of them about that one venue."
            action={null}
          />
        ) : (
          <Section title="Your places" description="One row each, and every state this console can switch.">
            {/* The card keeps its padding; the TABLE scrolls inside it. The
                gutter/bleed pair is for a child that must reach the window's
                edge, and cancelling the card's own inset for a table that
                already has a border leaves the heading hanging off the left
                edge of everything above it. */}
            <div className="border-border overflow-x-auto rounded-xl border">
              <table className="w-full min-w-[1040px] border-collapse text-sm">
                <thead className={cn(STATES_HEAD_STICKY, STATES_HEAD_BG)}>
                  <tr>
                    <th scope="col" className={cn(STATES_COL_HEAD, "border-border border-b px-3 py-2 text-left text-[11px] font-semibold tracking-wide uppercase")}>
                      Place
                    </th>
                    {STATE_COLUMNS.map(([label]) => (
                      <th
                        key={label}
                        scope="col"
                        className="text-muted-foreground border-border border-b px-3 py-2 text-center text-[11px] font-semibold tracking-wide uppercase"
                      >
                        {label}
                      </th>
                    ))}
                    <th scope="col" className="border-border border-b px-3 py-2 text-right text-[11px] font-semibold tracking-wide uppercase">
                      Open
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {world.places.map((p) => (
                    <tr key={p.id} className="border-border hover:bg-muted/40 border-b last:border-0">
                      <td className={cn(STATES_COL_CELL, "px-3 py-2.5")}>
                        <span className="flex min-w-0 items-center gap-2">
                          <PlaceChip photoUrl={p.photoUrl} />
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{p.name}</span>
                            <span className="text-muted-foreground block truncate text-[11px]">
                              {p.category} · {p.city} · {p.myRole}
                            </span>
                          </span>
                        </span>
                      </td>
                      {STATE_COLUMNS.map(([label, read]) => (
                        <td key={label} className="px-3 py-2.5 text-center">
                          <Cell on={read(p)} />
                        </td>
                      ))}
                      <td className="px-3 py-2.5 text-right">
                        {/* A place you HOLD opens on its Home. The pool row
                            below keeps Profile, and the difference is the
                            point: nothing has been claimed there, so there is
                            no Home to open — `tabsForAccess({held:false})` is
                            Profile alone, and Home would 404. */}
                        <Link href={placeRootHref(p.id)} className={GHOST_PILL_BUTTON_CLASS}>
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )
      ) : (
        <Section
          title="Public places"
          description="Mesita knows these are real and nobody holds them. Claiming one mints your owner row — there is no membership to hold first."
        >
          <ul className="flex flex-col gap-2">
            {world.poolPlaces.map((p) => (
              <li key={p.id} className="border-border flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="text-muted-foreground truncate text-[11px]">
                    {p.category} · {p.city}
                  </p>
                </div>
                {p.verified ? <Badge tone="on">Verified</Badge> : <Badge tone="off">Unverified</Badge>}
                <Link href={placeTabHref(p.id, "profile")} className={GHOST_PILL_BUTTON_CLASS}>
                  Open
                </Link>
                {/* EACH ROW STATES ITS STATE AND ITS VERB. An unverified place
                    cannot be claimed yet, and the row says so rather than
                    offering a button that answers 409. */}
                {p.claimable ? (
                  <button type="button" className={GHOST_PILL_BUTTON_CLASS}>Claim</button>
                ) : (
                  <span className="text-muted-foreground text-[12px]">Not claimable yet</span>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
