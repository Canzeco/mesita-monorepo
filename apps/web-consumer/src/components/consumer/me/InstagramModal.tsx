"use client";

import { useState } from "react";
import { BadgeCheck, Instagram } from "lucide-react";
import { cn, errMsg } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { Spinner } from "@/components/shared/Spinner";
import { SectionEyebrow } from "@/components/consumer/me/settings-rows";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { apiClaimInstagram } from "@/lib/api/profile";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import {
  useConsumerClass,
  useMockAccount,
  setMockAccount,
} from "@/lib/class-context";
import { DEMO_INSTAGRAM_FOLLOWERS } from "@/lib/instagram-demo";
import {
  INSTAGRAM_ICON_GRADIENT_CLASS,
  SHEET_TITLE_CLASS,
  SHEET_BODY_CLASS,
} from "@/lib/ui-classes";

// Instagram connect sheet (IB2): why-connect first, then verify, demo last.
// Zero quantitative claims on this surface — no %, follower thresholds, or
// rate numbers. Class modal owns the Influencer door math.

const HANDLE_RE = /^@?[A-Za-z0-9._]{1,30}$/;

const WHY_CONNECT_PERKS = [
  {
    label: "Show up in the feed",
    support: "Other Mesita guests can see you in Social.",
  },
  {
    label: "Share & like stories",
    support: "React to guests’ stories inside Mesita.",
  },
  {
    label: "Story Bonus on visits",
    support: "Tag Mesita in a story at the place — bonus on that visit.",
  },
  {
    label: "Influencer, when you qualify",
    support: "Connecting is how reach can upgrade your class later.",
  },
] as const;

export function InstagramModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const supabase = useBrowserSupabase();
  const { origin } = useConsumerClass();
  const connected = origin === "instagram";
  const [handle, setHandle] = useState("");
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  const canVerify =
    HANDLE_RE.test(handle.trim()) && code.length >= 8 && !verifying;

  // Real claim through consumer-web-claim-instagram. Success copy stays
  // social-first — never explain the follower bar on this sheet.
  async function verify() {
    if (!canVerify) return;
    setVerifying(true);
    try {
      const result = await apiClaimInstagram(supabase, {
        followers: DEMO_INSTAGRAM_FOLLOWERS,
        handle: handle.trim().replace(/^@/, "").toLowerCase(),
      });
      if (result.tier === "influencer") {
        window.location.href = `${CONSUMER_ROUTES.me}?instagram=success`;
        return;
      }
      toast("Connected — you’re in Social.");
      setVerifying(false);
      onClose();
    } catch (e) {
      toast(errMsg(e, "Couldn’t verify — try again."));
      setVerifying(false);
    }
  }

  return (
    <LocalSheet open={open} onClose={onClose} ariaLabel="Instagram">
      <div className={cn(SHEET_BODY_CLASS, "pt-3")}>
        <div className="mb-4 flex items-center gap-3">
          <span
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white",
              INSTAGRAM_ICON_GRADIENT_CLASS,
            )}
          >
            <Instagram className="h-5 w-5" />
          </span>
          <div>
            <h2 className={SHEET_TITLE_CLASS}>Instagram</h2>
            <p className="text-muted-foreground text-[12px]">
              Connect to join Social — feed, stories, and visit bonuses.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          {connected && (
            <section className="flex flex-col gap-2">
              <SectionEyebrow>Connected</SectionEyebrow>
              <CurrentConnectionCard />
            </section>
          )}

          <section className="flex flex-col gap-2">
            <SectionEyebrow>Why connect</SectionEyebrow>
            <WhyConnectModule />
          </section>

          <section className="flex flex-col gap-2">
            <SectionEyebrow>Connect</SectionEyebrow>
            <ol className="flex flex-col gap-3">
              {[
                <>
                  DM <span className="text-secondary font-semibold">@mesita.bot</span>{" "}
                  the word{" "}
                  <span className="text-secondary font-mono font-semibold">
                    VERIFY
                  </span>
                </>,
                <>Paste the 8-digit code here</>,
              ].map((line, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 text-[13px] leading-snug"
                >
                  <span className="bg-secondary/15 text-secondary flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold">
                    {i + 1}
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ol>
            <label className="text-muted-foreground mt-2 text-[11px] font-medium">
              @handle
            </label>
            <input
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="@handle"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="border-border bg-muted/30 placeholder:text-muted-foreground/70 h-12 w-full rounded-lg border px-5 text-center text-sm outline-none"
              maxLength={31}
            />
            <label className="text-muted-foreground text-[11px] font-medium">
              8-digit code
            </label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="8-digit code"
              className="border-border bg-muted/30 placeholder:text-muted-foreground/70 h-12 w-full rounded-lg border px-5 text-center text-sm outline-none"
              maxLength={8}
            />
            <button
              type="button"
              onClick={verify}
              disabled={!canVerify}
              className="bg-pink-gradient mt-1 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold text-white transition disabled:opacity-60"
            >
              {verifying ? (
                <Spinner size="sm" className="border-white/40 border-t-white" />
              ) : (
                <BadgeCheck className="h-4 w-4" />
              )}
              {verifying ? "Connecting…" : "Verify"}
            </button>
            <p className="text-muted-foreground mt-1 text-center text-[11px]">
              We never ask for your password.
            </p>
          </section>

          <InstagramEmulator />
        </div>
      </div>
    </LocalSheet>
  );
}

// ─── Why connect (IB2 — zero numbers) ──────────────────────────────────────

function WhyConnectModule() {
  return (
    <div className="border-border bg-card overflow-hidden rounded-2xl border">
      {WHY_CONNECT_PERKS.map((perk, i) => (
        <div
          key={perk.label}
          className={cn(
            "px-4 py-3",
            i > 0 && "border-border border-t",
          )}
        >
          <p className="text-[14px] leading-tight font-bold tracking-tight">
            {perk.label}
          </p>
          <p className="text-muted-foreground mt-1 text-[12px] leading-snug">
            {perk.support}
          </p>
        </div>
      ))}
    </div>
  );
}

// ─── Current connection ────────────────────────────────────────────────────

function CurrentConnectionCard() {
  const { handle } = useConsumerClass();

  return (
    <div className="border-border bg-card flex items-center gap-3 rounded-2xl border p-4">
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm",
          INSTAGRAM_ICON_GRADIENT_CLASS,
        )}
      >
        <Instagram className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-bold tracking-tight">
          {handle ? `@${handle}` : "Instagram connected"}
        </p>
        <p className="text-muted-foreground text-[12px]">You’re in Social</p>
      </div>
    </div>
  );
}

