"use client";

import { useState } from "react";
import { BadgeCheck, Camera, Instagram, Megaphone } from "lucide-react";
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
import { INFLUENCER_FOLLOWER_THRESHOLD } from "@/lib/consumer-data";
import { REWARD_SEGMENT_BY_KEY, PEAK_STRATEGY } from "@/lib/reward-segments";
import { DEMO_INSTAGRAM_FOLLOWERS } from "@/lib/instagram-demo";
import {
  INSTAGRAM_ICON_GRADIENT_CLASS,
  SHEET_TITLE_CLASS,
  SHEET_BODY_CLASS,
} from "@/lib/ui-classes";

// The Instagram surface — a bottom sheet the Me page opens from the Instagram
// box (and the Class modal's "Join with Instagram" door). Three labeled
// sections top to bottom, mirroring the Class modal's structure:
//   emulator          — the demo Instagram toggle + editable follower count
//                       (moved here from the old Me-page MockControls; the
//                       class emulator lives on the Class modal)
//   current connection — the live IG state off useConsumerClass()
//   connect            — the real @mesita.bot verify flow
//                       (consumer-web-claim-instagram; replaces the old
//                       VerifySocialSheet)
//
// Built on LocalSheet: state-driven (parent keeps it mounted and flips
// `open`) so the exit animation plays, backdrop covers the whole MobileFrame
// card, and ESC closes it.

// The @mesita.bot DM bot doesn't exist yet, so the follower count can't be
// read from a real social-graph check. Until the bot ships, any 8-digit code
// verifies and the claim is sent with the demo count (comfortably past the
// Influencer follower threshold) — but the grant itself is REAL: the EF
// persists the handle + count and sets class_key=influencer / origin=instagram
// server-side. Swap the constant for the bot-reported count when it lands.
const HANDLE_RE = /^@?[A-Za-z0-9._]{1,30}$/;

