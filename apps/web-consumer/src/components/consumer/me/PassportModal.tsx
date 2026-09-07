"use client";

import Image from "next/image";
import { Copy, IdCard, Lock, Unlock } from "lucide-react";

import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { DefaultAvatar } from "@/components/consumer/DefaultAvatar";
import { useConsumerClass } from "@/lib/class-context";
import { CLASSES, classFillClass } from "@/lib/consumer-data";
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
// PRIVACY IS STATED, NOT TOGGLED. Settings › Privacy owns the switch and its
// wording is copied from there verbatim; a second control for one flag is how
// two surfaces start disagreeing about what "public" means.

function Field({
  label,
  value,
  note,
  trailing,
}: {
  label: string;
  value: string;
  note?: string | null;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="border-border/60 flex items-center gap-3 border-t px-4 py-3 first:border-t-0">
      <span className="text-muted-foreground type-meta w-24 shrink-0 font-bold tracking-[0.12em] uppercase">
        {label}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold tracking-tight">
          {value}
        </span>
        {note && (
          <span className="text-muted-foreground block truncate text-xs">
            {note}
          </span>
        )}
      </span>
      {trailing}
    </div>
  );
}

export function PassportModal({
  open,
  onClose,
  profile,
  onOpenSettings,
}: {
  open: boolean;
  onClose: () => void;
  profile: ConsumerProfile | null;
  onOpenSettings: () => void;
}) {
  const { key, origin, followers, handle: classHandle } = useConsumerClass();

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
          {/* Same metal band as the card above — the class is the first thing
              the document says. Colour-only, so it is hidden from assistive
              tech; the Class field below states the rung in words. */}
          <div
            className={cn("h-1.5 w-full", classFillClass(key))}
            aria-hidden
          />

          <div className="flex items-center gap-4 p-4">
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

          <div className="border-border/60 border-t">
            <Field
              label="Number"
              value={code ?? "—"}
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
                    className="text-muted-foreground hover:text-foreground hover:bg-muted -mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                ) : undefined
              }
            />
            <Field
              label="Class"
              value={classLabel}
              note={cls?.reward ?? null}
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
            />
          </div>
        </section>

        {/* Visibility — stated here, switched in Settings. The wording is the
            Private-account row's own, so the two can't drift. */}
        <div className="border-border bg-card mt-3 rounded-2xl border p-4">
          <div className="flex items-center gap-2">
            {isPublic ? (
              <Unlock className="text-muted-foreground h-4 w-4 shrink-0" />
            ) : (
              <Lock className="text-muted-foreground h-4 w-4 shrink-0" />
            )}
            <span className="text-sm font-bold tracking-tight">
              {isPublic ? "Public" : "Private"}
            </span>
          </div>
          <p className="text-muted-foreground mt-1.5 text-xs leading-snug">
            {isPublic
              ? "Other guests see this passport in the social feed and on your reviews. Turn on Private account in Settings to appear anonymous instead."
              : "Other guests see you as anonymous in the social feed and on reviews. Your Instagram can stay public — this only affects Mesita."}
          </p>
          <button
            type="button"
            onClick={onOpenSettings}
            className="border-border hover:bg-muted mt-3 flex h-10 items-center justify-center rounded-lg border px-4 text-sm font-semibold transition"
          >
            Open Settings
          </button>
        </div>
      </div>
    </LocalSheet>
  );
}
