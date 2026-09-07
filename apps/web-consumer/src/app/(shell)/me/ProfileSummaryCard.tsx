"use client";

import Image from "next/image";
import { Instagram, Lock, Unlock } from "lucide-react";
import type { ConsumerProfile } from "@/lib/api/profile";
import { DefaultAvatar } from "@/components/consumer/DefaultAvatar";
import {
  CLASSES,
  CLASS_MARK_ICON,
  classBadgeClass,
  classFillClass,
} from "@/lib/consumer-data";
import { useConsumerClass } from "@/lib/class-context";
import { INSTAGRAM_ICON_GRADIENT_CLASS } from "@/lib/ui-classes";
import { ageFromBirthday, cn, formatSex, phoneCountry } from "@/lib/utils";

// ─── The Passport (MESITA-1079 v2 · -1619 · -1633 · -1636 · -1640 · -1646) ──
//
// JUST VISIBLE (decision: Pato, MESITA-1646). This card DISPLAYS and does
// nothing else. It holds no doors, and it is not itself a button. Anatomy:
//
//   band        the class metal, 6px, colour-only
//   header      PASSPORT · the privacy state
//   identity    photo ringed in the metal · name · age·sex·country
//   axes        Instagram | Class, display boxes
//
// WHY THIS IS THE THIRD SHAPE AND MEANT TO BE THE LAST. MESITA-1636 made the
// card display-only and put its doors in the sheet; MESITA-1640 put them back
// on the card; this removes them again. Each round was the same argument —
// the card was being asked to be a document AND a control panel at once. It
// is a document now, and NAVIGATION LIVES IN THE GRID: `Profile` and
// `Passport` are the first pair of cells on Me, and the `Passport` cell is
// what opens the sheet. Neither surface has to be both any more.
//
// THE DOORS MOVED, THEY DID NOT DISAPPEAR. Profile is a grid cell.
// Instagram and Class are tappable rows in `PassportModal`. Two of those are
// the only entrance to something anywhere in the app: Instagram is the only
// reach door, and the Class ladder carries "Join with Invitation", which
// Docs › Passport §C calls the ONLY entrance for a 10-digit invite PIN.
// Making this card inert without rehoming them would have stranded invite
// redemption outright — silently, with every test green. Check those three
// have a door before moving one.
//
// NO PLAN (decision: Pato, MESITA-1619). The Passport prints what is EARNED
// and PUBLIC. Class is earned and never purchasable; the plan is what you PAY
// — Docs › Passport §B: "It never prints on the Passport." Plan is a cell in
// the grid below.
//
// ONLY CLASS WEARS METAL. Four filled cells would make the card a colour
// block and undo the one rule this page has (Docs › Design §D: colour means
// class). The Instagram brand gradient is confined to a 16px glyph, because
// white on that gradient's #feda75 stop measures 1.36:1 — the MESITA-1142
// fill/ink failure, missed for a year here because Instagram is not a metal.
//
// THE BAND AND THE RING ARE `aria-hidden` — they are colour-only, and the
// Class cell states the rung in words. Anything that moves that cell has to
// keep the rung stated somewhere.
//
// Country is INFERRED from the phone's dial code (`consumers` has no country
// column) and rendered with its flag — the number itself is not shown.

/**
 * One display box. A `<span>`, never a button — this card has no tap targets
 * at all (MESITA-1646), so a control here would be the first and would put
 * the card straight back into the document-or-panel argument it just left.
 */
function InfoBox({
  label,
  icon,
  value,
  fill,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  /** Carries its own ink — three of the four metals are LIGHT fills and white
   *  measures under 2:1 on them (MESITA-1142), so a box never assumes it. */
  fill: string;
}) {
  return (
    <span
      className={cn(
        "shadow-rest flex min-h-[72px] min-w-0 flex-col justify-between rounded-2xl p-2.5",
        fill,
      )}
    >
      {icon}
      <span className="min-w-0">
        <span className="type-meta block truncate font-bold tracking-[0.1em] uppercase opacity-70">
          {label}
        </span>
        <span className="mt-px block truncate text-sm font-bold tracking-tight">
          {value}
        </span>
      </span>
    </span>
  );
}

