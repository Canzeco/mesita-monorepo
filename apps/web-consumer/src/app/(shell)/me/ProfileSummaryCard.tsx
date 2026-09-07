"use client";

import Image from "next/image";
import { ChevronRight, Instagram, Lock, Unlock } from "lucide-react";
import type { ConsumerProfile } from "@/lib/api/profile";
import { DefaultAvatar } from "@/components/consumer/DefaultAvatar";
import {
  CLASSES,
  CLASS_MARK_ICON,
  classBadgeClass,
  classFillClass,
  REACH_ENTRY_CLASS,
  REACH_ENTRY_FOLLOWERS,
} from "@/lib/consumer-data";
import { useConsumerClass } from "@/lib/class-context";
import { INSTAGRAM_ICON_GRADIENT_CLASS } from "@/lib/ui-classes";
import {
  ageFromBirthday,
  cn,
  formatCompactCount,
  formatSex,
  phoneCountry,
} from "@/lib/utils";

// ─── The Passport (MESITA-1079 v2 · -1619 · -1622) ─────────────────────────
//
//   identity    photo ringed in the class metal · name on its own line ·
//               age·sex·country beside the privacy state
//   two tiles   CLASS · INSTAGRAM — what you are, and the one door that
//               changes it
//   the number  a footer row that opens the passport DOCUMENT
//
// NO PLAN TILE (decision: Pato, MESITA-1619). The Passport prints what is
// EARNED and PUBLIC. Class is earned and never purchasable; the plan is what
// you PAY, and money on an identity card is the retired v1 merge coming back
// in a new shape — Docs › Passport §B: "It never prints on the Passport."
// Plan keeps its own row in the list below. Do not re-add it here; a third
// axis on this card is a product decision, not a layout one.
//
// THE NAME OWNS ITS LINE. It shared one with the privacy marker until
// MESITA-1622, which left roughly 150px for it at 375px and truncated an
// ordinary two-word Mexican name to "Patricio Can…". The marker moved down
// beside the age·sex·country line, which is short enough to share.
//
// THE UNHELD TILE HAS A BODY. `bg-card` on a `bg-card` card is not a tile, it
// is a hairline around nothing — and on the account most guests actually have
// (Bronze, no Instagram) that put a saturated metal beside a hole at exactly
// 50/50, which reads as broken rather than deliberate. Both tiles carry a
// fill; only the CLASS tile carries a metal.
//
// COLOUR ON THE INSTAGRAM TILE IS THE GLYPH, NEVER THE FILL. The tile used to
// wear `INSTAGRAM_BADGE_GRADIENT_CLASS` with `text-white`, and white measures
// 1.36:1 on that gradient's `#feda75` stop — the MESITA-1142 fill/ink failure,
// missed here for a year because Instagram is not a metal. A full-width brand
// field would also out-colour the class on a card whose one rule is that
// colour means class. The gradient now lives on a 22px glyph that carries no
// text at all.
//
// THE BAND AND THE RING ARE `aria-hidden` — they are colour-only, and the
// CLASS TILE is what states the rung in words. Anything that moves that tile
// has to keep the rung stated somewhere, or both become screen-reader
// regressions in silence.
//
// TWO SIBLING BUTTONS, NEVER A NESTED ONE. The identity zone and the number
// row both open the document; the two tiles open their own surfaces. All four
// are siblings — wrapping the card in a button to make "tap anywhere" work
// would nest the tiles inside it, which is invalid and breaks both.
//
// Country is INFERRED from the phone's dial code (`consumers` has no country
// column) and rendered with its flag — the number itself is not shown.

/**
 * One passport tile.
 *
 * THE NOTE WRAPS, IT DOES NOT TRUNCATE. It is a sentence, and a clipped
 * sentence is worse than a taller row; the grid is `items-stretch` so both
 * tiles keep equal height either way. The VALUE still truncates, because a
 * long Instagram handle has no good second line.
 */
