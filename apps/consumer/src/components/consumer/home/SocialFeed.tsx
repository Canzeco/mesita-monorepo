"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Crown, Instagram } from "lucide-react";
import type { Place } from "@/lib/api/places";
import { cn, firstInitial } from "@/lib/utils";
import { placeHref } from "@/lib/place-route";
import {
  SOCIAL_ACTION_META,
  SOCIAL_PEOPLE,
  type SocialPerson,
} from "./social-feed-data";
import { SocialProfileModal } from "./SocialProfileModal";

// Social mode — the live activity feed. Each row splits into two tap
// targets: the person (opens the profile modal) and the place chip on the
// right (navigates to the place detail). Rows resolve their place against
// the REAL deck passed down from the server fetch; when the catalog is
// empty the chip degrades to an inert mock name so the feed still reads.
//
// TODO(EF): social feed — people + events are mock (see social-feed-data.ts).

export function SocialFeed({ places }: { places: Place[] }) {
  const [profile, setProfile] = useState<SocialPerson | null>(null);

  return (
    <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto">
      <div className="px-4 pt-4 pb-6">
        <div className="mb-3 flex items-center justify-between px-1">
          <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            Activity
          </p>
          <span className="text-primary flex items-center gap-1.5 text-[10px] font-semibold">
            <span className="relative flex h-2 w-2">
              <span className="bg-primary absolute inset-0 animate-ping rounded-full opacity-75" />
              <span className="bg-primary relative h-2 w-2 rounded-full" />
            </span>
            Live
          </span>
        </div>

        <div className="flex flex-col gap-2">
          {SOCIAL_PEOPLE.map((p) => {
            const place =
              places.length > 0 ? places[p.placeSlot % places.length] : null;
            const meta = SOCIAL_ACTION_META[p.action];
            return (
              <div
                key={p.id}
                className="border-border bg-card flex w-full items-center gap-2 rounded-2xl border p-2.5"
              >
                {/* Person → profile modal */}
                <button
                  type="button"
                  onClick={() => setProfile(p)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left transition active:scale-[0.99]"
                >
                  <div className="relative shrink-0">
                    <Image
                      src={p.avatarUrl}
                      alt={p.name}
                      width={44}
                      height={44}
                      className="h-11 w-11 rounded-full object-cover"
                    />
                    {p.plan === "premium" && (
                      <span className="bg-tier-premium ring-background absolute -bottom-0.5 -left-0.5 grid h-4 w-4 place-items-center rounded-full text-white ring-2">
                        <Crown className="h-2.5 w-2.5 fill-current" />
                      </span>
                    )}
                    <span className="ring-background absolute -right-0.5 -bottom-0.5 grid h-4 w-4 place-items-center rounded-full bg-gradient-to-br from-[#feda75] via-[#d62976] to-[#4f5bd5] text-white ring-2">
                      <Instagram className="h-2.5 w-2.5" />
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-foreground truncate text-sm leading-tight font-semibold">
                        {p.name}
                      </p>
                      <span
                        className={cn(
                          "inline-flex h-5 shrink-0 items-center gap-0.5 rounded-full px-1.5 text-[10px] font-semibold",
                          meta.bg,
                          meta.color,
                        )}
                      >
                        <meta.Icon className="h-2.5 w-2.5" />
                        {meta.label}
                      </span>
                    </div>
                    <p className="text-muted-foreground truncate text-[11px]">
                      {p.igHandle} · {p.time}
                    </p>
                  </div>
                </button>

                {/* Place → detail (real place when the deck has one) */}
                {place ? (
                  <Link
                    href={placeHref(place.slug || place.id)}
                    className="border-border bg-background/80 flex shrink-0 items-center gap-2 rounded-xl border p-1.5 pr-2 transition hover:shadow-sm active:scale-[0.99]"
                  >
                    <PlaceThumb name={place.name} photo={place.photos[0]} />
                    <span className="text-foreground max-w-[80px] truncate text-[11px] font-semibold">
                      {place.name}
                    </span>
                  </Link>
                ) : (
                  <div className="border-border bg-muted/40 flex shrink-0 items-center gap-2 rounded-xl border p-1.5 pr-2">
                    <PlaceThumb name={p.fallbackPlaceName} />
                    <span className="text-muted-foreground max-w-[80px] truncate text-[11px] font-semibold">
                      {p.fallbackPlaceName}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <SocialProfileModal person={profile} onClose={() => setProfile(null)} />
    </div>
  );
}

function PlaceThumb({ name, photo }: { name: string; photo?: string }) {
  if (photo) {
    return (
      <Image
        src={photo}
        alt={name}
        width={36}
        height={36}
        className="h-9 w-9 rounded-lg object-cover"
      />
    );
  }
  return (
    <div className="bg-pink-gradient grid h-9 w-9 place-items-center rounded-lg text-white/85">
      <span className="font-display text-sm font-bold">
        {firstInitial(name)}
      </span>
    </div>
  );
}
