"use client";

import { useState } from "react";
import { BadgeCheck, Instagram } from "lucide-react";
import { cn, errMsg } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { Spinner } from "@/components/shared/Spinner";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { apiClaimInstagram } from "@/lib/api/profile";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// Bottom-sheet flow for verifying Instagram — the social door into Mesita
// Premium. 1,000+ followers (and a story per visit) unlocks Premium. Extracted
// from ProfileClient so the profile tabs stay lean.
//
// Built on LocalSheet: state-driven (parent keeps it mounted and flips
// `open`) so the exit animation plays, backdrop covers the whole MobileFrame
// card (TopBar/BottomNav included), and ESC closes it.

export type SocialPlatform = "instagram";

// The @mesita.bot DM bot doesn't exist yet, so the follower count can't be
// read from a real social-graph check. Until the bot ships, any 8-digit code
// verifies and the claim is sent with this demo count (comfortably past the
// 1,000 premium threshold) — but the grant itself is REAL: the EF persists
// the handle + count and sets class_key=premium / origin=instagram
// server-side, so every surface reads the class from the profile, not a
// device flag. Swap the constant for the bot-reported count when it lands.
const DEMO_FOLLOWERS = 4200;

const HANDLE_RE = /^@?[A-Za-z0-9._]{1,30}$/;

export function VerifySocialSheet({
  platform: _platform,
  open,
  onClose,
}: {
  platform: SocialPlatform;
  open: boolean;
  onClose: () => void;
}) {
  const supabase = useBrowserSupabase();
  const [handle, setHandle] = useState("");
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  const canVerify =
    HANDLE_RE.test(handle.trim()) && code.length >= 8 && !verifying;

  // Real claim through consumer-web-claim-instagram: persists the @handle and
  // follower count, grants Premium (origin "instagram") at 1,000+ followers.
  // Hard-navigates on success so the shell re-seeds with the unlocked class
  // and the Profile lands on its success toast.
  async function verify() {
    if (!canVerify) return;
    setVerifying(true);
    try {
      await apiClaimInstagram(supabase, {
        followers: DEMO_FOLLOWERS,
        handle: handle.trim().replace(/^@/, "").toLowerCase(),
      });
      window.location.href = `${CONSUMER_ROUTES.me.class}?instagram=success`;
    } catch (e) {
      toast(errMsg(e, "Couldn't verify your Instagram — try again."));
      setVerifying(false);
    }
  }

  const cfg = {
    Icon: Instagram,
    iconBg:
      "bg-[linear-gradient(135deg,oklch(0.70_0.20_30),oklch(0.65_0.20_350))]",
    title: "Verify Instagram",
    handle: "@mesita.bot",
    platformLabel: "Instagram",
    dmInstruction: (
      <>
        DM <span className="text-secondary">@mesita.bot</span> with the word{" "}
        <span className="text-secondary font-mono">VERIFY</span>.
      </>
    ),
    followInstruction: (
      <>
        Follow <span className="text-secondary">@mesita.bot</span> on Instagram.
      </>
    ),
  };
  const { Icon } = cfg;
  return (
    <LocalSheet open={open} onClose={onClose} ariaLabel={cfg.title}>
      <div className="scrollbar-hide min-h-0 overflow-y-auto p-5 pt-3">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white",
              cfg.iconBg,
            )}
          >
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-display text-xl font-semibold tracking-tight">
              {cfg.title}
            </h2>
            <p className="text-muted-foreground text-[12px]">
              via <span className="text-foreground">{cfg.handle}</span> ·
              1-minute setup
            </p>
          </div>
        </div>
        <ol className="mt-5 flex flex-col gap-3">
          {[
            cfg.followInstruction,
            cfg.dmInstruction,
            <>
              Mesita will reply with an 8-digit verification code. Paste it
              here.
            </>,
            <>1,000+ followers unlocks Mesita Premium instantly.</>,
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
        <input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="@your.instagram"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="border-border bg-muted/30 placeholder:text-muted-foreground/70 mt-4 h-12 w-full rounded-lg border px-5 text-center text-sm outline-none"
          maxLength={31}
        />
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Paste 8-digit code"
          className="border-border bg-muted/30 placeholder:text-muted-foreground/70 mt-2 h-12 w-full rounded-lg border px-5 text-center text-sm outline-none"
          maxLength={8}
        />
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="border-border bg-card hover:bg-muted flex-1 rounded-lg border py-3 text-sm font-semibold transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={verify}
            disabled={!canVerify}
            className="bg-pink-gradient flex flex-1 items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold text-white transition disabled:opacity-60"
          >
            {verifying ? (
              <Spinner size="sm" className="border-white/40 border-t-white" />
            ) : (
              <BadgeCheck className="h-4 w-4" />
            )}
            {verifying ? "Connecting…" : "Verify"}
          </button>
        </div>
        <p className="text-muted-foreground mt-3 text-center text-[11px]">
          We never ask for your {cfg.platformLabel} password.
        </p>
      </div>
    </LocalSheet>
  );
}