function Tile({
  eyebrow,
  icon,
  value,
  note,
  fill,
  onClick,
}: {
  eyebrow: string;
  icon: React.ReactNode;
  value: string;
  note: string;
  /** Carries its own ink — three of the four metals are LIGHT fills and white
   *  measures under 2:1 on them (MESITA-1142), so a tile can never assume it. */
  fill: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${eyebrow}: ${value}. ${note}`}
      className={cn(
        "shadow-rest flex min-h-[88px] min-w-0 flex-col items-start rounded-2xl p-3 text-left transition active:scale-[0.98]",
        fill,
      )}
    >
      <span className="type-meta flex max-w-full items-center gap-1.5 font-bold tracking-[0.12em] uppercase opacity-85">
        {icon}
        <span className="truncate">{eyebrow}</span>
      </span>
      <span className="font-display mt-1.5 w-full truncate text-lg leading-tight font-semibold tracking-tight">
        {value}
      </span>
      <span className="type-meta mt-1 w-full leading-snug opacity-85">
        {note}
      </span>
    </button>
  );
}

export function ProfileSummaryCard({
  profile,
  loading,
  onOpenClass,
  onOpenInstagram,
  onOpenPassport,
}: {
  profile: ConsumerProfile | null;
  loading: boolean;
  onOpenClass: () => void;
  onOpenInstagram: () => void;
  onOpenPassport: () => void;
}) {
  const { key, origin, followers, handle: classHandle } = useConsumerClass();

  if (loading) {
    return (
      <section
        aria-label="Your Mesita passport"
        aria-busy="true"
        className="border-border bg-card shadow-rest w-full overflow-hidden rounded-2xl border"
      >
        <div className="bg-muted h-1.5 w-full" />
        {/* The skeleton mirrors the DESTINATION (Docs › Design §D): 69px is
            the real avatar (60 + the 2.5px ring + the 2px inset, both sides),
            25px the real name, 16px the real meta line. */}
        <div className="flex flex-col gap-5 p-5">
          <div className="flex items-center gap-4">
            <div className="bg-muted h-[69px] w-[69px] animate-pulse rounded-full" />
            <div className="flex flex-col gap-1.5">
              <div className="bg-muted h-[25px] w-40 animate-pulse rounded" />
              <div className="bg-muted h-4 w-44 animate-pulse rounded" />
            </div>
          </div>
          <div className="grid grid-cols-2 items-stretch gap-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                className="bg-muted h-[88px] animate-pulse rounded-2xl"
              />
            ))}
          </div>
        </div>
        <div className="border-border border-t px-5 py-3">
          <div className="bg-muted h-4 w-40 animate-pulse rounded" />
        </div>
      </section>
    );
  }

  const name =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    profile?.full_name ||
    "Mesita member";
  const avatarUrl = profile?.avatar_url ?? null;
  const isPublic = profile?.privacy_public ?? false;

  const age = ageFromBirthday(profile?.birthday);
  const sexLabel = formatSex(profile?.sex);
  const country = phoneCountry(profile?.phone);
  const detailLine = [
    age != null ? `${age}` : null,
    sexLabel,
    country ? `${country.flag} ${country.name}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const cls = CLASSES.find((c) => c.id === key);
  const classLabel = cls?.label ?? "Bronze";
  const ClassIcon = CLASS_MARK_ICON;

  // Prefer the context handle so the Instagram preview state wins over a
  // stale profile row.
  const handle = classHandle ?? profile?.instagram_handle ?? null;
  const igConnected = origin === "instagram" || Boolean(handle);
  const igValue = igConnected
    ? handle
      ? `@${handle}`
      : "Connected"
    : "Not connected";
  const igNote = igConnected
    ? `${formatCompactCount(followers)} followers`
    : // Derived from the ladder, never typed into copy: if the bar moves or
      // the rung is renamed, this sentence follows without an edit.
      `Connect to reach ${REACH_ENTRY_CLASS.label} at ${REACH_ENTRY_FOLLOWERS.toLocaleString()}`;

  // The EF assigns and repairs the canonical 0000-0000 form on every profile
  // read, so it is printed as it arrives — no second formatter to drift.
  const code = profile?.code ?? null;

  return (
    <section
      aria-label="Your Mesita passport"
      className="border-border bg-card shadow-rest w-full overflow-hidden rounded-2xl border"
    >
      {/* The metal band — the class is the first thing the card says. Hidden
          from assistive tech on purpose: it is colour-only, and the Class tile
          below states the same rung in words. */}
      <div className={cn("h-1.5 w-full", classFillClass(key))} aria-hidden />

      <div className="flex flex-col gap-5 p-5">
        <button
          type="button"
          onClick={onOpenPassport}
          aria-label="Open your passport"
          className="-m-1 flex min-w-0 items-center gap-4 rounded-2xl p-1 text-left transition active:scale-[0.99]"
        >
          <span
            className={cn(
              "shrink-0 rounded-full p-[2.5px]",
              classFillClass(key),
            )}
            aria-hidden
          >
            <span className="bg-card block rounded-full p-[2px]">
              <span className="bg-muted relative block h-[60px] w-[60px] overflow-hidden rounded-full">
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt=""
                    fill
                    sizes="60px"
                    className="object-cover"
                  />
                ) : (
                  <DefaultAvatar className="h-full w-full" />
                )}
              </span>
            </span>
          </span>

          <span className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="font-display block truncate text-xl leading-tight font-semibold tracking-tight">
              {name}
            </span>
            {/* The privacy state rides the short line, not the name's. State,
                not control — Settings › Privacy owns the switch. */}
            <span className="flex min-w-0 items-center justify-between gap-2">
              <span className="text-muted-foreground truncate text-xs">
                {detailLine}
              </span>
              <span className="text-muted-foreground type-meta inline-flex shrink-0 items-center gap-1 font-bold tracking-[0.12em] uppercase">
                {isPublic ? (
                  <Unlock className="h-2.5 w-2.5" />
                ) : (
                  <Lock className="h-2.5 w-2.5" />
                )}
                {isPublic ? "Public" : "Private"}
              </span>
            </span>
          </span>
        </button>

        <div className="grid grid-cols-2 items-stretch gap-2">
          <Tile
            eyebrow="Class"
            icon={<ClassIcon className="h-2.5 w-2.5 shrink-0" />}
            value={classLabel}
            // The rung's REWARD, not a slogan: "Earned, not bought" was
            // identical on every account at every rung, forever, and it is
            // what a screen reader announced as if it were state.
            note={cls?.reward ?? "Base discount"}
            fill={classBadgeClass(key)}
            onClick={onOpenClass}
          />
          <Tile
            eyebrow="Instagram"
            icon={
              <span
                className={cn(
                  INSTAGRAM_ICON_GRADIENT_CLASS,
                  "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md text-white",
                )}
                aria-hidden
              >
                <Instagram className="h-3 w-3" />
              </span>
            }
            value={igValue}
            note={igNote}
            fill="bg-muted text-foreground"
            onClick={onOpenInstagram}
          />
        </div>
      </div>

      {/* The document, one tap from the cover. `consumers.code` is the only
          fact in the product that appears on no other surface, and it is what
          support and door staff ask for when the guest has a phone and
          nothing else — it was three taps deep until MESITA-1622. */}
      <button
        type="button"
        onClick={onOpenPassport}
        aria-label={
          code ? `Passport number ${code}. Open your passport` : "Open your passport"
        }
        className="border-border hover:bg-muted/50 flex w-full items-center justify-between gap-3 border-t px-5 py-3 text-left transition"
      >
        <span className="text-muted-foreground min-w-0 truncate text-xs">
          {code ? `No. ${code}` : "Your passport"}
        </span>
        <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
      </button>
    </section>
  );
}
