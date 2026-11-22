"use client";

// /me/class — CLASS IS BACK (Pato, 2026-11-22, MESITA-4657: "make regular or
// vip clickable · add again a class page"). The guest's Class on top, drawn
// like the header's pill (Regular grey, VIP black with a crown); then the
// three steps to VIP, each ticked or not, and one button for the first step
// still open; then what VIP gets. The server computes consumers.guest_class
// (more than 5,000 followers on a public Instagram, MESITA-4639); this page
// only reads it and never decides it.

import { Check, Crown, UserRound, X } from "lucide-react";
import { MeScreen } from "@/components/consumer/me/MeScreen";
import { SettingsGroup, RowDivider } from "@/components/consumer/me/settings-rows";
import { PushLink } from "@/components/consumer/nav/PushLink";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { useConsumerIdentity, useServerProfile } from "@/lib/identity-context";
import { CLASS_LABEL, toGuestClass } from "@/lib/guest-standing";
import { cn } from "@/lib/utils";

/** The VIP bar as the guest reads it (the server's literal is in guest_class). */
const VIP_FOLLOWERS = 5000;

export function ClassModal() {
  const profile = useServerProfile();
  const { igConnected, igHandle, igFollowers } = useConsumerIdentity();
  const guestClass = toGuestClass(profile?.guest_class);
  const vip = guestClass === "vip";
  const isPublic = igConnected && profile?.instagram_is_private === false;
  const followers = igConnected ? igFollowers : 0;

  const steps = [
    {
      done: igConnected,
      label: "Connect your Instagram",
      sub: igConnected && igHandle ? `@${igHandle}` : "Not connected",
    },
    {
      done: isPublic,
      label: "Public account",
      sub: !igConnected
        ? "After you connect"
        : profile?.instagram_is_private === true
          ? "Yours is private"
          : profile?.instagram_is_private === false
            ? "Yours is public"
            : "Not read yet: Sync on Instagram",
    },
    {
      done: followers > VIP_FOLLOWERS,
      label: "More than 5,000 followers",
      sub: igConnected ? `You have ${followers.toLocaleString("en-US")}` : "After you connect",
    },
  ];
  // One door for the first step still open; both lead to Me › Instagram,
  // where connecting and Account privacy live (MESITA-4655).
  const next = vip
    ? null
    : !igConnected
      ? "Connect Instagram"
      : !isPublic
        ? "Make it public"
        : null;

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
          {vip ? (
            <Crown className="h-7 w-7" strokeWidth={2.25} aria-hidden />
          ) : (
            <UserRound className="text-muted-foreground h-7 w-7" strokeWidth={2.25} aria-hidden />
          )}
          <p className="text-xl font-bold tracking-tight">{CLASS_LABEL[guestClass]}</p>
          <p className={cn("type-label", vip ? "text-white/70" : "text-muted-foreground")}>
            {vip
              ? "You get VIP Offers at places that have them."
              : "VIP gets VIP Offers at places that have them."}
          </p>
        </div>

        <SettingsGroup title="How to be VIP">
          {steps.map((step, i) => (
            <div key={step.label}>
              {i > 0 && <RowDivider />}
              <div className="flex items-center gap-3 px-4 py-3" data-class-step={step.done ? "done" : "open"}>
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                    step.done ? "bg-foreground text-paper" : "bg-muted text-muted-foreground",
                  )}
                  aria-hidden
                >
                  {step.done ? (
                    <Check className="h-4 w-4" strokeWidth={3} />
                  ) : (
                    <X className="h-4 w-4" strokeWidth={2.5} />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{step.label}</span>
                  <span className="text-muted-foreground type-label block truncate">{step.sub}</span>
                </span>
              </div>
            </div>
          ))}
        </SettingsGroup>

        {next && (
          <PushLink
            href={CONSUMER_ROUTES.mePages.instagram}
            className="bg-foreground text-paper flex h-12 items-center justify-center rounded-xl text-sm font-semibold"
            data-class-next
          >
            {next}
          </PushLink>
        )}
        <p className="text-muted-foreground type-label px-1 text-center">
          Your Class updates when Instagram syncs.
        </p>
      </div>
    </MeScreen>
  );
}
