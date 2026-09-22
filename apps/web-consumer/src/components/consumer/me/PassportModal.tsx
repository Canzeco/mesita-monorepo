"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { ChevronRight, Copy, Gem, Instagram } from "lucide-react";

import { DefaultAvatar } from "@/components/consumer/DefaultAvatar";
import { MeScreen } from "@/components/consumer/me/MeScreen";
import { Skeleton } from "@/components/shared";
import { useConsumerClass } from "@/lib/class-context";
import {
  diamondNote,
  diamondSummary,
  instagramNote,
  instagramSummary,
} from "@/lib/consumer-identity";
import {
  apiFetchConsumerProfile,
  type ConsumerProfile,
} from "@/lib/api/profile";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import {
  buildMrz,
  completionLine,
  passportFields,
} from "@/lib/passport-document";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { INSTAGRAM_ICON_GRADIENT_CLASS } from "@/lib/ui-classes";
import { cn, errMsg, formatCompactCount, phoneCountry } from "@/lib/utils";
import { toast } from "@/lib/toast";

// The passport, as the DOCUMENT it is named after (decision: Pato, this
// session) — the Me card is the cover, this is the data page.
//
// AND SINCE MESITA-1820 IT ACTUALLY READS AS ONE. It used to be three rounded
// rows — a round avatar, a name, two chevron tiles — on a surface called a
// passport. It is now an ICAO 9303 data page: a class-metal header band, a
// 35:45 portrait in a metal frame, an uppercase field grid, a guilloche, and
// two real 44-character TD3 machine-readable lines. The class metal is
// licensed to live here and nowhere else (MESITA-1132 / MESITA-1688) and the
// surface finally spends it.
//
// NO COSTUME. The document is carried by the band, the portrait ratio, the
// grid, the guilloche and the MRZ — nothing else. Banned outright, because
// this is exactly where the design decays: fake visa stamps, hologram sheen,
// torn-paper or deckle edges, a rotated APPROVED mark, fake barcodes, paper
// grain, and any raw inset shadow for an engraved feel (elevation is a closed
// set — shadow-rest / shadow-elev / shadow-glow-sm).
//
// FULL PAGE, NOT A SHEET (Pato, MESITA-1789). The hub used to wrap this in a
// LocalSheet. Each Me box is a route now; Back returns to /me, not a stacked
// overlay. The page fetches its own profile so a cold load of /me/passport
// works without the hub still being mounted.
//
// IDENTITY IS LOOK, NOT A BUTTON (MESITA-1801). Portrait, field grid and the
// member number sit on a document card. The number is still the only print of
// consumers.code — it copies in place; it is not a view.
//
// TWO TILES ARE THE ONLY BUTTONS, AND THEY ARE THE ONLY ONES. Instagram and
// Diamond navigate to /me/instagram and /me/diamond; the connect form, the
// invitation request and the PIN field all stay on those pages. Inlining any
// of them here would be the twice-rendered CTA the class sheet already killed.
//
// THEY WERE CLASS AND INSTAGRAM (MESITA-2040). One tile named a rung and the
// other named a door onto that rung, which is why their captions needed a
// four-state helper (`passportDoorCaptions`, MESITA-1819) to stop Diamond
// reading "Highest discount · Instagram or an invite". Two independent facts
// need no such helper: each tile says its own fact and nothing about the
// other, and the middle-dot glue that rule was written against is
// unconstructable.
//
// THE METAL IS DIAMOND OR NOTHING. MESITA-1132 licensed colour to mean class
// and to live on the passport; there is no ladder to mean, so the band, the
// portrait frame, the wash and the guilloche all carry one fact. A guest who
// is not Diamond gets the neutral document, which is the same document
// MESITA-1820 designed — it simply is not engraved.
//
// TYPE AND CODE ARE NOT FIELDS (MESITA-1820, D3). They printed `PM` and `MTA`
// for every guest forever and were taking the row the member number needed.
// They survive encoded in the MRZ, which is where a constant belongs.
//
// NO PLAN FIELD (decision: Pato, MESITA-1619). The card and the document are
// one Passport and print one thing: what is earned and public. The plan is
// what you pay — Docs › Passport §B, "It never prints on the Passport" — and
// it keeps its own primary box on Me.
//
// NO PRIVACY FIELD EITHER (MESITA-1688, Pato: "all are public by default").
// `profile_public` defaults `true` for every account
// (20260705080000_consumer_profile_visibility.sql) and Settings › Privacy
// already owns the toggle exclusively.
//
// PROFILE IS NOT A DOOR HERE. It is a cell on Me, one tap away
// (MESITA-1609: removed, not demoted). The completion line under the grid is
// a COUNT, not a link, for exactly that reason — see the note on it below.

