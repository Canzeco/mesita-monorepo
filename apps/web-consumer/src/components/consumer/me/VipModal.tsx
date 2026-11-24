"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Crown, PartyPopper, Repeat, Sparkles, Ticket } from "lucide-react";
import { Instagram } from "@/components/shared/instagram-icon";
import { IconChip, RowDivider, SettingsGroup, SettingsLinkRow } from "@/components/consumer/me/settings-rows";
import { MESITA_SUPPORT_EMAIL } from "@/lib/mesita-contact";
import { Spinner } from "@/components/shared";
import { InstagramVip } from "@/components/consumer/me/InstagramModal";
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

// CLASS IS A MENU WITH SUBPAGES (Pato, 2026-11-24, MESITA-4864: "better design
// there, with subpages: upgrade via instagram, upgrade via manual … do you have
// a modeling agency? activate your models"). The server decides every outcome.

const HERE = CONSUMER_ROUTES.mePages.vipCode;

export function VipFrame({ children }: { children: ReactNode }) {
  return <MeScreen title="Class">{children}</MeScreen>;
}

// ONE CARD SAYS THE CLASS AND WHAT VIP GETS (Pato, 2026-11-24, MESITA-4864:
// "make class easy"), then one way in below it.
function ClassCard({ vip, reason }: { vip: boolean; reason: ConsumerProfile["vip_reason"] }) {
  const why = !vip
    ? "VIP gets a better rate on every bill, at places with VIP offers."
    : reason === "code"
      ? "You joined with an invitation code. You get each place's VIP rate on every bill."
      : reason === "instagram"
        ? "Your verified Instagram made you VIP. You get each place's VIP rate on every bill."
        : "You get each place's VIP rate on every bill.";
  return (
    <div className={cn("flex items-center gap-4 rounded-2xl p-5", vip ? "bg-foreground text-background" : "bg-card border-border border")} data-vip-status={vip ? "vip" : "regular"}>
      <span className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-full", vip ? "bg-background text-foreground" : "bg-muted text-foreground")} aria-hidden>
        <Crown className="h-7 w-7" strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-2xl leading-tight font-semibold">{vip ? "VIP" : "Regular"}</span>
        <span className={cn("mt-1 block text-sm", vip ? "text-background/80" : "text-muted-foreground")} data-vip-why>
          {why}
        </span>
      </span>
    </div>
  );
}

/** Signed out: the app's sign-in, back here after (the edge wall does the
 *  same on a cold load). */
function useSignedIn(here: string) {
  const router = useRouter();
  const viewer = useViewer();
  useEffect(() => {
    if (viewer === "anonymous") router.replace(signHref(here));
  }, [viewer, router, here]);
}

export function VipModal() {
  useSignedIn(CONSUMER_ROUTES.mePages.vip);
  const { data: profile } = useConsumerProfile();
  const vip = isVip(profile);
  return (
    <VipFrame>
      <div className="flex flex-col gap-4">
        <ClassCard vip={vip} reason={profile?.vip_reason ?? null} />
        {vip ? (
          profile?.instagram_handle ? (
            <SettingsGroup>
              <SettingsLinkRow Icon={Instagram} tint="muted" href={CONSUMER_ROUTES.mePages.instagram} label="Instagram" sub={`@${profile.instagram_handle}`} />
            </SettingsGroup>
          ) : null
        ) : (
          <SettingsGroup title="Upgrade to VIP">
            <SettingsLinkRow Icon={Instagram} tint="muted" href={CONSUMER_ROUTES.mePages.instagram} label="Upgrade with Instagram" sub="More than 5,000 followers" />
            <RowDivider />
            <SettingsLinkRow Icon={Ticket} tint="muted" href={CONSUMER_ROUTES.mePages.vipCode} label="Upgrade manually" sub="With an invitation code" />
          </SettingsGroup>
        )}
        <SettingsGroup>
          <SettingsLinkRow Icon={Sparkles} tint="muted" href={CONSUMER_ROUTES.mePages.vipAgency} label="Have a modeling agency?" sub="Activate your models" />
        </SettingsGroup>
      </div>
    </VipFrame>
  );
}

/** Class › Upgrade with Instagram (/me/instagram). */
export function VipInstagramPage() {
  useSignedIn(CONSUMER_ROUTES.mePages.instagram);
  const { data: profile } = useConsumerProfile();
  return (
    <MeScreen title="Upgrade with Instagram">
      {profile ? <InstagramVip profile={profile} /> : <div className="bg-muted h-56 animate-pulse rounded-2xl" aria-hidden />}
    </MeScreen>
  );
}

/** Class › Upgrade manually (/me/vip/code): the invitation code. */
export function VipCodePage() {
  useSignedIn(CONSUMER_ROUTES.mePages.vipCode);
  const router = useRouter();
  const getSupabase = useLazyBrowserSupabase();
  const { data: profile } = useConsumerProfile();
  const [digits, setDigits] = useState("");
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<VipRedeemUi | null>(null);
  // The previous try got no answer (network, 5xx): an already_vip now is
  // that try landing, a success.
  const lastFailed = useRef(false);

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
      goBack(router, CONSUMER_ROUTES.mePages.vip);
      return;
    }
    setSaid(ui);
    setBusy(false);
  }

  return (
    <MeScreen title="Upgrade manually">
      {isVip(profile) ? (
        <ClassCard vip reason={profile?.vip_reason ?? null} />
      ) : (
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
      )}
    </MeScreen>
  );
}

const AGENCY_PERKS = [
  { Icon: PartyPopper, title: "A better first visit", line: "The VIP rate on their first bill at a place." },
  { Icon: Repeat, title: "A better rate after", line: "The VIP rate on every bill after that." },
  { Icon: Ticket, title: "One code each", line: "Every model gets their own invitation code." },
];

/** Class › Have a modeling agency? (/me/vip/agency): what VIP gives a model
 *  and how an agency asks for codes. An operator issues them (Admin › VIP). */
export function VipAgencyPage() {
  useSignedIn(CONSUMER_ROUTES.mePages.vipAgency);
  return (
    <MeScreen title="Modeling agencies">
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-2xl leading-tight font-semibold">Activate your models</h2>
          <p className="text-muted-foreground mt-1 text-sm">Get your models VIP at every place with VIP offers.</p>
        </div>
        <ul className="bg-card border-border divide-border divide-y overflow-hidden rounded-2xl border" data-vip-agency-perks>
          {AGENCY_PERKS.map(({ Icon, title, line }) => (
            <li key={title} className="flex items-center gap-3 px-4 py-3">
              <IconChip>
                <Icon className="h-[18px] w-[18px]" />
              </IconChip>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{title}</span>
                <span className="text-muted-foreground type-label block">{line}</span>
              </span>
            </li>
          ))}
        </ul>
        <a
          href={`mailto:${MESITA_SUPPORT_EMAIL}?subject=${encodeURIComponent("Activate my models")}&body=${encodeURIComponent("Agency name:\nCity:\nNumber of models:\n")}`}
          className={cn(PRIMARY_BUTTON_CLASS, "flex items-center justify-center")}
          data-vip-agency-contact
        >
          Request codes
        </a>
        <p className="text-muted-foreground text-center text-sm">Email us your agency and how many models. We send one code for each.</p>
      </div>
    </MeScreen>
  );
}
