"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, ConciergeBell, Crown, PartyPopper, Sparkles, Ticket, Users } from "lucide-react";
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
          <SettingsLinkRow Icon={Users} tint="muted" href={CONSUMER_ROUTES.mePages.vipAgency} label="Bring your people" sub="Agencies, creators, promoters, hotels" />
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

// WHO BRINGS PEOPLE (Pato, 2026-11-24, MESITA-4867): four types, each with its
// own word for its people in the email.
const GROUPS = [
  { key: "agency", Icon: Sparkles, title: "Model or talent agency", line: "Models, actors, hosts", people: "models" },
  { key: "creators", Icon: Camera, title: "Creators", line: "Influencer agencies and creators", people: "creators" },
  { key: "promoters", Icon: PartyPopper, title: "Promoter or events", line: "Nightlife, concerts, festivals", people: "guests" },
  { key: "hotels", Icon: ConciergeBell, title: "Hotel or concierge", line: "Guests asking where to go", people: "guests" },
] as const;

function codesMail(group: (typeof GROUPS)[number]): string {
  const subject = encodeURIComponent(`VIP codes: ${group.title}`);
  const body = encodeURIComponent(`Name:\nCity:\nWebsite or Instagram:\nNumber of ${group.people}:\n`);
  return `mailto:${MESITA_SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
}

/** Class › Bring your people (/me/vip/agency): who you are, what your people
 *  get, and the email that asks for codes. An operator issues them, one per
 *  person (Admin › VIP). */
export function VipAgencyPage() {
  useSignedIn(CONSUMER_ROUTES.mePages.vipAgency);
  const [picked, setPicked] = useState<(typeof GROUPS)[number] | null>(null);
  return (
    <MeScreen title="Bring your people">
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-2xl leading-tight font-semibold">Make your people VIP</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            They get each place&apos;s VIP rate, on their first bill and every one after. One code per person.
          </p>
        </div>
        <section className="flex flex-col gap-2">
          <h3 id="vip-group" className="text-base font-semibold">
            Who are you?
          </h3>
          <div
            role="radiogroup"
            aria-labelledby="vip-group"
            className="bg-card border-border divide-border divide-y overflow-hidden rounded-2xl border"
            data-vip-groups
          >
            {GROUPS.map((g) => {
              const on = picked?.key === g.key;
              return (
                <button
                  key={g.key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setPicked(g)}
                  className="hover:bg-muted flex w-full items-center gap-3 px-4 py-3 text-left transition"
                  data-vip-group={g.key}
                >
                  <IconChip>
                    <g.Icon className="h-[18px] w-[18px]" />
                  </IconChip>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{g.title}</span>
                    <span className="text-muted-foreground type-label block">{g.line}</span>
                  </span>
                  <Check aria-hidden className={cn("h-5 w-5 shrink-0", !on && "invisible")} strokeWidth={2.5} />
                </button>
              );
            })}
          </div>
        </section>
        {picked ? (
          <a
            href={codesMail(picked)}
            className={cn(PRIMARY_BUTTON_CLASS, "flex items-center justify-center")}
            data-vip-agency-contact
          >
            Request codes
          </a>
        ) : (
          <button type="button" disabled className={PRIMARY_BUTTON_CLASS}>
            Pick one to request codes
          </button>
        )}
        <p className="text-muted-foreground text-center text-sm">It opens an email to us. We review it and reply.</p>
      </div>
    </MeScreen>
  );
}