function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}

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

  // Real claim through consumer-web-claim-instagram: persists the @handle and
  // follower count, grants Influencer (origin "instagram") at the threshold;
  // below it the consumer stays on their best remaining door. On an
  // Influencer grant we hard-navigate so the shell re-seeds with the class.
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
      toast(
        `Instagram connected, but ${formatCount(
          result.followers,
        )} followers is below the ${formatCount(
          INFLUENCER_FOLLOWER_THRESHOLD,
        )} needed for Influencer.`,
      );
      setVerifying(false);
    } catch (e) {
      toast(errMsg(e, "Couldn't verify your Instagram — try again."));
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
              Your reach unlocks Mesita Influencer
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <InstagramEmulator />

          {/* Connection status only when there IS one — the not-connected
              case is already told by the two cards below. */}
          {connected && (
            <section className="flex flex-col gap-2">
              <SectionEyebrow>Connected</SectionEyebrow>
              <CurrentConnectionCard />
            </section>
          )}

          <section className="flex flex-col gap-2">
            <SectionEyebrow>What your reach unlocks</SectionEyebrow>
            <ReachCards />
          </section>

          <section className="flex flex-col gap-2">
            <SectionEyebrow>Connect</SectionEyebrow>
            <ol className="flex flex-col gap-3">
              {[
                <>
                  DM <span className="text-secondary">@mesita.bot</span> the
                  word <span className="text-secondary font-mono">VERIFY</span>{" "}
                  on Instagram.
                </>,
                <>Paste the 8-digit code it replies with.</>,
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
              className="border-border bg-muted/30 placeholder:text-muted-foreground/70 mt-2 h-12 w-full rounded-lg border px-5 text-center text-sm outline-none"
              maxLength={31}
            />
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Paste 8-digit code"
              className="border-border bg-muted/30 placeholder:text-muted-foreground/70 h-12 w-full rounded-lg border px-5 text-center text-sm outline-none"
              maxLength={8}
            />
            <button
              type="button"
              onClick={verify}
              disabled={!canVerify}
              className="bg-pink-gradient mt-1 flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold text-white transition disabled:opacity-60"
            >
              {verifying ? (
                <Spinner size="sm" className="border-white/40 border-t-white" />
              ) : (
                <BadgeCheck className="h-4 w-4" />
              )}
              {verifying ? "Connecting…" : "Verify"}
            </button>
            <p className="text-muted-foreground mt-1 text-center text-[11px]">
              We never ask for your Instagram password.
            </p>
          </section>
        </div>
      </div>
    </LocalSheet>
  );
}

// ─── What your reach unlocks ───────────────────────────────────────────────

// One bar, two payoffs: ≥1,000 followers upgrades the WHOLE ACCOUNT to
// Influencer automatically; connecting Instagram (any follower count)
// unlocks the Story Bonus for every class (MESITA-909). Rates quote the
// reward ladder's peak (dominant) column so they always match the /rewards
// program summary.
function ReachCards() {
  const influencerRate = REWARD_SEGMENT_BY_KEY.influencer.rates[PEAK_STRATEGY];
  const storyRate = REWARD_SEGMENT_BY_KEY.story.rates[PEAK_STRATEGY];

  return (
    <div className="flex flex-col gap-2">
      <div className="border-border bg-card flex items-start gap-3 rounded-2xl border p-4">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white shadow-sm">
          <Megaphone className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-[14px] leading-tight font-bold tracking-tight">
            Influencer upgrade{" "}
            <span className="text-muted-foreground font-semibold">
              · {formatCount(INFLUENCER_FOLLOWER_THRESHOLD)}+ followers
            </span>
          </p>
          <p className="text-muted-foreground mt-1 text-[12px] leading-snug">
            Automatic — up to {influencerRate}% base at every Verified Partner.
          </p>
        </div>
      </div>

      <div className="border-border bg-card flex items-start gap-3 rounded-2xl border p-4">
        <span
          className={cn(
            "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm",
            INSTAGRAM_ICON_GRADIENT_CLASS,
          )}
        >
          <Camera className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-[14px] leading-tight font-bold tracking-tight">
            Instagram Story Bonus{" "}
            <span className="text-muted-foreground font-semibold">
              · any connected account
            </span>
          </p>
          <p className="text-muted-foreground mt-1 text-[12px] leading-snug">
            Post a tagged story at your visit — up to {storyRate}% off that
            bill, every visit. Connect Instagram to unlock.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Current connection ────────────────────────────────────────────────────

// Rendered only when the account IS connected (origin === "instagram") — the
// not-connected case is carried by the reach cards.
function CurrentConnectionCard() {
  const { followers, handle } = useConsumerClass();

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
        <p className="text-muted-foreground text-[12px]">
          {formatCount(followers)} followers
        </p>
      </div>
      <span className="flex shrink-0 items-center gap-1 rounded-full bg-sky-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm">
        <Megaphone className="h-3 w-3" />
        Influencer
      </span>
    </div>
  );
}

// ─── Demo emulator ─────────────────────────────────────────────────────────

// The Instagram half of the demo override (the class half lives on the Class
// modal's preview toggle). Toggling on emulates a connected IG with an
// editable follower count; crossing INFLUENCER_FOLLOWER_THRESHOLD grants
// Influencer via Instagram over the class axis, exactly like the real claim
// EF. Remove with the MOCK_ paths once the states can be produced with real
// data.
function InstagramEmulator() {
  const mock = useMockAccount();
  const igOn = mock?.instagram ?? false;
  const followers = mock?.followers ?? DEMO_INSTAGRAM_FOLLOWERS;
  const igInfluencer = igOn && followers >= INFLUENCER_FOLLOWER_THRESHOLD;

  return (
    <div className="border-border/70 rounded-2xl border border-dashed p-3">
      <div className="flex items-center gap-1.5">
        <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold tracking-[0.12em] text-amber-600 uppercase">
          Demo
        </span>
        <span className="text-muted-foreground text-[11px] font-medium">
          Emulate a connected Instagram
        </span>
        <span className="ml-auto">
          <button
            type="button"
            role="switch"
            aria-checked={igOn}
            aria-label="Emulate Instagram"
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
            Followers
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
          <span
            className={cn(
              "ml-auto text-[10.5px] font-semibold",
              igInfluencer ? "text-sky-700" : "text-muted-foreground",
            )}
          >
            {formatCount(INFLUENCER_FOLLOWER_THRESHOLD)}+ = Influencer
          </span>
        </div>
      )}
    </div>
  );
}