function Door({
  href,
  glyph,
  eyebrow,
  headline,
  note,
}: {
  href: string;
  glyph: ReactNode;
  eyebrow: string;
  headline: ReactNode;
  note: string | null;
}) {
  return (
    <Link
      href={href}
      className="border-border bg-card hover:bg-muted/40 flex min-h-[72px] w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition active:scale-[0.99]"
    >
      {glyph}
      <span className="min-w-0 flex-1">
        <span className="text-muted-foreground type-meta block font-bold tracking-[0.12em] uppercase">
          {eyebrow}
        </span>
        <span className="mt-0.5 block text-sm font-bold tracking-tight">
          {headline}
        </span>
        {note ? (
          <span className="text-muted-foreground mt-0.5 block text-xs leading-snug">
            {note}
          </span>
        ) : null}
      </span>
      <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
    </Link>
  );
}

/** One line of the data page. NOT named `Field`: passport-axes.test.ts bans
 *  that identifier in this file, because the settings list MESITA-1801 deleted
 *  was built out of a component by that name and the guard is what stops it
 *  coming back under the same shape. A `Row` on a document is a printed line,
 *  not a tappable cell — it has no chevron and no handler, on purpose.
 *
 *  `placeholder` is the empty print. Guest-fillable blanks get an em dash and
 *  are counted by the completion line; server-owed blanks get `pending` and
 *  are never counted — nobody taps a blank that was never theirs to fill. */
