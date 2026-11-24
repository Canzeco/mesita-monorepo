"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Gem } from "lucide-react";
import { VIP_MIN_FOLLOWERS } from "@mesita/place-profile";
import { Instagram } from "@/components/shared/instagram-icon";
import { Spinner } from "@/components/shared";
import { MeScreen } from "@/components/consumer/me/MeScreen";
import { PushLink } from "@/components/consumer/nav/PushLink";
import { apiFetchConsumerProfile } from "@/lib/api/profile";
import { apiRedeemVipCode } from "@/lib/api/vip";
import { signHref } from "@/lib/anonymous";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { useViewer } from "@/lib/identity-context";
import { goBack } from "@/lib/navigate";
import { PROFILE_KEY, writeCached } from "@/lib/screen-cache";
import { clearSessionHref } from "@/lib/stale-session";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { toast } from "@/lib/toast";
import { INPUT_CLASS, PRIMARY_BUTTON_CLASS } from "@/lib/ui-classes";
import { useConsumerProfile } from "@/lib/use-consumer-profile";
import { cn } from "@/lib/utils";
import { groupVipCode, isVip, VIP_CODE_LENGTH, vipCodeDigits, vipRedeemUi, vipTitle, type VipRedeemUi } from "@/lib/vip";

// BECOME VIP (Pato, 2026-11-23, MESITA-4766: "BRING BACK VIP CUSTOMERS ...
// In order to be VIP, is either invitation code or 5000 followers on
// instagram"): /me/vip, pushed from Me's "Have an invitation code?" row and
// the place's Pay tab. Two ways in, Connect Instagram and a code field. A
// VIP opening it reads their status and no form. The server decides every
// outcome (consumer-web-redeem-vip-code); this formats the code and says
// what came back.

const HERE = CONSUMER_ROUTES.mePages.vip;

export function VipFrame({ children }: { children: ReactNode }) {
  return <MeScreen title="Class">{children}</MeScreen>;
}

export function VipModal() {
  const router = useRouter();
  const viewer = useViewer();
  const getSupabase = useLazyBrowserSupabase();
  const { data: profile } = useConsumerProfile();
  const [digits, setDigits] = useState("");
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<VipRedeemUi | null>(null);
  // The previous try got no answer (network, 5xx): an already_vip now is
  // that try landing, a success.
  const lastFailed = useRef(false);

  // Signed out: the app's sign-in, back here after (the edge wall does the
  // same on a cold load).
  useEffect(() => {
    if (viewer === "anonymous") router.replace(signHref(HERE));
  }, [viewer, router]);

  const vip = isVip(profile);
  const ready = digits.length === VIP_CODE_LENGTH && !busy;

  async function join() {
    if (!ready) return;
    setBusy(true);
    setSaid(null);
    const result = await apiRedeemVipCode(getSupabase(), digits);
    const ui = vipRedeemUi(result, lastFailed.current);
    lastFailed.current = result.kind === "failed";
    if (ui.kind === "joined") {
      // Me and every Pay tab read the fresh Class at once.
      try {
        const { consumer } = await apiFetchConsumerProfile(getSupabase());
        writeCached(PROFILE_KEY, consumer);
      } catch {
        // The profile refreshes on its own within minutes.
      }
      toast.success(ui.text);
      goBack(router, CONSUMER_ROUTES.me);
      return;
    }
    setSaid(ui);
    setBusy(false);
  }

  if (vip) {
    return (
      <VipFrame>
        <div className="bg-card border-border flex items-center gap-3 rounded-2xl border p-4" data-vip-status>
          <span className="bg-foreground text-background flex h-10 w-10 shrink-0 items-center justify-center rounded-full" aria-hidden>
            <Gem className="h-5 w-5" strokeWidth={2.25} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-semibold">{vipTitle(profile?.vip_reason ?? null)}</span>
            <span className="text-muted-foreground block text-sm">Higher Back on return visits at places that offer it.</span>
          </span>
        </div>
      </VipFrame>
    );
  }

  return (
    <VipFrame>
      <div className="flex flex-col gap-5">
        <p className="text-muted-foreground px-0.5 text-sm">
          VIP guests get a higher Cashback or Discount from their second bill at places that offer it. Two ways in:
        </p>
        <PushLink
          href={CONSUMER_ROUTES.mePages.instagram}
          className="bg-card border-border hover:bg-muted/40 flex items-center gap-3 rounded-2xl border p-4 transition"
          data-vip-instagram
        >
          <span className="bg-muted text-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-full" aria-hidden>
            <Instagram className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1 text-sm font-semibold">
            Connect Instagram with more than {VIP_MIN_FOLLOWERS.toLocaleString("en-US")} followers
          </span>
          <ChevronRight className="text-muted-foreground h-5 w-5 shrink-0" aria-hidden />
        </PushLink>
        <form
          className="bg-card border-border flex flex-col gap-3 rounded-2xl border p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void join();
          }}
          data-vip-code
        >
          <label htmlFor="vip-code" className="text-sm font-semibold">
            Invitation code
          </label>
          <input
            id="vip-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            // Twelve digits shown 4-4-4: three spaces on top.
            maxLength={VIP_CODE_LENGTH + 2}
            value={groupVipCode(digits)}
            onChange={(e) => {
              setDigits(vipCodeDigits(e.target.value));
              setSaid(null);
            }}
            onPaste={(e) => {
              // Pasted spaces and dashes go; only the digits stay.
              e.preventDefault();
              setDigits(vipCodeDigits(e.clipboardData.getData("text")));
              setSaid(null);
            }}
            placeholder="0000 0000 0000"
            disabled={busy}
            aria-invalid={said?.kind === "error" || undefined}
            aria-describedby={said ? "vip-code-said" : undefined}
            className={cn(INPUT_CLASS, "h-12 text-center text-lg tracking-widest tabular-nums")}
          />
          {said ? (
            <p id="vip-code-said" role="status" className={cn("text-sm", said.kind === "already" ? "text-foreground" : "text-destructive")} data-vip-said={said.kind}>
              {said.kind === "sign_in" ? (
                <a href={clearSessionHref(HERE)} className="font-semibold underline underline-offset-2">
                  {said.text}
                </a>
              ) : (
                said.text
              )}
            </p>
          ) : null}
          <button type="submit" disabled={!ready} className={PRIMARY_BUTTON_CLASS} data-vip-join>
            {busy ? <Spinner size="sm" label="Checking the code" /> : null}
            Join VIP
          </button>
        </form>
      </div>
    </VipFrame>
  );
}
