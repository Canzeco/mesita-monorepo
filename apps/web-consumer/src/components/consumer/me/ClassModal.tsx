"use client";

// /me/class — CLASS IS BACK (Pato, 2026-11-22, MESITA-4657: "make regular or
// vip clickable · add again a class page"). CLEANER (Pato, 2026-11-22,
// MESITA-4659): one status box (Regular or VIP, big, and what VIP gets), then
// "How to be VIP" as a checklist of exactly two rows (a check or an empty
// circle), then one action: Connect Instagram when none is linked, else Sync
// (Me › Instagram's own sync, its result and refusals shown the same way).
// The server computes consumers.guest_class (an Instagram with more than
// 5,000 followers, MESITA-4639; public or private since MESITA-4659, which
// removed the "Public account" step and its "Make it public" button); this
// page only reads it and never decides it.

import { useState } from "react";
import { Check, Crown, RefreshCw, Tag } from "lucide-react";
import { VIP_MIN_FOLLOWERS } from "@mesita/place-profile";
import { MeScreen } from "@/components/consumer/me/MeScreen";
import { SettingsGroup, RowDivider } from "@/components/consumer/me/settings-rows";
import {
  landHere,
  syncErrorCopy,
  useLandingToast,
} from "@/components/consumer/me/InstagramModal";
import { PushLink } from "@/components/consumer/nav/PushLink";
import { apiSyncInstagram } from "@/lib/api/profile";
import { EFError } from "@/lib/api/_invoke";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { useConsumerIdentity, useServerProfile } from "@/lib/identity-context";
import { CLASS_LABEL, toGuestClass } from "@/lib/guest-standing";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

/** The page's one action: a full-width dark button (MESITA-4659). */
const ACTION_CLASS =
  "bg-foreground text-paper flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition disabled:pointer-events-none disabled:opacity-60";

export function ClassModal() {
  const supabase = useBrowserSupabase();
  const profile = useServerProfile();
  const { igConnected, igHandle, igFollowers } = useConsumerIdentity();
  const guestClass = toGuestClass(profile?.guest_class);
  const vip = guestClass === "vip";
  const followers = igConnected ? igFollowers : 0;
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<{ text: string; reload: boolean } | null>(null);
  // A Sync lands back here with its toast, as on Me › Instagram.
  useLandingToast();

  async function sync() {
    if (syncing) return;
    setMessage(null);
    setSyncing(true);
    try {
      landHere(await apiSyncInstagram(supabase));
    } catch (err) {
      if (err instanceof EFError && (err.code === "changed" || err.code === "not_connected")) {
        window.location.reload();
        return;
      }
      const unknown = !(err instanceof EFError) || (err.code == null && err.status == null);
      setMessage({ text: syncErrorCopy(err, igHandle), reload: unknown });
      setSyncing(false);
    }
  }

  const steps = [
    { done: igConnected, label: "Connect your Instagram", sub: null },
    {
      done: igConnected && followers > VIP_MIN_FOLLOWERS,
      label: `More than ${VIP_MIN_FOLLOWERS.toLocaleString("en-US")} followers`,
      sub: igConnected ? `You have ${followers.toLocaleString("en-US")}` : "Connect to count",
    },
  ];

  return (
    <MeScreen title="Class">
      <div className="flex flex-col gap-4">
        <div
          className={cn(
            "flex flex-col items-center gap-2 rounded-2xl px-4 py-6 text-center",
            vip ? "bg-neutral-950 text-white" : "bg-muted text-foreground",
          )}
          data-class-current={guestClass}
        >
          {/* A crown for every Class (MESITA-4667/4687). */}
          <Crown className={cn("h-7 w-7", !vip && "text-muted-foreground")} strokeWidth={2.25} aria-hidden />
          <p className="text-xl font-bold tracking-tight">{CLASS_LABEL[guestClass]}</p>
        </div>

        {/* WHY BE VIP (Pato, 2026-11-22, MESITA-4687: "mention why to be VIP
            … BETTER OFFERS"): one perk, said once, above the steps. */}
        <SettingsGroup title={vip ? "What VIP gets you" : "Why be VIP"}>
          <div className="flex items-center gap-3 px-4 py-3" data-class-perk>
            <span className="bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-full" aria-hidden>
              <Tag className="h-4 w-4" strokeWidth={2.25} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">Better offers</span>
              <span className="text-muted-foreground type-label block">
                VIP Offers with bigger bonuses, like Pay $100 · Get $200, at places that have them.
              </span>
            </span>
          </div>
        </SettingsGroup>

        <SettingsGroup title="How to be VIP">
          {steps.map((step, i) => (
            <div key={step.label}>
              {i > 0 && <RowDivider />}
              <div className="flex items-center gap-3 px-4 py-3" data-class-step={step.done ? "done" : "open"}>
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                    step.done ? "bg-foreground text-paper" : "border-border border-2",
                  )}
                  aria-hidden
                >
                  {step.done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{step.label}</span>
                  {step.sub ? (
                    <span className="text-muted-foreground type-label block truncate">{step.sub}</span>
                  ) : null}
                </span>
                <span className="sr-only">{step.done ? "Done" : "Not yet"}</span>
              </div>
            </div>
          ))}
        </SettingsGroup>

        {igConnected ? (
          <div className="flex flex-col gap-2">
            <button type="button" onClick={() => void sync()} disabled={syncing} className={ACTION_CLASS} data-class-sync>
              <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} aria-hidden />
              {syncing ? "Syncing…" : "Sync"}
            </button>
            <div aria-live="polite">
              {syncing ? (
                <p className="text-muted-foreground type-label px-1 text-center">
                  Reading your Instagram. This can take up to a minute.
                </p>
              ) : message ? (
                <p className="text-destructive type-label px-1 text-center" data-instagram-sync-error>
                  {message.text}{" "}
                  {message.reload && (
                    <button type="button" onClick={() => window.location.reload()} className="underline underline-offset-2">
                      Reload
                    </button>
                  )}
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <PushLink href={CONSUMER_ROUTES.mePages.instagram} className={ACTION_CLASS} data-class-next>
            Connect Instagram
          </PushLink>
        )}
      </div>
    </MeScreen>
  );
}
