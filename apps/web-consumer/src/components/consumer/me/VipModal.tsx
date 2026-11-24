"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Crown, PartyPopper, Repeat } from "lucide-react";
import { Spinner } from "@/components/shared";
import { PushLink } from "@/components/consumer/nav/PushLink";
import { MeScreen } from "@/components/consumer/me/MeScreen";
import { apiFetchConsumerProfile, type ConsumerProfile } from "@/lib/api/profile";
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
import { groupVipCode, isVip, VIP_CODE_LENGTH, vipCodeDigits, vipRedeemUi, type VipRedeemUi } from "@/lib/vip";

// BECOME VIP (Pato, 2026-11-23, MESITA-4766: "BRING BACK VIP CUSTOMERS ...
// In order to be VIP, is either invitation code or 5000 followers on
// instagram"): /me/vip, pushed from Me's "Have an invitation code?" row and
// the place's Pay tab. One way in, a code field: codes only until the DM bot proves
// who owns an Instagram (Pato, 2026-11-24, MESITA-4849). A
// VIP opening it reads their status and no form. The server decides every
// outcome (consumer-web-redeem-vip-code); this formats the code and says
// what came back.

const HERE = CONSUMER_ROUTES.mePages.vip;

export function VipFrame({ children }: { children: ReactNode }) {
  return <MeScreen title="Class">{children}</MeScreen>;
}

// WHY, IN ONE CARD (Pato, 2026-11-23, MESITA-4797: "clearer design
// explaining why VIP"): the Class first, then why, then what VIP gets.
function ClassCard({ vip, reason }: { vip: boolean; reason: ConsumerProfile["vip_reason"] }) {
  const why = !vip
    ? "VIP is for guests with an invitation code, or a public Instagram with more than 5,000 followers."
    : reason === "code"
      ? "You joined with an invitation code."
      : reason === "instagram"
        ? "Your verified Instagram made you VIP."
        : "Mesita made you VIP.";
  return (
    <div className={cn("flex items-center gap-4 rounded-2xl p-5", vip ? "bg-foreground text-background" : "bg-card border-border border")} data-vip-status={vip ? "vip" : "regular"}>
      <span className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-full", vip ? "bg-background text-foreground" : "bg-muted text-foreground")} aria-hidden>
        <Crown className="h-7 w-7" strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block text-sm font-semibold", vip ? "text-background/70" : "text-muted-foreground")}>Your Class</span>
        <span className="block text-2xl leading-tight font-semibold">{vip ? "VIP" : "Regular"}</span>
        <span className={cn("mt-1 block text-sm", vip ? "text-background/80" : "text-muted-foreground")} data-vip-why>
          {why}
        </span>
      </span>
    </div>
  );
}

/** What VIP gets (MESITA-4789's two VIP tiers), in the guest's words. */
function VipPerks() {
  const rows = [
    { Icon: PartyPopper, title: "VIP Welcome Visit", line: "A higher rate on your first bill at a place." },
    { Icon: Repeat, title: "VIP Returning Visit", line: "A higher rate on every bill after that." },
  ];
  return (
    <section className="bg-card border-border overflow-hidden rounded-2xl border" aria-label="What VIP gets" data-vip-perks>
      <h2 className="border-border border-b px-4 py-3 text-base font-semibold">What VIP gets</h2>
      <ul className="divide-border divide-y">
        {rows.map(({ Icon, title, line }) => (
          <li key={title} className="flex items-center gap-3 px-4 py-3">
            <span className="bg-muted text-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-full" aria-hidden>
              <Icon className="h-5 w-5" strokeWidth={2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-semibold">{title}</span>
              <span className="text-muted-foreground block text-sm">{line}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground border-border border-t px-4 py-3 text-sm">
        Each place sets its own rates, as Cashback or a Discount on the bill.
      </p>
    </section>
  );
}

/** Me › Instagram's door (MESITA-4863): VIP is the only reason for it. */
function InstagramRow({ handle }: { handle: string | null }) {
  return (
    <PushLink
      href={CONSUMER_ROUTES.mePages.instagram}
      className="bg-card border-border hover:bg-muted flex min-h-14 items-center justify-between gap-3 rounded-2xl border px-4 text-sm font-semibold transition"
      data-vip-instagram
    >
      <span>Instagram</span>
      <span className="text-muted-foreground truncate">{handle ? `@${handle}` : "Connect"}</span>
    </PushLink>
  );
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
        <div className="flex flex-col gap-4">
          <ClassCard vip reason={profile?.vip_reason} />
          <VipPerks />
          {profile?.instagram_handle ? <InstagramRow handle={profile.instagram_handle} /> : null}
        </div>
      </VipFrame>
    );
  }

  return (
    <VipFrame>
      <div className="flex flex-col gap-4">
        <ClassCard vip={false} reason={null} />
        <VipPerks />
        <h2 className="px-0.5 pt-1 text-base font-semibold">Become VIP</h2>
        <InstagramRow handle={profile?.instagram_handle ?? null} />
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
