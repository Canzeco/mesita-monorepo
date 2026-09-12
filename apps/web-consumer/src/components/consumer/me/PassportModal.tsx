"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { ChevronRight, Copy, IdCard } from "lucide-react";

import { DefaultAvatar } from "@/components/consumer/DefaultAvatar";
import { MeScreen } from "@/components/consumer/me/MeScreen";
import { useConsumerClass } from "@/lib/class-context";
import {
  CLASSES,
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
// TWO ROWS HERE ARE DOORS, AND THEY ARE THE ONLY ONES (MESITA-1646 /
// MESITA-1789). Class and Instagram navigate to /me/class and /me/instagram.
// Number copies in place — it is not a view. PROFILE IS NOT A DOOR HERE. It
// is a cell on Me, one tap away.

function Field({
  label,
  value,
  valueNode,
  valueClassName,
  note,
  trailing,
  href,
}: {
  label: string;
  value: string;
  valueNode?: ReactNode;
  valueClassName?: string;
  note?: string | null;
  trailing?: ReactNode;
  href?: string;
}) {
  const className = cn(
    "border-border/60 flex w-full items-center gap-3 border-t px-4 py-3 text-left first:border-t-0",
    href && "hover:bg-muted/50 transition",
  );
  const body = (
    <>
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
      {href ? (
        <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
      ) : null}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={className}>
        {body}
      </Link>
    );
  }
  return <div className={className}>{body}</div>;
}

export function PassportModal() {
  const supabase = useBrowserSupabase();
  const [profile, setProfile] = useState<ConsumerProfile | null>(null);
  const { key, origin, followers, handle: classHandle } = useConsumerClass();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { consumer } = await apiFetchConsumerProfile(supabase);
        if (!cancelled) setProfile(consumer);
      } catch (e) {
        if (!cancelled) toast(errMsg(e, "Couldn't load your profile."));
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
  const classLabel = cls?.label ?? "Bronze";

  const handle = classHandle ?? profile?.instagram_handle ?? null;
  const igConnected = origin === "instagram" || Boolean(handle);

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
    <MeScreen title="Your passport">
      <div className="mb-4 flex items-center gap-3">
        <span className="bg-muted text-foreground flex h-12 w-12 shrink-0 items-center justify-center rounded-full">
          <IdCard className="h-5 w-5" />
        </span>
        <p className="text-muted-foreground text-xs">
          Who you are at Mesita, on one page.
        </p>
      </div>

      <section className="border-border bg-card overflow-hidden rounded-2xl border">
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
              <h2 className="font-display truncate text-lg leading-tight font-semibold tracking-tight">
                {name}
              </h2>
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
            href={CONSUMER_ROUTES.mePages.class}
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
            href={CONSUMER_ROUTES.mePages.instagram}
          />
        </div>
      </section>
    </MeScreen>
  );
}
