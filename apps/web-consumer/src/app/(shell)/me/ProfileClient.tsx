"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CalendarCheck,
  Footprints,
  MoreHorizontal,
  Settings as SettingsIcon,
  UserRound,
  Wallet as WalletIcon,
} from "lucide-react";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { DeleteAccountSheet } from "@/components/consumer/DeleteAccountSheet";
import { EditProfileSheet } from "@/components/consumer/EditProfileSheet";
import { InvitePinModal } from "@/components/consumer/me/InvitePinModal";
import { InstagramModal } from "@/components/consumer/me/InstagramModal";
import { ShareModal } from "@/components/consumer/me/ShareModal";
import { ClassModal } from "@/components/consumer/me/ClassModal";
import { SettingsModal } from "@/components/consumer/me/SettingsModal";
import { ContactModal } from "@/components/consumer/me/ContactModal";
import { HelpModal } from "@/components/consumer/me/HelpModal";
import { MetricsModal } from "@/components/consumer/me/MetricsModal";
import { AiConnectModal } from "@/components/consumer/me/AiConnectModal";
import { CardsModal } from "@/components/consumer/me/CardsModal";
import { MoreModal } from "@/components/consumer/me/MoreModal";
import { PassportModal } from "@/components/consumer/me/PassportModal";
import { PlanModal } from "@/components/consumer/me/PlanModal";
import { errMsg, formatCompactCount, formatPhoneDisplay } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import {
  apiFetchConsumerMetrics,
  apiFetchConsumerProfile,
  formatCurrency,
  type ConsumerProfile,
} from "@/lib/api/profile";
import {
  CLASSES,
  CLASS_MARK_ICON,
  PREMIUM_PLAN_ICON,
  PREMIUM_PLAN_PRICE_MXN,
} from "@/lib/consumer-data";
import { trackEvent } from "@/lib/analytics/track";
import { useConsumerClass } from "@/lib/class-context";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { BoxGroup, BoxRow } from "./profile-sections";
import { ProfileSummaryCard } from "./ProfileSummaryCard";