// ─── Demo emulator (footer ghost module) ───────────────────────────────────

function InstagramEmulator() {
  const mock = useMockAccount();
  const igOn = mock?.instagram ?? false;
  const followers = mock?.followers ?? DEMO_INSTAGRAM_FOLLOWERS;

  return (
    <div className="border-border/50 rounded-2xl border border-dashed p-3 opacity-80">
      <div className="flex min-h-11 items-center gap-1.5">
        <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold tracking-[0.12em] text-amber-600 uppercase">
          Demo
        </span>
        <span className="text-muted-foreground text-[11px] font-medium">
          Preview connected
        </span>
        <span className="ml-auto">
          <button
            type="button"
            role="switch"
            aria-checked={igOn}
            aria-label="Preview connected Instagram"
            onClick={() => setMockAccount({ instagram: !igOn })}
            className={cn(
              "relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition",
              igOn ? "bg-primary" : "bg-muted",
            )}
          >
            <span
              className={cn(
                "inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition",
                igOn ? "translate-x-[18px]" : "translate-x-[2px]",
              )}
            />
          </button>
        </span>
      </div>
      {igOn && (
        <div className="mt-2.5 flex items-center gap-2">
          <label
            htmlFor="mock-ig-followers"
            className="text-muted-foreground text-[11px] font-medium"
          >
            Demo count
          </label>
          <input
            id="mock-ig-followers"
            inputMode="numeric"
            value={followers}
            onChange={(e) => {
              const n = Number(e.target.value.replace(/[^\d]/g, ""));
              setMockAccount({ followers: Number.isFinite(n) ? n : 0 });
            }}
            className="border-border bg-muted/30 h-8 w-24 rounded-lg border px-2.5 text-right text-[12px] font-semibold outline-none"
          />
          <span className="text-muted-foreground ml-auto text-[10px]">
            Class preview uses this
          </span>
        </div>
      )}
    </div>
  );
}
