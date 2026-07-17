"use client";

import Image from "next/image";
import Link from "next/link";
import { Crown, Instagram } from "lucide-react";
import type { Place } from "@/lib/api/places";
import { INSTAGRAM_BADGE_GRADIENT_CLASS } from "@/lib/ui-classes";
import { cn, firstInitial } from "@/lib/utils";
import { placeHref } from "@/lib/place-route";
import {
  SOCIAL_ACTION_META,
  type SocialPerson,
} from "./social-feed-data";

// One activity feed row: person (profile modal) + place chip (detail nav).
// Place resolves against the live deck when available; otherwise the chip
// degrades to an inert mock name so the feed still reads.
export function SocialActivityRow({
  person,
  place,
  onPersonClick,
}: {
  person: SocialPerson;
  place: Place | null;
  onPersonClick: (person: SocialPerson) => void;
}) {
  const meta = SOCIAL_ACTION_META[person.action];
  return (
    <div className="border-border bg-card flex w-full items-center gap-2 rounded-2xl border p-2.5">
      {/* Person → profile modal */}
      <button
        type="button"
        onClick={() => onPersonClick(person)}
        className="flex min-w-0 flex-1 items-center gap-3 text-left transition active:scale-[0.99]"
      >
        <div className="relative shrink-0">
          <Image
            src={person.avatarUrl}
            alt={person.name}
            width={44}
            height={44}
            className="h-11 w-11 rounded-full object-cover"
          />
          {person.plan === "premium" && (
            <span className="bg-tier-premium ring-background absolute -bottom-0.5 -left-0.5 grid h-4 w-4 place-items-center rounded-full text-white ring-2">
              <Crown className="h-2.5 w-2.5 fill-current" />
            </span>
          )}
          <span
            className={cn(
              "ring-background absolute -right-0.5 -bottom-0.5 grid h-4 w-4 place-items-center rounded-full text-white ring-2",
              INSTAGRAM_BADGE_GRADIENT_CLASS,
            )}
          >
            <Instagram className="h-2.5 w-2.5" />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-foreground truncate text-sm leading-tight font-semibold">
              {person.name}
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
            {person.igHandle} · {person.time}
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
          <PlaceThumb name={person.fallbackPlaceName} />
          <span className="text-muted-foreground max-w-[80px] truncate text-[11px] font-semibold">
            {person.fallbackPlaceName}
          </span>
        </div>
      )}
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