// The Me surface — NINE boxes (MESITA-1609 set the composition, MESITA-1619
// added the ninth):
//
//   Alerts · Visits · Reservations   Activity's three sections, folded in —
//                                    one visual cluster (BoxGroup), not three
//                                    unrelated rows, so the guest still reads
//                                    them as the container they were yesterday
//   Wallet                          promoted out of the buried More sheet —
//                                    one tap from Me instead of three
//   Class · Plan                    the two identity axes, side by side
//   Profile · Settings              your account, unchanged from before
//   More                            Instagram, Passport, AI Connector and the
//                                    rest of the long tail
//
// THE COUNT IS DELIBERATE, NOT A DEFAULT, AND IT HAS MOVED TWICE. MESITA-1123
// set seven; Passport made it eight while MoreModal.tsx still said seven — a
// drift MESITA-1609 corrected rather than perpetuated. That PR held eight by
// moving four boxes to More to make room for Alerts/Visits/Reservations/
// Wallet: Instagram, Plan, Passport and AI Connector, chosen the same way the
// ORIGINAL split was — by FREQUENCY, not importance.
//
// Plan came back (MESITA-1619) and the count is nine. Not a reversal of that
// frequency logic: the Passport card carried a Plan tile throughout, so Plan
// still had a first-screen impression while it sat in More. The Passport now
// prints only what is earned and public, so the impression went with it, and
// a subscription reachable ONLY two taps deep behind a truncated summary is a
// different product than the one MESITA-1609 shipped. Its More row was
// REMOVED, not left as a second door — Wallet's own precedent from that PR.
//
// Every summary reads live wherever the page already holds the data. Visits
// and Reservations both do — `apiFetchConsumerMetrics` already returns
// `places_visited` and `reservations_booked`, fetched on mount for the old
// Metrics row, reused here for free. Alerts does NOT: there is no read/unread
// tracking anywhere in this codebase today (checked before writing this — no
// column, no EF, no client state), so its row carries a static summary
// rather than a fabricated count. Wiring a real one is a separate, honest
// piece of backend work, not a UI relabel.
//
// Flat page at /me; `openSettings` opens Settings on arrival for the legacy
// /me/settings deep link.
export function ProfileClient({
  openSettings = false,
  openCards = false,
}: {
  openSettings?: boolean;
  /** Seeded from `/me?cards=…` — the return trip from Stripe's hosted setup
   *  page reopens Cards on arrival. A prop, never an effect: React 19's
   *  set-state-in-effect lint is live here. */
  openCards?: boolean;
}) {
  const router = useRouter();
  const supabase = useBrowserSupabase();
  const {
    key: classKey,
    plan,
    origin,
    renewsAt,
    followers,
    handle: classHandle,
  } = useConsumerClass();

  // One consumer-web-get-profile read per visit; the (shell) layout already
  // guarantees the row is complete (onboarding gate).
  const [profile, setProfile] = useState<ConsumerProfile | null>(null);
  const [visits, setVisits] = useState<number | null>(null);
  const [savedCents, setSavedCents] = useState<number | null>(null);
  // Lifetime confirmed reservations, same EF read as visits/saved (MESITA-1609
  // — reused, not a new fetch). "Booked," not "upcoming": the EF counts all
  // time, so the summary doesn't claim a distinction the data can't back.
  const [reservationsBooked, setReservationsBooked] = useState<number | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  // Modal state. Only one is meaningfully open at a time; each is a LocalSheet
  // kept mounted so its exit animation plays. The legacy /me/settings deep link
  // opens the Settings box — seeded from the prop so there is no
  // setState-in-effect.
  const [shareOpen, setShareOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [classOpen, setClassOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [invitePinOpen, setInvitePinOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(openSettings);
  const [contactOpen, setContactOpen] = useState(false);
  const [metricsOpen, setMetricsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [cardsOpen, setCardsOpen] = useState(openCards);
  const [planOpen, setPlanOpen] = useState(false);
  const [passportOpen, setPassportOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ consumer, stats }, metrics] = await Promise.all([
          apiFetchConsumerProfile(supabase),
          apiFetchConsumerMetrics(supabase).catch(() => null),
        ]);
        if (cancelled) return;
        setProfile(consumer);
        // Metrics EF wins (visits · saved); profile stats.visits is the
        // fallback when it fails.
        setVisits(metrics?.places_visited ?? stats.visits);
        setSavedCents(metrics?.saved_cents ?? null);
        // No stats.reservations fallback exists — the metrics EF is the only
        // source, so a failed fetch just leaves this null (zero-state copy
        // handles it, same as a slow load).
        setReservationsBooked(metrics?.reservations_booked ?? null);
      } catch (e) {
        if (!cancelled) toast(errMsg(e, "Couldn't load your profile."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // Post-checkout / Instagram-verify landing. The subscribe + verify flows
  // redirect here with a state query; confirm it with a toast (the full page
  // load already re-seeded the real membership upstream). Read straight off
  // the URL so the page carries no prerender-bailout requirement.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const state = params.get("subscription");
    if (state === "success") {
      toast.success("You're Mesita Premium — welcome in.");
    } else if (state === "cancelled") {
      toast("Checkout cancelled — you can subscribe anytime.");
    }
    if (params.get("instagram") === "success") {
      toast.success("Connected — Rewards unlocked. Your class updated.");
    }
  }, []);

  // Instagram connect is triggered from two boxes (Instagram, Class) — close
  // the Class sheet first so two LocalSheets never stack at z-[130].
  function openVerify() {
    setClassOpen(false);
    setVerifyOpen(true);
  }

  const cls = CLASSES.find((c) => c.id === classKey);
  const classSummary = [cls?.label ?? "Bronze", cls?.reward]
    .filter(Boolean)
    .join(" · ");

  const handle = classHandle ?? profile?.instagram_handle ?? null;
  const igConnected = origin === "instagram" || Boolean(handle);
  const igSummary = igConnected
    ? [handle ? `@${handle}` : "Connected", formatCompactCount(followers)]
        .filter(Boolean)
        .join(" · ")
    : "Instagram not connected";

  const renewalDate = renewsAt ? new Date(renewsAt) : null;
  const renewalValid =
    renewalDate != null && !Number.isNaN(renewalDate.valueOf());
  const planSummary =
    plan === "premium"
      ? [
          `Premium · MX$${PREMIUM_PLAN_PRICE_MXN}/month`,
          renewalValid
            ? `renews ${renewalDate.toLocaleDateString("en-US", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}`
            : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : `Free · MX$${PREMIUM_PLAN_PRICE_MXN}/month unlocks Premium`;

  const name =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    profile?.full_name ||
    null;
  const profileSummary =
    [name, formatPhoneDisplay(profile?.phone)].filter(Boolean).join(" · ") ||
    "Name, phone, birthday, photo";

  // The number leads: it is the fact this row adds. Visibility follows because
  // it is the one thing on the passport a guest can change.
  const passportSummary = [
    profile?.code ? `No. ${profile.code}` : null,
    profile?.privacy_public ? "Public" : "Private",
  ]
    .filter(Boolean)
    .join(" · ");

  const metricsSummary = [
    savedCents == null ? null : `${formatCurrency(savedCents)} saved`,
    visits == null ? null : `${visits} visits`,
  ]
    .filter(Boolean)
    .join(" · ");

  // The box names the CONCEPT, so it wears the class mark (a pyramid), not the
  // current rung's metal — a medal on a Bronze account read as "you won
  // something" rather than "this is your class" (decision: Pato).
  const ClassIcon = CLASS_MARK_ICON;

  // The ONE door to the plan sheet (MESITA-1619). Instrumented because the
  // Passport tile it replaces carried no event at all: without this the
  // change is unmeasurable in both directions, and "conversion moved" would
  // be unattributable to the surface that moved it. `plan_open` is paired by
  // hand into consumer-web-track-event's allowlist — nothing enforces that at
  // compile time, so `analytics-events-paired.test.ts` does.
  function openPlan() {
    trackEvent(supabase, "plan_open");
    setPlanOpen(true);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="scrollbar-hide flex-1 overflow-y-auto px-4 pt-5 pb-8">
        <div className="flex flex-col gap-3">
          <ProfileSummaryCard
            profile={profile}
            loading={loading}
            onOpenClass={() => setClassOpen(true)}
            onOpenInstagram={() => setVerifyOpen(true)}
          />

          {/* Activity's three sections, folded in (MESITA-1609) — one visual
              cluster, not three flat rows, so they still read as the
              container they were on the old Activity tab. Alerts has no
              live count: no read/unread tracking exists in this codebase
              today, so its summary is honest static copy, not a fabricated
              number. */}
          <BoxGroup>
            <BoxRow
              bare
              Icon={Bell}
              title="Alerts"
              summary="Notifications and updates"
              onClick={() => router.push(CONSUMER_ROUTES.inbox.notifications)}
            />
            <BoxRow
              bare
              Icon={Footprints}
              title="Visits"
              summary={
                loading
                  ? "…"
                  : !visits
                    ? "Your visits will show up here"
                    : `${visits} visit${visits === 1 ? "" : "s"}`
              }
              onClick={() => router.push(CONSUMER_ROUTES.inbox.visits)}
            />
            <BoxRow
              bare
              Icon={CalendarCheck}
              title="Reservations"
              summary={
                loading
                  ? "…"
                  : !reservationsBooked
                    ? "Nothing booked yet"
                    : `${reservationsBooked} booked`
              }
              onClick={() => router.push(CONSUMER_ROUTES.inbox.reservations)}
            />
          </BoxGroup>

          {/* Promoted out of the buried More sheet (MESITA-1609) — one tap
              from Me instead of three. Pay keeps its own primary Wallet
              door; this is the second one, same destination. */}
          <BoxRow
            Icon={WalletIcon}
            title="Wallet"
            summary="Credits, gifting and your saved cards"
            onClick={() => router.push(CONSUMER_ROUTES.newVisit.wallet)}
          />

          <BoxRow
            Icon={ClassIcon}
            title="Class"
            summary={loading ? "…" : classSummary}
            onClick={() => setClassOpen(true)}
          />

          {/* The other axis, back on primary (MESITA-1619). It sits beside
              Class because the two are one identity read as two axes, and it
              is here at all because the Passport stopped printing the plan:
              the tile was Premium's only unconditional impression in the app
              (`reward-matrix`'s PlanRow and the ticket's Premium label are
              both display-only), so without this row the plan would have gone
              to zero impressions behind a truncated More summary. That is the
              tradeoff MoreModal.tsx flagged "for confirmation outside this
              PR" — confirmed here, in Wallet's direction. */}
          <BoxRow
            Icon={PREMIUM_PLAN_ICON}
            title="Plan"
            summary={loading ? "…" : planSummary}
            onClick={openPlan}
          />

          {/* Your account. */}
          <BoxRow
            Icon={UserRound}
            title="Profile"
            summary={loading ? "…" : profileSummary}
            onClick={() => profile && setEditOpen(true)}
            disabled={!profile}
          />

          <BoxRow
            Icon={SettingsIcon}
            title="Settings"
            summary="Notifications, privacy, language"
            onClick={() => setSettingsOpen(true)}
          />

          {/* The long tail: Cards · Instagram · Passport · Gift · Share ·
              AI Connector · Metrics · Help · Contact. Instagram, Passport and
              AI Connector moved here from primary (MESITA-1609) to make room
              for Alerts/Visits/Reservations/Wallet — same frequency-based
              split MESITA-1123 used originally. Plan came back out
              (MESITA-1619) and, like Wallet before it, was REMOVED from this
              sheet rather than left as a second door. */}
          <BoxRow
            Icon={MoreHorizontal}
            title="More"
            summary="Instagram, Passport, Cards and more"
            onClick={() => setMoreOpen(true)}
          />

          <SignOutButton
            redirectTo="/"
            className="border-border bg-card hover:bg-muted mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border py-4 text-sm font-semibold transition"
          />
          <p className="text-muted-foreground type-label -mt-1 text-center">
            Mesita · v2.4.1
          </p>
        </div>
      </div>

      {/* All modals kept mounted; LocalSheet plays the exit animation before
          going inert. */}
      <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} />
      <CardsModal open={cardsOpen} onClose={() => setCardsOpen(false)} />
      <AiConnectModal open={aiOpen} onClose={() => setAiOpen(false)} />
      <ClassModal
        open={classOpen}
        onClose={() => setClassOpen(false)}
        onConnectInstagram={openVerify}
        // Close the ladder before opening the PIN sheet. Local sheets are one
        // layer (z-130 in the overlay standard), so stacking two would put a
        // scrim over the thing the guest is trying to type into.
        onRedeemInvite={() => {
          setClassOpen(false);
          setInvitePinOpen(true);
        }}
      />
      <InstagramModal open={verifyOpen} onClose={() => setVerifyOpen(false)} />
      {/* Reached ONLY through the Class sheet's "Join with Invitation"
          (decision: Pato, 2026-08-22). The standalone Invitations row this
          modal once had was cut: the ladder now names the invitation twin on
          every rung, so a separate row restated a door the Class surface
          already owns. */}
      <InvitePinModal
        open={invitePinOpen}
        onClose={() => setInvitePinOpen(false)}
      />
      {profile && (
        <EditProfileSheet
          profile={profile}
          open={editOpen}
          onClose={() => setEditOpen(false)}
          onSaved={(updated) => setProfile(updated)}
        />
      )}
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onDeleteAccount={() => setDeleteOpen(true)}
        profile={profile}
        onProfileChange={setProfile}
      />
      <ContactModal open={contactOpen} onClose={() => setContactOpen(false)} />
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      <MetricsModal open={metricsOpen} onClose={() => setMetricsOpen(false)} />
      <DeleteAccountSheet
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
      />
      <PlanModal open={planOpen} onClose={() => setPlanOpen(false)} />
      <PassportModal
        open={passportOpen}
        onClose={() => setPassportOpen(false)}
        profile={profile}
        // One LocalSheet layer (z-130), so the passport closes before Settings
        // opens — the same handoff openVerify makes from the Class sheet.
        onOpenSettings={() => {
          setPassportOpen(false);
          setSettingsOpen(true);
        }}
      />
      <MoreModal
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        onOpenCards={() => setCardsOpen(true)}
        // Instagram, Passport and AI Connector moved here from Me's primary
        // boxes (MESITA-1609) — same modals, same state, new door. Plan is
        // NOT among them any more (MESITA-1619): it is primary again, and a
        // row here would be the redundant second door Wallet's promotion
        // already established we do not keep.
        onOpenInstagram={() => setVerifyOpen(true)}
        igSummary={loading ? "…" : igSummary}
        onOpenPassport={() => setPassportOpen(true)}
        passportSummary={loading ? "…" : passportSummary}
        onOpenAiConnect={() => setAiOpen(true)}
        onOpenShare={() => setShareOpen(true)}
        onOpenMetrics={() => setMetricsOpen(true)}
        onOpenHelp={() => setHelpOpen(true)}
        onOpenContact={() => setContactOpen(true)}
        metricsSummary={
          loading
            ? "…"
            : metricsSummary || "Visits, places, reviews — your numbers"
        }
      />
    </div>
  );
}
