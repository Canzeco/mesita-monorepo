"use client";

import Image from "next/image";
import { ChevronRight, Copy, IdCard } from "lucide-react";

import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { DefaultAvatar } from "@/components/consumer/DefaultAvatar";
import { useConsumerClass } from "@/lib/class-context";
import {
  CLASSES,
  classBadgeClass,
  classFillClass,
  classWashClass,
} from "@/lib/consumer-data";
import type { ConsumerProfile } from "@/lib/api/profile";
import { SHEET_BODY_CLASS, SHEET_TITLE_CLASS } from "@/lib/ui-classes";
import {
  ageFromBirthday,
  cn,
  formatCompactCount,
  formatSex,
  phoneCountry,
} from "@/lib/utils";
import { toast } from "@/lib/toast";

// The passport, as the DOCUMENT it is named after (decision: Pato, this
// session) — the Me card is the cover, this is the data page.
//
// The card at the top of Me states the same identity at a glance and taps
// into the surfaces that OWN each axis. This sheet owns nothing. It restates
// that identity as fields, in one column, and adds the one fact the guest
// cannot see anywhere else in the app: their member number. `consumers.code`
// is fetched on every profile read and, until now, was rendered on no
// consumer surface at all — it is the number support and staff have when the
// guest has only a phone in their hand.
//
// NO PLAN FIELD (decision: Pato, MESITA-1619). The card and the document are
// one Passport and print one thing: what is earned and public. The plan is
// what you pay — Docs › Passport §B, "It never prints on the Passport" — and
// it keeps its own primary box on Me. A sheet that still listed it would have
// preserved MESITA-1464's contradiction one layer down.
//
// EVERY FIELD HERE IS ALREADY IN HAND. The sheet takes the profile the page
// fetched and the class context the shell seeded, so opening it costs no EF
// call and it can never disagree with the card above it.
//
// NO PRIVACY FIELD EITHER (MESITA-1688, Pato: "all are public by default").
// `profile_public` defaults `true` for every account
// (20260705080000_consumer_profile_visibility.sql) and Settings › Privacy
// already owns the toggle exclusively — restating "Public"/"Private" here was
// exactly the two-surfaces-can-disagree risk this file otherwise guards
// against, just not yet turned on itself. Gone, not demoted, same as NO PLAN
// FIELD above.

// TWO ROWS HERE ARE DOORS, AND THEY ARE THE ONLY ONES (MESITA-1646). The
// card above is display-only now, so Class and Instagram are reachable from
// nowhere else in the app: Instagram is the only reach door, and the Class
// ladder carries "Join with Invitation", which Docs › Passport §C calls the
// ONLY entrance for a 10-digit invite PIN. Do not make either inert without
// giving its surface another way in FIRST.
//
// PROFILE IS NOT A DOOR HERE. It is a cell on Me, one tap away, and a second
// door to a promoted surface is what MESITA-1609 established as removed, not
// demoted. It stays a display field.
function Field({
  label,
  value,
  valueNode,
  valueClassName,
  note,
  trailing,
  onClick,
}: {
  label: string;
  value: string;
  /** Renders instead of the plain-text value span when present (the Class
   *  row's colour badge, MESITA-1688). `value` still gets passed for the
   *  <Tag>'s own text content otherwise, so it's never truly unused. */
  valueNode?: React.ReactNode;
  /** Extra classes merged onto the default value span — for a row that needs
   *  different weight without a full valueNode override (the Number row's
   *  typography, MESITA-1688). Ignored when valueNode is set. */
  valueClassName?: string;
  note?: string | null;
  trailing?: React.ReactNode;
  /** Turns the row into a button with a chevron. Hands off at the SAME
   *  z-layer, so the caller closes this sheet before opening the next —
   *  two LocalSheets must never stack. */
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick } : {})}
      className={cn(
        "border-border/60 flex w-full items-center gap-3 border-t px-4 py-3 text-left first:border-t-0",
        onClick && "hover:bg-muted/50 transition",
      )}
    >
      <span className="text-muted-foreground type-meta w-24 shrink-0 font-bold tracking-[0.12em] uppercase">
        {label}
      </span>
      <span className="min-w-0 flex-1">
        {valueNode ?? (
          <span
            className={cn(
              "block truncate text-sm font-semibold tracking-tight",
              valueClassName,
            )}
          >
            {value}
          </span>
        )}
        {note && (
          <span className="text-muted-foreground block truncate text-xs">
            {note}
          </span>
        )}
      </span>
      {trailing}
      {onClick && (
        <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
      )}
    </Tag>
  );
}