export function ProfileSummaryCard({
  profile,
  loading,
}: {
  profile: ConsumerProfile | null;
  loading: boolean;
}) {
  const { key, origin, handle: classHandle } = useConsumerClass();

  if (loading) {
    return (
      <section
        aria-label="Your Mesita passport"
        aria-busy="true"
        className="border-border bg-card shadow-rest w-full overflow-hidden rounded-2xl border"
      >
        <div className="bg-muted h-1.5 w-full" />
        {/* The skeleton mirrors the DESTINATION (Docs › Design §D): 61px is
            the real avatar (52 + the 2.5px ring + the 2px inset, both sides),
            25px the real name, 16px the real meta line, and the grid below is
            the real boxes at their real 72px. */}
        <div className="flex flex-col gap-4 px-6 py-6">
          <div className="flex items-center justify-between gap-3">
            <div className="bg-muted h-3 w-[70px] animate-pulse rounded" />
            <div className="bg-muted h-3 w-14 animate-pulse rounded" />
          </div>
          <div className="flex items-center gap-3.5">
            <div className="bg-muted h-[61px] w-[61px] animate-pulse rounded-full" />
            <div className="flex flex-col gap-1.5">
              <div className="bg-muted h-[25px] w-40 animate-pulse rounded" />
              <div className="bg-muted h-4 w-44 animate-pulse rounded" />
            </div>
          </div>
          <div className="grid grid-cols-2 items-stretch gap-2.5">
            {Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                className="bg-muted h-[72px] animate-pulse rounded-2xl"
              />
            ))}
          </div>
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
    : "Connect";

  return (
    <section
      aria-label="Your Mesita passport"
      className="border-border bg-card shadow-rest w-full overflow-hidden rounded-2xl border"
    >
      {/* The metal band — the class is the first thing the card says. Hidden
          from assistive tech on purpose: it is colour-only, and the Class
          box below states the same rung in words. */}
      <div className={cn("h-1.5 w-full", classFillClass(key))} aria-hidden />

      {/* SMALLER (Pato, MESITA-1649). MESITA-1640 set py-10 on "2xplus margin
          height" while the card still carried four doors; MESITA-1646 took
          every door out and left three elements inside 40px of padding.
          Measured: 303px → 235px, against a 92px grid cell, so the card is
          2.5x a cell rather than 3.3x — still the page's hero object, no
          longer a field of padding. px-6 is UNCHANGED: it is what gives the
          axis boxes their width, and @patocanz needs 75px of the 122 it
          gets. Re-measure before touching the horizontal. */}
      <div className="flex flex-col gap-4 px-6 py-6">
        {/* THE CARD SAYS ITS OWN NAME (MESITA-1638). Every other cell on Me
            is labelled top-left, and a card that names nothing is just a
            photo. It says what it IS — it no longer opens anything. */}
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground type-meta font-bold tracking-[0.12em] uppercase">
            Passport
          </span>
          {/* State, not control — Settings › Privacy owns the switch. */}
          <span className="text-muted-foreground type-meta inline-flex shrink-0 items-center gap-1 font-bold tracking-[0.12em] uppercase">
            {isPublic ? (
              <Unlock className="h-2.5 w-2.5" />
            ) : (
              <Lock className="h-2.5 w-2.5" />
            )}
            {isPublic ? "Public" : "Private"}
          </span>
        </div>

        {/* Identity. Not a button — the `Passport` cell in the grid below is
            what opens the document now (MESITA-1646). */}
        <div className="flex min-w-0 items-center gap-3.5">
          <span
            className={cn(
              "shrink-0 rounded-full p-[2.5px]",
              classFillClass(key),
            )}
            aria-hidden
          >
            <span className="bg-card block rounded-full p-[2px]">
              <span className="bg-muted relative block h-[52px] w-[52px] overflow-hidden rounded-full">
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt=""
                    fill
                    sizes="52px"
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
            <span className="text-muted-foreground block truncate text-xs">
              {detailLine}
            </span>
          </span>
        </div>

        <div className="grid grid-cols-2 items-stretch gap-2.5">
          <InfoBox
            label="Instagram"
            icon={
              <span
                className={cn(
                  INSTAGRAM_ICON_GRADIENT_CLASS,
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] text-white",
                )}
                aria-hidden
              >
                <Instagram className="h-2.5 w-2.5" />
              </span>
            }
            value={igValue}
            fill="bg-muted text-foreground"
          />
          <InfoBox
            label="Class"
            icon={<ClassIcon className="h-4 w-4 shrink-0 opacity-70" />}
            value={classLabel}
            fill={classBadgeClass(key)}
          />
        </div>
      </div>
    </section>
  );
}
