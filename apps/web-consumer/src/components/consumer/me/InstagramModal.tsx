"use client";

import { useState } from "react";
import { BadgeCheck, Instagram } from "lucide-react";
import { cn, errMsg } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { Spinner } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { SectionEyebrow } from "@/components/consumer/me/settings-rows";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { apiClaimInstagram } from "@/lib/api/profile";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { REACH_ENTRY_CLASS, identityForClassKey } from "@/lib/consumer-data";
import { useConsumerClass } from "@/lib/class-context";
import { InstagramEmulator } from "@/components/consumer/me/demo/InstagramEmulator";
import { DEMO_INSTAGRAM_FOLLOWERS } from "@/lib/instagram-demo";
import {
  INSTAGRAM_ICON_GRADIENT_CLASS,
  SHEET_TITLE_CLASS,
  SHEET_BODY_CLASS,
} from "@/lib/ui-classes";

// Instagram connect sheet (MESITA-936): DEMO → one Why box → Connect.
// Bar AND rung both come off REACH_ENTRY_CLASS, so the sentence can never
// quote one class’s threshold next to another class’s name. Neither half is
// written out here — no metal is named in this file, and the ladder
// (mirroring classes.follower_threshold) stays the only place either lives.

const HANDLE_RE = /^@?[A-Za-z0-9._]{1,30}$/;

const WHY_LINES = [
  `Your class updates automatically — ${REACH_ENTRY_CLASS.followerThreshold.toLocaleString("en-US")}+ followers puts you on ${REACH_ENTRY_CLASS.label}, free, and a better class means better Rewards.`,
  `Post Stories on your visits for even better Rewards.`,
];

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
  // A CONNECTED GUEST IS NOT A PROSPECT (decision: Pato, 2026-08-22). The
  // sheet used to render the pitch AND the whole DM-the-bot form under the
  // card that already said "connected" — three headings all saying connect,
  // and a form for a job that is done. Connected collapses to the account
  // card; switching accounts is a real but rare need, so it gets one quiet
  // link that brings the form back rather than the form standing open
  // forever.
  const [switching, setSwitching] = useState(false);
  const showForm = !connected || switching;

  const canVerify =
    HANDLE_RE.test(handle.trim()) && code.length >= 8 && !verifying;

  async function verify() {
    if (!canVerify) return;
    setVerifying(true);
    try {
      const result = await apiClaimInstagram(supabase, {
        followers: DEMO_INSTAGRAM_FOLLOWERS,
        handle: handle.trim().replace(/^@/, "").toLowerCase(),
      });
      // `tier` echoes the class key the SERVER wrote, which is still a legacy
      // key — so it goes through the bridge rather than being compared to one
      // (MESITA-1079). Any class off the floor means the claim granted reach.
      if (identityForClassKey(result.tier).cls !== "bronze") {
        window.location.href = `${CONSUMER_ROUTES.me}?instagram=success`;
        return;
      }
      toast("Connected — Rewards unlocked.");
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
            <p className="text-muted-foreground text-xs">
              Connect Instagram for better Rewards.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <InstagramEmulator />

          {connected && (
            <section className="flex flex-col gap-2">
              <SectionEyebrow>Connected</SectionEyebrow>
              <CurrentConnectionCard />
            </section>
          )}

          {/* The pitch is for people who haven't connected. Once they have,
              it is the app arguing with a decision the guest already made. */}
          {!connected && <WhyConnectModule />}

          {showForm && (
            <ConnectModule
              handle={handle}
              code={code}
              verifying={verifying}
              canVerify={canVerify}
              onHandleChange={setHandle}
              onCodeChange={setCode}
              onVerify={verify}
            />
          )}

          {connected && !switching && (
            <button
              type="button"
              onClick={() => setSwitching(true)}
              className="text-muted-foreground hover:text-foreground type-body min-h-11 font-medium underline underline-offset-4 transition"
            >
              Connect a different account
            </button>
          )}
        </div>
      </div>
    </LocalSheet>
  );
}

function WhyConnectModule() {
  return (
    <article className="border-border bg-card rounded-2xl border p-4">
      <h3 className="text-sm leading-tight font-bold tracking-tight">
        Why connect
      </h3>
      <ul className="mt-2 flex flex-col gap-2">
        {WHY_LINES.map((line) => (
          <li
            key={line}
            className="type-body flex items-start gap-2.5 leading-snug font-medium"
          >
            <span className="bg-secondary mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full" />
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

function ConnectModule({
  handle,
  code,
  verifying,
  canVerify,
  onHandleChange,
  onCodeChange,
  onVerify,
}: {
  handle: string;
  code: string;
  verifying: boolean;
  canVerify: boolean;
  onHandleChange: (v: string) => void;
  onCodeChange: (v: string) => void;
  onVerify: () => void;
}) {
  return (
    <section className="border-border bg-card rounded-2xl border p-4">
      {/* `font-bold`, not extrabold: the design law caps weight at two steps
          (semibold / bold) and a third one on a 14px heading buys nothing. */}
      <h3 className="mb-3 text-sm leading-tight font-bold tracking-tight">
        Connect Instagram
      </h3>
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
          <li key={i} className="type-body flex items-start gap-3 leading-snug">
            <span className="bg-secondary/15 text-secondary type-label flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-bold">
              {i + 1}
            </span>
            <span>{line}</span>
          </li>
        ))}
      </ol>
      <label className="text-muted-foreground type-label mt-3 block font-medium">
        @handle
      </label>
      <input
        value={handle}
        onChange={(e) => onHandleChange(e.target.value)}
        placeholder="yourhandle"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className="border-border bg-muted/30 placeholder:text-muted-foreground/70 h-12 w-full rounded-xl border px-5 text-center text-sm outline-none"
        maxLength={31}
      />
      <label className="text-muted-foreground type-label mt-2 block font-medium">
        8-digit code
      </label>
      <input
        value={code}
        onChange={(e) => onCodeChange(e.target.value)}
        placeholder="12345678"
        className="border-border bg-muted/30 placeholder:text-muted-foreground/70 h-12 w-full rounded-xl border px-5 text-center text-sm outline-none"
        maxLength={8}
      />
      <Button
        type="button"
        size="sm"
        onClick={onVerify}
        disabled={!canVerify}
        className="mt-2 w-full rounded-xl text-sm font-semibold"
      >
        {verifying ? (
          <Spinner size="sm" className="border-white/40 border-t-white" />
        ) : (
          <BadgeCheck className="h-4 w-4" />
        )}
        {verifying ? "Connecting…" : "Verify"}
      </Button>
      <p className="text-muted-foreground type-label mt-2 text-center">
        We never ask for your password.
      </p>
    </section>
  );
}

function CurrentConnectionCard() {
  const { handle } = useConsumerClass();

  return (
    <div className="border-border bg-card flex items-center gap-3 rounded-2xl border p-4">
      <span
        className={cn(
          "shadow-rest flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white",
          INSTAGRAM_ICON_GRADIENT_CLASS,
        )}
      >
        <Instagram className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold tracking-tight">
          {handle ? `@${handle}` : "Instagram connected"}
        </p>
        <p className="text-muted-foreground text-xs">Rewards unlocked</p>
      </div>
    </div>
  );
}
