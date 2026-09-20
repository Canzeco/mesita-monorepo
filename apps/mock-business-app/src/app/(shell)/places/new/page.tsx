"use client";

// ADD PLACE IS A SEARCH, not a form.
//
// A venue that already exists in Mesita must not be created twice, and an
// operator cannot be expected to know whether it does. So the ceremony starts
// by looking: you type the name, and every row states WHAT IT IS and what you
// may do about it —
//
//   in the pool, claimable    → Claim
//   in the pool, unverified   → nothing yet, and the row says why
//   already yours             → Open; there is nothing to add
//   nowhere                   → Add it as new, the last resort and not the first
//
// A PERSON MAY HOLD SEVERAL PLACES and nothing caps the count.
import { useState } from "react";
import { PageHeader } from "@/components/console/PageHeader";
import Link from "next/link";
import { Search } from "lucide-react";
import { useMock } from "@/mock/MockStore";
import { Section } from "@/components/shared/Section";
import { Badge } from "@/components/shared/Badges";
import { placeRootHref } from "@/lib/console-routes";
import {
  CTA_BUTTON_CLASS,
  GHOST_PILL_BUTTON_CLASS,
  INFO_BOX_CLASS,
  INPUT_CLASS,
} from "@/lib/ui-classes";

export default function AddPlacePage() {
  const { world } = useMock();
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();

  const mine = query
    ? world.places.filter((p) => p.name.toLowerCase().includes(query))
    : [];
  const pool = query
    ? world.poolPlaces.filter((p) => p.name.toLowerCase().includes(query))
    : [];
  const nothing = query.length > 1 && mine.length === 0 && pool.length === 0;

  return (
    <div className="flex flex-col gap-4">
      {/* THE SHARED HEADER (MESITA-2008), down from `text-2xl` with the
          portfolio it is reached from. */}
      <PageHeader
        title="Add your place"
        blurb="Look for it first. Most places are already here."
      />

      <Section title="Find it" description="Type the name as guests would write it.">
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" aria-hidden />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Lumbre, Pardo, Tostador…"
            aria-label="Search for a place"
            className={`${INPUT_CLASS} pl-9`}
          />
        </div>

        {query.length > 0 && query.length < 2 && (
          <p className="text-muted-foreground text-[12px]">Keep typing.</p>
        )}

        {mine.length > 0 && (
          <ul className="flex flex-col gap-2">
            {mine.map((p) => (
              <li key={p.id} className="border-border flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="text-muted-foreground truncate text-[11px]">{p.category} · {p.city}</p>
                </div>
                <Badge tone="on">Already yours</Badge>
                <Link href={placeRootHref(p.id)} className={GHOST_PILL_BUTTON_CLASS}>
                  Open
                </Link>
              </li>
            ))}
          </ul>
        )}

        {pool.length > 0 && (
          <ul className="flex flex-col gap-2">
            {pool.map((p) => (
              <li key={p.id} className="border-border flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="text-muted-foreground truncate text-[11px]">{p.category} · {p.city}</p>
                </div>
                {p.verified ? <Badge tone="on">Verified</Badge> : <Badge tone="off">Unverified</Badge>}
                {p.claimable ? (
                  <button type="button" className={GHOST_PILL_BUTTON_CLASS}>Claim</button>
                ) : (
                  <span className="text-muted-foreground text-[12px]">
                    Mesita has not verified this one yet
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        {nothing && (
          <div className="border-border flex flex-col items-start gap-2 rounded-xl border border-dashed px-4 py-4">
            <p className="text-sm font-semibold">Nothing matches “{q}”</p>
            <p className="text-muted-foreground text-[12px] leading-snug">
              Adding it as new is the last resort, not the first: a duplicate
              splits a venue&rsquo;s reviews and its guests across two records, and
              merging them afterwards is somebody&rsquo;s afternoon.
            </p>
            <button type="button" className={CTA_BUTTON_CLASS}>
              Add “{q}” as a new place
            </button>
          </div>
        )}

        {query.length === 0 && (
          <p className={INFO_BOX_CLASS}>
            Nothing is searched until you type. This console does not list every
            venue in the city and ask you to scroll.
          </p>
        )}
      </Section>
    </div>
  );
}
