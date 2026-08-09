"use client";

import { useState } from "react";
import { BadgeCheck, Instagram } from "lucide-react";
import { cn, errMsg } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { Spinner } from "@/components/shared";
import { SectionEyebrow } from "@/components/consumer/me/settings-rows";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { apiClaimInstagram } from "@/lib/api/profile";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { INFLUENCER_FOLLOWER_THRESHOLD } from "@/lib/consumer-data";
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

// Instagram connect sheet (MESITA-936): DEMO → one Why box → Connect.
// Threshold from INFLUENCER_FOLLOWER_THRESHOLD (2,000 — MESITA-911).

const HANDLE_RE = /^@?[A-Za-z0-9._]{1,30}$/;

const WHY_COPY = `Add Instagram to unlock better Rewards. Optionally post Stories for even better Rewards on visits — and with ${INFLUENCER_FOLLOWER_THRESHOLD.toLocaleString("en-US")}+ followers you automatically upgrade to Influencer for free.`;

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
            <p className="text-muted-foreground text-[12px]">
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

          <WhyConnectModule />

          <ConnectModule
            handle={handle}
            code={code}
            verifying={verifying}
            canVerify={canVerify}
            onHandleChange={setHandle}
            onCodeChange={setCode}
            onVerify={verify}
          />
        </div>
      </div>
    </LocalSheet>
  );
}

function WhyConnectModule() {
  return (
    <article className="border-border bg-card rounded-2xl border p-4">
      <h3 className="text-[14px] leading-tight font-extrabold tracking-tight">
        Why connect
      </h3>
      <p className="mt-2 text-[13px] leading-snug font-medium">{WHY_COPY}</p>
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
      <h3 className="mb-3 text-[14px] leading-tight font-extrabold tracking-tight">
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
      <label className="text-muted-foreground mt-3 block text-[11px] font-medium">
        @handle
      </label>
      <input
        value={handle}
        onChange={(e) => onHandleChange(e.target.value)}
        placeholder="@handle"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className="border-border bg-muted/30 placeholder:text-muted-foreground/70 h-12 w-full rounded-lg border px-5 text-center text-sm outline-none"
        maxLength={31}
      />
      <label className="text-muted-foreground mt-2 block text-[11px] font-medium">
        8-digit code
      </label>
      <input
        value={code}
        onChange={(e) => onCodeChange(e.target.value)}
        placeholder="8-digit code"
        className="border-border bg-muted/30 placeholder:text-muted-foreground/70 h-12 w-full rounded-lg border px-5 text-center text-sm outline-none"
        maxLength={8}
      />
      <button
        type="button"
        onClick={onVerify}
        disabled={!canVerify}
        className="bg-pink-gradient mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold text-white transition disabled:opacity-60"
      >
        {verifying ? (
          <Spinner size="sm" className="border-white/40 border-t-white" />
        ) : (
          <BadgeCheck className="h-4 w-4" />
        )}
        {verifying ? "Connecting…" : "Verify"}
      </button>
      <p className="text-muted-foreground mt-2 text-center text-[11px]">
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
        <p className="text-muted-foreground text-[12px]">Rewards unlocked</p>
      </div>
    </div>
  );
}

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
            onClick={() =>
              setMockAccount(
                igOn
                  ? { instagram: false }
                  : {
                      instagram: true,
                      followers: DEMO_INSTAGRAM_FOLLOWERS,
                    },
              )
            }
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