function Row({
  label,
  value,
  placeholder,
  children,
}: {
  label: string;
  value: string | null;
  placeholder: string;
  children?: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <span className="text-muted-foreground type-meta block font-bold tracking-[0.12em] uppercase">
        {label}
      </span>
      <span className="flex min-w-0 items-center gap-1">
        <span
          className={cn(
            "font-display type-body block truncate",
            value ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {value ?? placeholder}
        </span>
        {children}
      </span>
    </div>
  );
}

function PassportSkeleton() {
  // Mirrors the card it stands in for — band bar, 74x95 portrait, six field
  // lines, two MRZ lines. The old skeleton was a 61px circle over three lines
  // and two pills, which resolved to a completely different layout and made
  // the page jump on load.
  return (
    <div aria-hidden className="flex flex-col gap-3.5">
      <div className="border-border bg-card overflow-hidden rounded-2xl border">
        <Skeleton className="h-9 w-full rounded-none" />
        <div className="flex gap-4 p-4">
          <Skeleton className="h-[100px] w-[79px] shrink-0 rounded-[6px]" />
          <div className="min-w-0 flex-1 space-y-3">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-3/5" />
            <div className="flex gap-2">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-1/6" />
            </div>
          </div>
        </div>
        <div className="space-y-1 px-3 pb-3">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-full" />
        </div>
      </div>
      <Skeleton className="min-h-[72px] w-full rounded-2xl" />
      <Skeleton className="min-h-[72px] w-full rounded-2xl" />
    </div>
  );
}

export function PassportModal() {
  const supabase = useBrowserSupabase();
  const [profile, setProfile] = useState<ConsumerProfile | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const { facts } = useConsumerClass();
  const { diamond, unknown } = facts;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { consumer } = await apiFetchConsumerProfile(supabase);
        if (!cancelled) setProfile(consumer);
      } catch (e) {
        if (!cancelled) {
          setFailed(true);
          toast(errMsg(e, "Couldn't load your profile."));
        }
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const name =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    profile?.full_name ||
    "Mesita member";
  const avatarUrl = profile?.avatar_url ?? null;

  // The context is seeded server-side; this page fetches the profile itself,
  // so the handle can arrive from either. The context wins when it has one (a
  // fresh connect updates it first) and the profile row covers the cold load.
  const igFacts = facts.igHandle
    ? facts
    : {
        ...facts,
        igHandle: profile?.instagram_handle ?? null,
        igConnected: facts.igConnected || Boolean(profile?.instagram_handle),
      };

  // NATIONALITY comes from the phone dial code, not from `consumers.country`:
  // onboarding never writes that column, so the dial code the guest already
  // gave us is in practice the only source. `1` resolves to USA (longest-dial
  // -first lands there over CA/DO/PR) — a stable code beats an em dash for
  // every North American guest, and MESITA-1829 owns collecting country for
  // real.
  const country = phoneCountry(profile?.phone) ?? null;
  const nationality =
    country?.iso3 ?? (profile?.country ? profile.country.toUpperCase() : null);

  // `dataPage`, not `document` — shadowing the DOM global in a client
  // component is a footgun the next reader should not have to notice.
  const dataPage = {
    code: profile?.code ?? null,
    firstName: profile?.first_name ?? null,
    lastName: profile?.last_name ?? null,
    birthday: profile?.birthday ?? null,
    sex: profile?.sex ?? null,
    nationality,
    // The MRZ's optional-data field. `DIAMOND` or `MEMBER`, never a blank:
    // the strip is fixed-width and a filler run there would read as a field
    // the document declined to print rather than as an ordinary account.
    standing: unknown ? null : diamond ? "DIAMOND" : "MEMBER",
  };
  const { fields, missing } = passportFields(dataPage);
  const [mrzLine1, mrzLine2] = buildMrz(dataPage);
  // A FAILED FETCH IS NOT AN EMPTY PROFILE. When the profile read throws,
  // `profile` stays null and every guest-owned field reads as blank — so an
  // ungated count says "5 fields left to fill" to a guest whose passport is
  // actually complete, under a member number that prints "pending". The band,
  // the portrait and the MRZ already degrade honestly (they show what they
  // have); the count is the one line that ASSERTS something, so it is the one
  // line that has to know the read failed.
  const completion = loaded && !failed ? completionLine(missing.length) : null;
  const byId = (id: string) => fields.find((f) => f.id === id)?.value ?? null;

  const code = profile?.code ?? null;
  const igHeadline = instagramSummary(igFacts);
  const igNote = instagramNote(
    igFacts,
    `${formatCompactCount(igFacts.igFollowers)} followers`,
  );
  const diamondHeadline = diamondSummary(facts);

  async function copyCode() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Member number copied");
    } catch {
      toast("Couldn't copy — select the number manually");
    }
  }

  return (
    <MeScreen title="Your passport">
      {!loaded ? (
        <PassportSkeleton />
      ) : (
        <div className="flex flex-col gap-3.5">
          <section className="border-border bg-card relative overflow-hidden rounded-2xl border">
            <div
              className={cn(
                "pointer-events-none absolute inset-0",
                unknown || !diamond ? "bg-muted/30" : "wash-diamond",
              )}
              aria-hidden
            />

            {/* The band. A real passport's top strip names the issuing state;
                naming the standing there spends MESITA-1132's colour budget on
                the one surface that holds the license, cannot be mistaken for
                a button, and adds neither a field nor a third door. Not
                Diamond, or unknown: neutral strip and no second word. */}
            <div
              className={cn(
                "relative flex items-center justify-between gap-3 px-4 py-2.5",
                diamond && !unknown
                  ? "bg-tier-diamond text-foreground"
                  : "bg-muted text-foreground",
              )}
            >
              <span className="font-display type-eyebrow truncate">
                Mesita
              </span>
              {diamond && !unknown ? (
                <span className="type-meta shrink-0 font-bold tracking-[0.12em] uppercase">
                  Diamond
                </span>
              ) : null}
            </div>

            <div className="relative p-4">
              {/* The guilloche, suppressed when there is no metal to engrave —
                  which is now every account without an invitation, not only an
                  unreadable one. */}
              {diamond && !unknown ? (
                <div
                  aria-hidden
                  className="guilloche text-diamond pointer-events-none absolute inset-0"
                />
              ) : null}

              <div className="relative flex gap-4">
                {/* 35:45 — the ratio a passport photo actually is, not a
                    56px avatar circle. */}
                <div
                  className={cn(
                    "shrink-0 rounded-[6px] p-[2.5px]",
                    diamond && !unknown ? "bg-tier-diamond" : "bg-muted",
                  )}
                  aria-hidden
                >
                  <div className="bg-muted relative h-[95px] w-[74px] overflow-hidden rounded-[4px]">
                    {avatarUrl ? (
                      <Image
                        src={avatarUrl}
                        alt={name}
                        fill
                        sizes="74px"
                        className="object-cover"
                      />
                    ) : (
                      <DefaultAvatar className="h-full w-full" />
                    )}
                  </div>
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  {/* The member number takes the whole top row — louder than
                      it was, not quieter. */}
                  <div className="min-w-0">
                    <span className="text-muted-foreground type-meta block font-bold tracking-[0.12em] uppercase">
                      Member No.
                    </span>
                    <span className="flex min-w-0 items-center gap-1">
                      <span
                        className={cn(
                          "font-display block truncate text-lg leading-tight tracking-wide tabular-nums",
                          code ? "text-foreground" : "text-muted-foreground",
                        )}
                      >
                        {code ?? "pending"}
                      </span>
                      {code ? (
                        <button
                          type="button"
                          onClick={copyCode}
                          aria-label="Copy member number"
                          className="text-muted-foreground hover:text-foreground hover:bg-muted -my-3 -mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      ) : null}
                    </span>
                  </div>

                  <Row label="Surname" value={byId("surname")} placeholder="—" />
                  <Row
                    label="Given names"
                    value={byId("given")}
                    placeholder="—"
                  />
                </div>
              </div>

              {/* The passport triple runs the FULL width of the card, not the
                  column beside the portrait: "DATE OF BIRTH" at the 10px floor
                  with 0.12em tracking measures ~91px, and the column left of
                  it is ~159px at a 320px viewport. Three of them do not fit
                  there and two of the labels would wrap. */}
              <div className="relative mt-3 grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3">
                <Row
                  label="Nationality"
                  value={byId("nationality")}
                  placeholder="—"
                />
                <Row
                  label="Date of birth"
                  value={byId("birth")}
                  placeholder="—"
                />
                <Row label="Sex" value={byId("sex")} placeholder="—" />
              </div>

              {/* THE COMPLETION LINE IS A COUNT, NOT A LINK (decision,
                  MESITA-1820). The issue asked for a "Complete" link to
                  Me › Profile beside it, arguing that a conditional,
                  self-deleting link is not the permanent third door
                  MESITA-1801 banned. It is still a third href on a surface
                  whose whole law is two, and passport-axes.test.ts pins that
                  law twice over. Weakening a guard to add a convenience is
                  the trade MESITA-1801 already refused, so the count ships
                  alone: it names what is missing, and Me › Profile is one
                  Back away. Reversible — reopen it with Pato, not by editing
                  the test. */}
              {completion ? (
                <p className="text-muted-foreground relative mt-3 text-xs">
                  {completion}
                </p>
              ) : null}
            </div>

            {/* The MRZ. Two real TD3 lines with real 7-3-1 check digits,
                aria-hidden because 44 characters of `<` read aloud is hostile
                and the grid above already announces every fact it encodes.
                44 characters at the 10px floor measures ~254px against 276px
                of strip at a 320px viewport, so it ships at type-meta with no
                clamp() — clamp() would have walked under §D's hard 10px floor
                with green lint. */}
            <div
              aria-hidden
              className="border-border/60 bg-muted/50 relative overflow-hidden border-t px-3 py-2"
            >
              <p className="type-meta text-muted-foreground font-mono whitespace-nowrap tracking-[-0.015em]">
                {mrzLine1}
              </p>
              <p className="type-meta text-muted-foreground font-mono whitespace-nowrap tracking-[-0.015em]">
                {mrzLine2}
              </p>
            </div>
          </section>

          {/* INSTAGRAM FIRST, THEN DIAMOND — the order Pato named the two
              facts (MESITA-2040), matching the header chips and the Me grid.
              Three surfaces, one order; a reflow on any of them is visible
              against the other two. */}
          <Door
            href={CONSUMER_ROUTES.mePages.instagram}
            eyebrow="Instagram"
            glyph={
              <span
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white",
                  INSTAGRAM_ICON_GRADIENT_CLASS,
                )}
                aria-hidden
              >
                <Instagram className="h-5 w-5" />
              </span>
            }
            headline={igHeadline}
            note={igNote}
          />

          <Door
            href={CONSUMER_ROUTES.mePages.diamond}
            eyebrow="Diamond"
            glyph={
              <span
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                  diamond && !unknown
                    ? "bg-tier-diamond text-foreground"
                    : "bg-muted text-muted-foreground",
                )}
                aria-hidden
              >
                <Gem className="h-5 w-5" />
              </span>
            }
            headline={
              unknown ? "Couldn't read your invitation" : diamondHeadline
            }
            note={diamondNote(facts)}
          />
        </div>
      )}
    </MeScreen>
  );
}
