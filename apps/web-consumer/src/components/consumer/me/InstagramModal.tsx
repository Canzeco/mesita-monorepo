"use client";

import { useState } from "react";
import { BadgeCheck, Copy } from "lucide-react";
import { Instagram } from "@/components/shared/instagram-icon";
import { cn, errMsg } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { MeScreen } from "@/components/consumer/me/MeScreen";
import { Spinner } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { SectionEyebrow } from "@/components/consumer/me/settings-rows";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import {
  apiCheckInstagramClaim,
  apiStartInstagramClaim,
} from "@/lib/api/profile";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { useConsumerIdentity } from "@/lib/identity-context";
import { INSTAGRAM_REACH_FOLLOWERS } from "@/lib/consumer-identity";
import { INSTAGRAM_ICON_GRADIENT_CLASS } from "@/lib/ui-classes";

// Instagram connect page (MESITA-936): one Why box → Connect.
//
// IT GRANTS NOTHING (Pato, MESITA-2040: "instagram is just 1000 followers").
// A connected handle is an identity fact; crossing the bar makes the account
// VERIFIED. The bar lives in `INSTAGRAM_REACH_FOLLOWERS` and this file names
// it once.
//
// CONNECTING IS PROOF (MESITA-2461). The guest gets a one-time code, puts it
// in their Instagram bio, and the server reads it there before it stores the
// handle — with the follower count IT scraped. This page used to send a
// fixed 5,000 and an 8-digit "code" nobody checked, so anyone could show up
// in Social as @someone_famous.

const HANDLE_RE = /^@?[A-Za-z0-9._]{1,30}$/;

const WHY_LINES = [
  `${INSTAGRAM_REACH_FOLLOWERS.toLocaleString("en-US")}+ followers and you're verified on Mesita — free, automatic, and nothing to apply for.`,
] as const;

export function InstagramModal() {
  const supabase = useBrowserSupabase();
  const identity = useConsumerIdentity();
  const connected = identity.igConnected;
  const [handle, setHandle] = useState("");
  // The pending claim: set once the server has issued a code for `handle`.
  const [claim, setClaim] = useState<{ handle: string; code: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  // A CONNECTED GUEST IS NOT A PROSPECT (decision: Pato, 2026-08-22). The
  // page used to render the pitch AND the whole connect form under the card
  // that already said "connected". Connected collapses to the account card;
  // switching accounts is a real but rare need, so it gets one quiet link
  // that brings the form back rather than the form standing open forever.
  const [switching, setSwitching] = useState(false);
  const showForm = !connected || switching;

  const canStart = HANDLE_RE.test(handle.trim()) && !busy;

  async function start() {
    if (!canStart) return;
    setBusy(true);
    try {
      setClaim(
        await apiStartInstagramClaim(
          supabase,
          handle.trim().replace(/^@/, "").toLowerCase(),
        ),
      );
    } catch (e) {
      toast(errMsg(e, "Couldn’t get a code — try again."));
    } finally {
      setBusy(false);
    }
  }

  async function check() {
    if (!claim || busy) return;
    setBusy(true);
    try {
      await apiCheckInstagramClaim(supabase);
      // ALWAYS A FULL RELOAD: a connected handle is a new fact on every
      // surface that reads it, and the identity is seeded server-side by the
      // shell layout, so every successful claim re-seeds the same way. A
      // soft `router.back()` left the header chip stale.
      window.location.assign(
        new URL(
          `${CONSUMER_ROUTES.me}?instagram=success`,
          window.location.origin,
        ),
      );
    } catch (e) {
      toast(errMsg(e, "Couldn’t check — try again."));
      setBusy(false);
    }
  }

  return (
    <MeScreen title="Instagram">
      <div className="mb-4 flex items-center gap-3">
        <span
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white",
            INSTAGRAM_ICON_GRADIENT_CLASS,
          )}
        >
          <Instagram className="h-5 w-5" />
        </span>
        <p className="text-muted-foreground text-xs">
          {INSTAGRAM_REACH_FOLLOWERS.toLocaleString("en-US")}+ followers
          verifies you.
        </p>
      </div>

        <div className="flex flex-col gap-3">
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
              claim={claim}
              busy={busy}
              canStart={canStart}
              onHandleChange={(v) => {
                setHandle(v);
                // A different handle needs its own code.
                setClaim(null);
              }}
              onStart={start}
              onCheck={check}
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
    </MeScreen>
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
  claim,
  busy,
  canStart,
  onHandleChange,
  onStart,
  onCheck,
}: {
  handle: string;
  claim: { handle: string; code: string } | null;
  busy: boolean;
  canStart: boolean;
  onHandleChange: (v: string) => void;
  onStart: () => void;
  onCheck: () => void;
}) {
  async function copyCode() {
    if (!claim) return;
    try {
      await navigator.clipboard.writeText(claim.code);
      toast("Code copied");
    } catch {
      toast("Couldn’t copy — type it in instead.");
    }
  }

  return (
    <section className="border-border bg-card rounded-2xl border p-4">
      {/* `font-bold`, not extrabold: the design law caps weight at two steps
          (semibold / bold) and a third one on a 14px heading buys nothing. */}
      <h3 className="mb-3 text-sm leading-tight font-bold tracking-tight">
        Connect Instagram
      </h3>
      <ol className="flex flex-col gap-3">
        {[
          <>Type your @handle and get a code</>,
          <>Add the code anywhere in your Instagram bio</>,
          <>Tap Check. You can remove the code afterwards</>,
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
      {claim ? (
        <>
          <label className="text-muted-foreground type-label mt-2 block font-medium">
            Your code for @{claim.handle}
          </label>
          <button
            type="button"
            onClick={copyCode}
            className="border-border bg-muted/30 flex h-12 w-full items-center justify-center gap-2 rounded-xl border px-5 font-mono text-sm font-semibold tracking-wide"
          >
            {claim.code}
            <Copy className="text-muted-foreground h-4 w-4" />
          </button>
          <Button
            type="button"
            size="sm"
            onClick={onCheck}
            disabled={busy}
            className="mt-2 w-full rounded-xl text-sm font-semibold"
          >
            {busy ? (
              <Spinner size="sm" className="border-white/40 border-t-white" />
            ) : (
              <BadgeCheck className="h-4 w-4" />
            )}
            {busy ? "Checking your bio…" : "Check"}
          </Button>
        </>
      ) : (
        <Button
          type="button"
          size="sm"
          onClick={onStart}
          disabled={!canStart}
          className="mt-2 w-full rounded-xl text-sm font-semibold"
        >
          {busy && (
            <Spinner size="sm" className="border-white/40 border-t-white" />
          )}
          Get a code
        </Button>
      )}
      <p className="text-muted-foreground type-body mt-2 text-center">
        We never ask for your password.
      </p>
    </section>
  );
}

function CurrentConnectionCard() {
  const { igHandle: handle, igReach: verified } = useConsumerIdentity();

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
        <p className="text-muted-foreground text-xs">
          {verified ? "Verified" : "Connected"}
        </p>
      </div>
    </div>
  );
}
