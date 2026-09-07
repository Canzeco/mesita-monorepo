"use client";

import Image from "next/image";
import { Instagram, Lock, Unlock, UserRound } from "lucide-react";
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

// ─── The Passport (MESITA-1079 v2 · -1619 · -1622 · -1633) ────────────────
//
//   identity    photo ringed in the class metal · name on its own line ·
//               age·sex·country beside the privacy state
//   sub-grid    PROFILE · INSTAGRAM · CLASS, three cells, only CLASS in metal
//
// NO PLAN CELL (decision: Pato, MESITA-1619). The Passport prints what is
// EARNED and PUBLIC. Class is earned and never purchasable; the plan is what
// you PAY, and money on an identity card is the retired v1 merge coming back
// in a new shape — Docs › Passport §B: "It never prints on the Passport."
// Plan is a cell in the grid below. Do not re-add it here.
//
// NO MEMBER-NUMBER ROW (decision: Pato, MESITA-1633). The door survives: the
// IDENTITY ZONE is a button onto the same sheet, and `consumers.code` is
// printed there. Nothing else in the app prints that number, so if the
// identity button ever stops opening the document, the number becomes
// unreachable — that is the thing to protect, not the row.
//
// THE SUB-CELL STATES A STATUS, NOT A HANDLE, and the width is why. Measured
// in the browser at 375px: the cell is 94px with a 74px text box, and
// "@patocanz" needs 76px — it clips at NINE characters, and most handles are
// longer. The old 2-up tile could afford the handle at 147px; three across
// cannot. So Instagram says "Connected"/"Connect" and the handle lives one
// tap away in the Instagram sheet and on the passport document. At 320px the
// cells fall to ~80px and the uppercase label itself truncates — accepted,
// the glyph carries the identity there.
//
// ONLY CLASS WEARS METAL. Three filled cells would make the card a colour
// block and undo the one rule this page has (Docs › Design §D: colour means
// class). Profile and Instagram are `bg-muted`; the Instagram brand gradient
// is confined to a 16px glyph, because white on that gradient's #feda75 stop
// measures 1.36:1 — the MESITA-1142 fill/ink failure, missed for a year here
// because Instagram is not a metal.
//
// THE BAND AND THE RING ARE `aria-hidden` — they are colour-only, and the
// CLASS CELL is what states the rung in words. Anything that moves that cell
// has to keep the rung stated somewhere.
//
// SIBLING BUTTONS, NEVER NESTED. The identity zone and the three sub-cells
// are siblings — wrapping the card to make "tap anywhere" work would nest
// the cells inside a button and break both.
//
// Country is INFERRED from the phone's dial code (`consumers` has no country
// column) and rendered with its flag — the number itself is not shown.

/**
 * One sub-grid cell. Label on its own LINE above the value — side by side at
 * 94px they collide, which is what "PROFILEEdit" looked like in the mockup.
 */
function SubTile({
  label,
  icon,
  value,
  fill,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  /** Carries its own ink — three of the four metals are LIGHT fills and white
   *  measures under 2:1 on them (MESITA-1142), so a cell never assumes it. */
  fill: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label}: ${value}`}
      className={cn(
        "shadow-rest flex min-h-[76px] min-w-0 flex-col justify-between rounded-2xl p-2.5 text-left transition active:scale-[0.98]",
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
    </button>
  );
}

export function ProfileSummaryCard({
  profile,
  loading,
  onOpenClass,
  onOpenInstagram,
  onOpenPassport,
  onOpenProfile,
}: {
  profile: ConsumerProfile | null;
  loading: boolean;
  onOpenClass: () => void;
  onOpenInstagram: () => void;
  onOpenPassport: () => void;
  onOpenProfile: () => void;
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
          <div className="grid grid-cols-3 items-stretch gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
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
  // stale profile row. The handle itself is NOT printed here — see the width
  // note at the top of the file; this cell says whether the door is open.
  const handle = classHandle ?? profile?.instagram_handle ?? null;
  const igConnected = origin === "instagram" || Boolean(handle);

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

        <div className="grid grid-cols-3 items-stretch gap-2">
          <SubTile
            label="Profile"
            icon={<UserRound className="h-4 w-4 shrink-0 opacity-70" />}
            value="Edit"
            fill="bg-muted text-foreground"
            onClick={onOpenProfile}
          />
          <SubTile
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
            value={igConnected ? "Connected" : "Connect"}
            fill="bg-muted text-foreground"
            onClick={onOpenInstagram}
          />
          <SubTile
            label="Class"
            icon={<ClassIcon className="h-4 w-4 shrink-0 opacity-70" />}
            value={classLabel}
            fill={classBadgeClass(key)}
            onClick={onOpenClass}
          />
        </div>
      </div>
    </section>
  );
}
