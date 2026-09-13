"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { ChevronRight, Copy, Instagram } from "lucide-react";

import { DefaultAvatar } from "@/components/consumer/DefaultAvatar";
import { MeScreen } from "@/components/consumer/me/MeScreen";
import { Skeleton } from "@/components/shared";
import { useConsumerClass } from "@/lib/class-context";
import {
  CLASSES,
  CLASS_FLOOR,
  CLASS_ICONS,
  CLASS_MARK_ICON,
  REACH_ENTRY_CLASS,
  REACH_ENTRY_FOLLOWERS,
  classBadgeClass,
  classFillClass,
  classWashClass,
} from "@/lib/consumer-data";
import {
  apiFetchConsumerProfile,
  type ConsumerProfile,
} from "@/lib/api/profile";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { INSTAGRAM_ICON_GRADIENT_CLASS } from "@/lib/ui-classes";
import {
  ageFromBirthday,
  cn,
  errMsg,
  formatCompactCount,
  formatSex,
  phoneCountry,
} from "@/lib/utils";
import { toast } from "@/lib/toast";

// The passport, as the DOCUMENT it is named after (decision: Pato, this
// session) — the Me card is the cover, this is the data page.
//
// FULL PAGE, NOT A SHEET (Pato, MESITA-1789). The hub used to wrap this in a
// LocalSheet. Each Me box is a route now; Back returns to /me, not a stacked
// overlay. The page fetches its own profile so a cold load of /me/passport
// works without the hub still being mounted.
//
// IDENTITY IS LOOK, NOT A BUTTON (MESITA-1801). Photo, name, age·sex·country
// and the member number sit on a document card. The number is still the only
// print of consumers.code — it copies in place; it is not a view.
//
// TWO TILES ARE THE ONLY BUTTONS, AND THEY ARE THE ONLY ONES. Class and
// Instagram navigate to /me/class and /me/instagram. The ladder, Join with
// Instagram, Join with Invitation, and the connect form stay on those pages
// — naming both climb doors in the Class caption is enough. Inlining them
// here would be the twice-rendered CTA ClassModal already killed.
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
// (MESITA-1609: removed, not demoted).

const CLASS_CEILING = CLASSES[CLASSES.length - 1];

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

function PassportSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-3.5">
      <div className="border-border bg-card flex items-center gap-4 overflow-hidden rounded-2xl border p-4">
        <Skeleton className="h-[61px] w-[61px] shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-4 w-24" />
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
  const {
    key,
    origin,
    followers,
    handle: classHandle,
    unknown,
  } = useConsumerClass();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { consumer } = await apiFetchConsumerProfile(supabase);
        if (!cancelled) setProfile(consumer);
      } catch (e) {
        if (!cancelled) toast(errMsg(e, "Couldn't load your profile."));
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
  const classLabel = unknown ? null : (cls?.label ?? CLASS_FLOOR.label);
  const ClassIcon = unknown ? CLASS_MARK_ICON : CLASS_ICONS[key];

  const handle = classHandle ?? profile?.instagram_handle ?? null;
  const igConnected = origin === "instagram" || Boolean(handle);

  const code = profile?.code ?? null;
  const atCeiling = !unknown && key === CLASS_CEILING.id;
  const onFloor = !unknown && key === CLASS_FLOOR.id;

  const classNote = unknown
    ? "Come back to try"
    : onFloor && !igConnected
      ? "Climb with Instagram or an invite"
      : igConnected
        ? (cls?.reward ?? null)
        : `${cls?.reward} · Instagram or an invite`;

  const igHeadline = igConnected
    ? handle
      ? `@${handle}`
      : "Connected"
    : atCeiling
      ? "Not connected"
      : "Connect it";
  const igNote = igConnected
    ? `${formatCompactCount(followers)} followers`
    : atCeiling
      ? "Connect for Stories and Rewards"
      : `${REACH_ENTRY_FOLLOWERS.toLocaleString("en-US")}+ followers lifts you to ${REACH_ENTRY_CLASS.label}`;

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
                unknown ? "bg-muted/40" : classWashClass(key),
              )}
              aria-hidden
            />
            <div className="relative flex items-center gap-4 p-4">
              <div
                className={cn(
                  "shrink-0 rounded-full p-[2.5px]",
                  unknown ? "bg-muted" : classFillClass(key),
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
              <div className="flex min-w-0 flex-1 flex-col">
                <h2 className="font-display truncate text-lg leading-tight font-semibold tracking-tight">
                  {name}
                </h2>
                {detailLine ? (
                  <p className="text-muted-foreground truncate text-xs">
                    {detailLine}
                  </p>
                ) : null}
                <div className="mt-2 flex items-center gap-1">
                  <p className="font-display text-base tracking-wide tabular-nums">
                    {code ?? "—"}
                  </p>
                  {code ? (
                    <button
                      type="button"
                      onClick={copyCode}
                      aria-label="Copy member number"
                      className="text-muted-foreground hover:text-foreground hover:bg-muted -mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
                {!code ? (
                  <p className="text-muted-foreground text-xs">
                    Assigned on your next profile load.
                  </p>
                ) : null}
              </div>
            </div>
          </section>

          <Door
            href={CONSUMER_ROUTES.mePages.class}
            eyebrow="Class"
            glyph={
              <span
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                  unknown ? "bg-muted text-foreground" : classBadgeClass(key),
                )}
                aria-hidden
              >
                <ClassIcon className="h-5 w-5" />
              </span>
            }
            headline={
              unknown ? (
                "Couldn't load your class"
              ) : (
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-bold",
                    classBadgeClass(key),
                  )}
                >
                  {classLabel}
                </span>
              )
            }
            note={classNote}
          />

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
        </div>
      )}
    </MeScreen>
  );
}