export function PassportModal({
  open,
  onClose,
  profile,
  onOpenInstagram,
  onOpenClass,
}: {
  open: boolean;
  onClose: () => void;
  profile: ConsumerProfile | null;
  /** The two doors the card gave up (MESITA-1646). Each closes this sheet
   *  first — one LocalSheet layer. */
  onOpenInstagram: () => void;
  onOpenClass: () => void;
}) {
  function handOff(run: () => void) {
    onClose();
    run();
  }
  const { key, origin, followers, handle: classHandle } = useConsumerClass();

  const name =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    profile?.full_name ||
    "Mesita member";
  const avatarUrl = profile?.avatar_url ?? null;

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

  const handle = classHandle ?? profile?.instagram_handle ?? null;
  const igConnected = origin === "instagram" || Boolean(handle);

  // The EF assigns and repairs the canonical 0000-0000 form on every profile
  // read, so it is printed as it arrives — no second formatter to drift.
  const code = profile?.code ?? null;

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
    <LocalSheet open={open} onClose={onClose} ariaLabel="Your passport">
      <div className={SHEET_BODY_CLASS}>
        <div className="mb-4 flex items-center gap-3">
          <span className="bg-muted text-foreground flex h-12 w-12 shrink-0 items-center justify-center rounded-full">
            <IdCard className="h-5 w-5" />
          </span>
          <div>
            <h2 className={SHEET_TITLE_CLASS}>Your passport</h2>
            <p className="text-muted-foreground text-xs">
              Who you are at Mesita, on one page.
            </p>
          </div>
        </div>

        <section className="border-border bg-card overflow-hidden rounded-2xl border">
          {/* The wash (MESITA-1688) — same treatment as the bar above it,
              replacing the old flat band here: the metal felt across the
              card's top rather than a hard-edged strip. Colour-only, so it's
              hidden from assistive tech; the Class field below states the
              rung in words. */}
          <div className="relative">
            <div
              className={cn("pointer-events-none absolute inset-0", classWashClass(key))}
              aria-hidden
            />
            <div className="relative flex items-center gap-4 p-4">
            <div
              className={cn(
                "shrink-0 rounded-full p-[2.5px]",
                classFillClass(key),
              )}
              aria-hidden
            >
              <div className="bg-card rounded-full p-[2px]">
                <div className="bg-muted relative h-[56px] w-[56px] overflow-hidden rounded-full">
                  {avatarUrl ? (
                    <Image
                      src={avatarUrl}
                      alt={name}
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                  ) : (
                    <DefaultAvatar className="h-full w-full" />
                  )}
                </div>
              </div>
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <h3 className="font-display truncate text-lg leading-tight font-semibold tracking-tight">
                {name}
              </h3>
              {detailLine && (
                <p className="text-muted-foreground truncate text-xs">
                  {detailLine}
                </p>
              )}
            </div>
            </div>
          </div>

          <div className="border-border/60 border-t">
            <Field
              label="Number"
              value={code ?? "—"}
              // The one fact the guest can't see anywhere else in the app
              // (see the header comment) deserves to look like a serial
              // number, not another list row (MESITA-1688 — outside review
              // finding: this was the modal's whole reason to exist, styled
              // identically to "Profile → Name, phone, birthday, photo",
              // which isn't even data).
              valueClassName="font-display text-base tabular-nums"
              note={
                code
                  ? "Assigned once. Yours for good."
                  : "Assigned on your next profile load."
              }
              trailing={
                code ? (
                  <button
                    type="button"
                    onClick={copyCode}
                    aria-label="Copy member number"
                    className="text-muted-foreground hover:text-foreground hover:bg-muted -mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                ) : undefined
              }
            />
            <Field
              label="Profile"
              value={name}
              note="Name, phone, birthday, photo"
            />
            <Field
              label="Class"
              value={classLabel}
              // Class is the headline of the identity (Docs › Passport §D's
              // reading order), but read the same weight as the three purely
              // informational rows above it — nothing led (MESITA-1688).
              // classBadgeClass is safe on the SHEET even though the BAR's
              // chip stays plain: this is a spacious, single-purpose,
              // full-width row, not the cramped 62px 2-up grid the "third
              // metal surface" rejection (MESITA-1655/56/57) was about.
              valueNode={
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-bold",
                    classBadgeClass(key),
                  )}
                >
                  {classLabel}
                </span>
              }
              note={cls?.reward ?? null}
              onClick={() => handOff(onOpenClass)}
            />
            <Field
              label="Instagram"
              value={
                igConnected
                  ? handle
                    ? `@${handle}`
                    : "Connected"
                  : "Not connected"
              }
              note={
                igConnected
                  ? `${formatCompactCount(followers)} followers`
                  : "Connect it to climb a class"
              }
              onClick={() => handOff(onOpenInstagram)}
            />
          </div>
        </section>
      </div>
    </LocalSheet>
  );
}
