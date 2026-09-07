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

// ─── The Passport (MESITA-1079 v2 · -1619 · -1622 · -1633 · -1636) ────────
//
// ONE BOX. NOTHING INSIDE IT IS CLICKABLE (decision: Pato, MESITA-1636). The
// card DISPLAYS an identity — photo, name, age·sex·country, privacy, the
// Instagram handle and the class — and the whole card is a single button onto
// the passport document, where the actions live. Tap the box, then stuff
// shows.
//
// THE DOORS DID NOT DISAPPEAR, THEY MOVED INTO THE SHEET, and that is the part
// to protect. Three surfaces used to be reachable only from sub-cells here:
// Profile (edit), Instagram (the connect flow — the ONLY reach door) and Class
// (whose ladder carries "Join with Invitation", which Docs › Passport §C calls
// the ONLY entrance for a 10-digit invite PIN). Making the card one button
// without rehoming them would have stranded invite redemption outright. They
// are tappable rows in `PassportModal` now. If this card ever grows an
// interactive child again, check those three still have a door before you
// move one.
//
// NO PLAN (decision: Pato, MESITA-1619). The Passport prints what is EARNED
// and PUBLIC. Class is earned and never purchasable; the plan is what you PAY
// — Docs › Passport §B: "It never prints on the Passport." Plan is a cell in
// the grid below.
//
// ONLY CLASS WEARS METAL. Two filled boxes would make the card a colour block
// and undo the one rule this page has (Docs › Design §D: colour means class).
// The Instagram brand gradient is confined to a 16px glyph, because white on
// that gradient's #feda75 stop measures 1.36:1 — the MESITA-1142 fill/ink
// failure, missed for a year here because Instagram is not a metal.
//
// THE BAND AND THE RING ARE `aria-hidden` — they are colour-only, and the
// class BOX states the rung in words. Anything that moves that box has to
// keep the rung stated somewhere.
//
// Country is INFERRED from the phone's dial code (`consumers` has no country
// column) and rendered with its flag — the number itself is not shown.

/**
 * One display box inside the card. A `<span>`, never a button: the card owns
 * the only tap target, so a nested control here would be invalid HTML and
 * would swallow the card's own press.
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
        "shadow-rest flex min-h-[76px] min-w-0 flex-col justify-between rounded-2xl p-2.5",
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
  onOpenPassport,
}: {
  profile: ConsumerProfile | null;
  loading: boolean;
  onOpenPassport: () => void;
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
                className="bg-muted h-[76px] animate-pulse rounded-2xl"
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
  // stale profile row. The handle IS printed here again — see the width note
  // at the top of the file.
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
          from assistive tech on purpose: it is colour-only, and the Class tile
          below states the same rung in words. */}
      <div className={cn("h-1.5 w-full", classFillClass(key))} aria-hidden />

      {/* THE WHOLE CARD IS THE BUTTON. Everything below is a <span>, so
          there is nothing to nest and nothing to swallow this press. */}
      <button
        type="button"
        onClick={onOpenPassport}
        aria-label="Open your passport"
        className="flex w-full flex-col gap-5 p-5 text-left transition active:scale-[0.99]"
      >
        <span className="flex min-w-0 items-center gap-4">
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
            <span className="flex min-w-0 items-center justify-between gap-2">
              <span className="text-muted-foreground truncate text-xs">
                {detailLine}
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
            </span>
          </span>
        </span>

        <span className="grid grid-cols-2 items-stretch gap-2">
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
        </span>
      </button>
    </section>
  );
}
