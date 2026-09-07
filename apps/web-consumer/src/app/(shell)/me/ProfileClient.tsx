"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CalendarCheck,
  Footprints,
  MoreHorizontal,
  Settings as SettingsIcon,
  ShoppingBag,
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
import { PREMIUM_PLAN_ICON, PREMIUM_PLAN_PRICE_MXN } from "@/lib/consumer-data";
import { trackEvent } from "@/lib/analytics/track";
import { useConsumerClass } from "@/lib/class-context";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { BoxGroup, BoxRow, StatBand, StatTile } from "./profile-sections";
import { ProfileSummaryCard } from "./ProfileSummaryCard";

// The Me surface — THREE ZONES (MESITA-1622), replacing the flat box list
// MESITA-1123 started and MESITA-1609/-1619 kept rebalancing:
//
//   the passport   who you are. Class and Instagram as tiles, and the member
//                  number as the door to the document behind it
//   the band       Visits · Orders · Bookings. Everything here has a COUNT
//   the list       Wallet · Plan · Alerts · Profile · Settings · More.
//                  Everything here is a DESTINATION
//
// THE PAGE TEACHES ITS OWN RULE. Nothing labels the split between the band
// and the list; it is legible because they are different MATERIAL — a
// `bg-muted` fill with no border against a white card. That is also why
// Wallet and Plan are rows and not tiles: they carry no number, and as tiles
// they made the rule unlearnable. Counting boxes is no longer how this page
// is described, which is why the running seven-eight-nine tally that lived
// here through three PRs is gone.
//
// ALERTS IS A ROW, NOT A TILE, for the same reason: there is no read/unread
// tracking anywhere in this codebase (checked again here — no column, no EF,
// no client state), so it has no count to carry. Wiring one is honest backend
// work, not a UI relabel, and until it exists a fabricated badge would be
// worse than none.
//
// NO CLASS ROW AND NO PASSPORT ROW. Both are reachable from the passport
// itself now — the Class tile and the number footer — so a row for either
// would be the redundant second door Wallet's promotion (MESITA-1609)
// established this page does not keep.
//
// Every summary still reads live wherever the page already holds the data.
// `apiFetchConsumerMetrics` returns `places_visited` and
// `reservations_booked` in the one read the page already makes, so the band
// costs nothing extra.
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
  // The class axis is read by the passport card itself now (MESITA-1622), so
  // this page only keeps what its own summaries need: the plan for Me's Plan
  // row, and the Instagram facts for the More sheet's summary line.
  const { plan, origin, renewsAt, followers, handle: classHandle } =
    useConsumerClass();

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

  const metricsSummary = [
    savedCents == null ? null : `${formatCurrency(savedCents)} saved`,
    visits == null ? null : `${visits} visits`,
  ]
    .filter(Boolean)
    .join(" · ");

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
            onOpenPassport={() => setPassportOpen(true)}
          />

          {/* ZONE 2 — everything here carries a COUNT. Both numbers come off
              the `apiFetchConsumerMetrics` read the page already makes, so
              the band costs no extra fetch. */}
          <StatBand>
            <StatTile
              Icon={Footprints}
              label="Visits"
              count={visits}
              loading={loading}
              onClick={() => router.push(CONSUMER_ROUTES.inbox.visits)}
            />
            {/* PARKED, and honest about it (MESITA-1622). `/inbox/orders`
                308s to Visits, there is no orders table or EF, and the
                concierge answers the delivery question with a flat no. The
                slot is held because orders are a real domain, not because
                anything is behind this tile today. Un-park = drop `soon`. */}
            <StatTile Icon={ShoppingBag} label="Orders" soon />
            <StatTile
              Icon={CalendarCheck}
              label="Bookings"
              count={reservationsBooked}
              loading={loading}
              onClick={() => router.push(CONSUMER_ROUTES.inbox.reservations)}
            />
          </StatBand>

          {/* ZONE 3 — everything here is a DESTINATION, in ONE container so
              the split from the band above reads as two materials rather than
              two piles of cards.

              NO CLASS ROW. The class is a passport tile now and it opens the
              same sheet; a row here would be the second door Wallet's
              promotion (MESITA-1609) established we do not keep.

              ALERTS HAS NO LIVE COUNT — there is no read/unread tracking
              anywhere in this codebase, so it carries honest static copy
              rather than a fabricated number, and that is also why it is a
              row and not a band tile. */}
          <BoxGroup>
            <BoxRow
              bare
              Icon={WalletIcon}
              title="Wallet"
              summary="Credits, gifting and your saved cards"
              onClick={() => router.push(CONSUMER_ROUTES.newVisit.wallet)}
            />
            <BoxRow
              bare
              Icon={PREMIUM_PLAN_ICON}
              title="Plan"
              summary={loading ? "…" : planSummary}
              onClick={openPlan}
            />
            <BoxRow
              bare
              Icon={Bell}
              title="Alerts"
              summary="Notifications and updates"
              onClick={() => router.push(CONSUMER_ROUTES.inbox.notifications)}
            />
            <BoxRow
              bare
              Icon={UserRound}
              title="Profile"
              summary={loading ? "…" : profileSummary}
              onClick={() => profile && setEditOpen(true)}
              disabled={!profile}
            />
            <BoxRow
              bare
              Icon={SettingsIcon}
              title="Settings"
              summary="Notifications, privacy, language"
              onClick={() => setSettingsOpen(true)}
            />
            <BoxRow
              bare
              Icon={MoreHorizontal}
              title="More"
              summary="Instagram, Cards, Gift and more"
              onClick={() => setMoreOpen(true)}
            />
          </BoxGroup>

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
        // Instagram and AI Connector moved here from Me's primary boxes
        // (MESITA-1609) — same modals, same state, new door. Plan left again
        // in MESITA-1619 and Passport in -1622: both are reachable from the
        // page itself now, and a row here would be the redundant second door
        // Wallet's promotion already established we do not keep.
        onOpenInstagram={() => setVerifyOpen(true)}
        igSummary={loading ? "…" : igSummary}
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
