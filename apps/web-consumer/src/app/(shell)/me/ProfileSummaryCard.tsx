"use client";

import Image from "next/image";
import { Instagram, Lock, Unlock, UserRound, Users } from "lucide-react";
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

// ─── The Passport (MESITA-1079 v2 · -1619 · -1622 · -1633 · -1636 · -1640) ──
//
// A DOCUMENT WITH FOUR DOORS (decision: Pato, MESITA-1640, from a wireframe).
// Anatomy, top to bottom:
//
//   band        the class metal, 6px, colour-only
//   header      PASSPORT · the privacy state
//   identity    photo ringed in the metal · name · age·sex·country
//   doors       Profile · Friends / Class · Instagram
//
// THIS REVERSES MESITA-1636 ON PURPOSE. That issue made the card one button
// with nothing clickable inside it and moved the three doors into the sheet.
// The wireframe puts them back on the card, and Pato accepted the reversal
// explicitly. What did NOT survive the round trip is the identity: the
// drawing had four labelled boxes and no photo, and a passport that does not
// print who you are is a folder named Passport. So the identity block stays
// and the doors sit under it.
//
// THE IDENTITY BLOCK IS THE SHEET'S DOOR. It is one button; the four cells
// below are four more. Nothing is nested — they are siblings in a flex
// column, so no press is swallowed and no button lands inside another.
//
// EVERY DOOR HERE IS THE ONLY ONE. `PassportModal`'s Profile/Class/Instagram
// rows were added in MESITA-1636 only because the card could not hold doors;
// the card holds them again, so those rows are gone — Wallet's precedent
// (MESITA-1609), "removed, not demoted". Two of these are the only entrance
// to something anywhere in the app: Instagram is the only reach door, and the
// Class ladder carries "Join with Invitation", which Docs › Passport §C calls
// the ONLY entrance for a 10-digit invite PIN. Before making any cell here
// inert, give its surface another way in FIRST.
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
 * One door in the passport's 2×2. Same anatomy as a `DestTile` — label over
 * value, glyph in the corner — but filled rather than bordered, because a
 * bordered cell inside a bordered card reads as two frames.
 */
function DoorCell({
  label,
  icon,
  value,
  fill,
  onClick,
  soon = false,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  /** Carries its own ink — three of the four metals are LIGHT fills and white
   *  measures under 2:1 on them (MESITA-1142), so a cell never assumes it. */
  fill: string;
  onClick?: () => void;
  /** Parked: visible, inert, honest. The same contract `DestTile` carries. */
  soon?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={soon ? undefined : onClick}
      disabled={soon}
      aria-disabled={soon}
      title={soon ? "Coming soon" : undefined}
      className={cn(
        "shadow-rest flex min-h-[84px] min-w-0 flex-col justify-between rounded-2xl p-3 text-left transition",
        fill,
        soon ? "opacity-60" : "active:scale-[0.98]",
      )}
    >
      {icon}
      <span className="min-w-0">
        <span className="type-meta block truncate font-bold tracking-[0.1em] uppercase opacity-70">
          {label}
        </span>
        {soon ? (
          <span className="type-meta mt-1 inline-block rounded-full border border-current/30 px-1.5 py-0.5 font-semibold tracking-[0.12em] uppercase opacity-70">
            Soon
          </span>
        ) : (
          <span className="mt-px block truncate text-sm font-bold tracking-tight">
            {value}
          </span>
        )}
      </span>
    </button>
  );
}

export function ProfileSummaryCard({
  profile,
  loading,
  onOpenPassport,
  onOpenProfile,
  onOpenInstagram,
  onOpenClass,
}: {
  profile: ConsumerProfile | null;
  loading: boolean;
  onOpenPassport: () => void;
  /** The three live doors. Each is the ONLY way to its surface — see the
   *  note at the top of this file before making one inert. */
  onOpenProfile: () => void;
  onOpenInstagram: () => void;
  onOpenClass: () => void;
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
        {/* The skeleton mirrors the DESTINATION (Docs › Design §D): 69px is
            the real avatar (60 + the 2.5px ring + the 2px inset, both sides),
            25px the real name, 16px the real meta line, and the grid below is
            the real 2×2 at its real 84px. */}
        <div className="flex flex-col gap-6 px-6 py-10">
          <div className="flex items-center justify-between gap-3">
            <div className="bg-muted h-3 w-[70px] animate-pulse rounded" />
            <div className="bg-muted h-3 w-14 animate-pulse rounded" />
          </div>
          <div className="flex items-center gap-4">
            <div className="bg-muted h-[69px] w-[69px] animate-pulse rounded-full" />
            <div className="flex flex-col gap-1.5">
              <div className="bg-muted h-[25px] w-40 animate-pulse rounded" />
              <div className="bg-muted h-4 w-44 animate-pulse rounded" />
            </div>
          </div>
          <div className="grid grid-cols-2 items-stretch gap-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="bg-muted h-[84px] animate-pulse rounded-2xl"
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
          cell below states the same rung in words. */}
      <div className={cn("h-1.5 w-full", classFillClass(key))} aria-hidden />

      {/* 2x THE VERTICAL MARGIN (Pato, MESITA-1640: "must be 2xplus margin
          height"). py-10 is exactly twice the p-5 this card carried; the
          horizontal stays at 24 so the two door columns keep their width. */}
      <div className="flex flex-col gap-6 px-6 py-10">
        {/* THE CARD SAYS ITS OWN NAME (MESITA-1638). Every other cell on Me
            is labelled top-left, and this was the one thing on the page that
            never said what it opens. */}
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

        {/* The identity block, and the sheet's only door. A SIBLING of the
            grid below, never its parent — a button inside a button is invalid
            HTML and swallows the inner press. */}
        <button
          type="button"
          onClick={onOpenPassport}
          aria-label="Open your passport"
          className="flex min-w-0 items-center gap-4 text-left transition active:scale-[0.99]"
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
            <span className="text-muted-foreground block truncate text-xs">
              {detailLine}
            </span>
          </span>
        </button>

        <div className="grid grid-cols-2 items-stretch gap-2.5">
          <DoorCell
            label="Profile"
            icon={<UserRound className="h-4 w-4 shrink-0 opacity-70" />}
            value="Edit"
            fill="bg-muted text-foreground"
            onClick={onOpenProfile}
          />
          {/* PARKED. There is no friends surface in this codebase — the
              nearest thing is a Contacts toggle in Settings ("Find friends
              already on Mesita"). Visible, inert and honest beats a cell that
              opens nothing; un-parking is a `soon` removal plus a handler. */}
          <DoorCell
            label="Friends"
            icon={<Users className="h-4 w-4 shrink-0 opacity-70" />}
            value=""
            fill="bg-muted text-foreground"
            soon
          />
          <DoorCell
            label="Class"
            icon={<ClassIcon className="h-4 w-4 shrink-0 opacity-70" />}
            value={classLabel}
            fill={classBadgeClass(key)}
            onClick={onOpenClass}
          />
          <DoorCell
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
            onClick={onOpenInstagram}
          />
        </div>
      </div>
    </section>
  );
}
