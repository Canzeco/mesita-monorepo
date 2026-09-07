"use client";

import Image from "next/image";
import { Lock, Unlock } from "lucide-react";
import type { ConsumerProfile } from "@/lib/api/profile";
import { DefaultAvatar } from "@/components/consumer/DefaultAvatar";
import { CLASSES, classFillClass } from "@/lib/consumer-data";
import { useConsumerClass } from "@/lib/class-context";
import { ageFromBirthday, cn, formatSex, phoneCountry } from "@/lib/utils";

// ─── The Passport (MESITA-1079 v2 · -1619 · -1633 · -1636 · -1640 · -1646) ──
//
// JUST VISIBLE (Pato, MESITA-1646), AND IDENTITY ONLY (MESITA-1650). This
// card DISPLAYS and does nothing else. It holds no doors, is not itself a
// button, and no longer restates the two axes. Anatomy:
//
//   band        the class metal, 6px, colour-only
//   header      PASSPORT · the privacy state
//   identity    photo ringed in the metal · name · age·sex·country
//
// THE AXES MOVED TO THE GRID (MESITA-1650). Instagram and Class are cells on
// Me now, carrying their own values. Printing them here TOO would state the
// same two facts twice within 150px, and the cell is the one you can tap.
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
// THE METAL IS THE BAND AND THE RING, AND THAT IS ALL OF IT. Colour means
// class and lives on the passport, nowhere else on this page (MESITA-1132,
// Docs › Design §D). The Class CELL below is plain like every other cell —
// putting the metal fill down there would spread colour into the grid.
//
// THE BAND AND THE RING ARE `aria-hidden`, on the stated ground that
// something says the class in words. That something used to be the Class box
// inside this card; it is a cell further down the page now, outside this
// subtree, so the rung rides the section's `aria-label` instead. If you move
// it again, keep the rung stated somewhere a screen reader reaches HERE.
//
// Country is INFERRED from the phone's dial code (`consumers` has no country
// column) and rendered with its flag — the number itself is not shown.

export function ProfileSummaryCard({
  profile,
  loading,
}: {
  profile: ConsumerProfile | null;
  loading: boolean;
}) {
  const { key } = useConsumerClass();

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
            25px the real name, 16px the real meta line. */}
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

  // The rung, in words, for assistive tech only — the band and ring are
  // colour and `aria-hidden`, and the Class CELL that used to state this is
  // now outside the card's subtree (MESITA-1650).
  const classLabel = CLASSES.find((c) => c.id === key)?.label ?? "Bronze";

  return (
    <section
      aria-label={`Your Mesita passport, ${classLabel} class`}
      className="border-border bg-card shadow-rest w-full overflow-hidden rounded-2xl border"
    >
      {/* The metal band — the class is the first thing the card says. Hidden
          from assistive tech on purpose: it is colour-only, and the section's
          own aria-label carries the rung in words. */}
      <div className={cn("h-1.5 w-full", classFillClass(key))} aria-hidden />

      {/* SMALLER, TWICE OVER. MESITA-1640 set py-10 on "2xplus margin height"
          while the card still carried four doors; MESITA-1649 cut it to py-6
          once they were gone (303px → 235px), and MESITA-1650 took the two
          axis boxes out on top of that. What is left is a header row and an
          identity row. */}
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

        {/* Identity, and now the whole body. Not a button — the `Passport`
            cell in the grid below opens the document (MESITA-1646). */}
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
      </div>
    </section>
  );
}
