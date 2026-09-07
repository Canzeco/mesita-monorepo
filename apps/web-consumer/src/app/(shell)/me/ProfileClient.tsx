"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Bell,
  CalendarCheck,
  CircleHelp,
  CreditCard,
  Footprints,
  Instagram,
  MessageSquare,
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
import {
  AlertsModal,
  BookingsModal,
  VisitsModal,
} from "@/components/consumer/me/ActivityModals";
import { PassportModal } from "@/components/consumer/me/PassportModal";
import { PlanModal } from "@/components/consumer/me/PlanModal";
import { errMsg } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import {
  apiFetchConsumerMetrics,
  apiFetchConsumerProfile,
  type ConsumerProfile,
} from "@/lib/api/profile";
import { PREMIUM_PLAN_ICON, PREMIUM_PLAN_PRICE_MXN } from "@/lib/consumer-data";
import { trackEvent } from "@/lib/analytics/track";
import { useConsumerClass } from "@/lib/class-context";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { DestGrid, DestTile, StatBand, StatTile } from "./profile-sections";
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
  // The passport card reads the class axis itself (MESITA-1622), and the long
  // summaries that needed followers and the renewal date are gone with the
  // rows that printed them (MESITA-1628). What is left is what the two grid
  // cells actually say: which plan, and whether Instagram is connected.
  const { plan, origin, handle: classHandle } = useConsumerClass();

  // One consumer-web-get-profile read per visit; the (shell) layout already
  // guarantees the row is complete (onboarding gate).
  const [profile, setProfile] = useState<ConsumerProfile | null>(null);
  const [visits, setVisits] = useState<number | null>(null);
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
  // Activity's three sections, one sheet each (MESITA-1626) — the `/inbox`
  // container they used to share is gone.
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [visitsOpen, setVisitsOpen] = useState(false);
  const [bookingsOpen, setBookingsOpen] = useState(false);

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
        // `saved_cents` comes back on the same read and nothing prints it
        // any more — Metrics owns that number inside its own sheet.
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
  // The long-form summaries that lived here are gone with the rows that read
  // them (MESITA-1628). A grid cell has ~90px of text width at 320px, so the
  // page needs SHORT copy, not a different formatting of the long copy — and
  // the sheets each compute their own from the same context. `formatCurrency`
  // and `formatPhoneDisplay` left with them.

  // GRID COPY IS ≤3 WORDS (MESITA-1628). A 2-up cell is ~167px at 375px and
  // the glyph gutter takes 38px of it; the long-form summaries above are for
  // sheets, which have the whole width to spend.
  const planTile =
    plan === "premium" ? "Premium" : `Free · MX$${PREMIUM_PLAN_PRICE_MXN}/mo`;
  const igTile = igConnected
    ? handle
      ? `@${handle}`
      : "Connected"
    : "Not connected";

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
          {/* The bell owns notifications, and it is the ONLY door to them
              (MESITA-1628): Alerts sat in the grid AND up here in the brief,
              and two doors to one sheet is the drift Wallet, Plan and
              Passport each cost us to remove.

              NO UNREAD DOT. There is no read/unread tracking anywhere in this
              codebase — no column, no EF, no client state — so a badge here
              would be decoration shaped like data. It ships with the backend
              that backs it, or not at all.

              No title either: the bottom nav says "Me" directly below this
              row, and the passport under it is the anchor. */}
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => setAlertsOpen(true)}
              aria-label="Notifications"
              className="border-border bg-card shadow-rest flex h-10 w-10 items-center justify-center rounded-full border transition active:scale-[0.97]"
            >
              <Bell className="text-foreground/75 h-5 w-5" />
            </button>
          </div>

          <ProfileSummaryCard
            profile={profile}
            loading={loading}
            onOpenClass={() => setClassOpen(true)}
            onOpenInstagram={() => setVerifyOpen(true)}
            onOpenPassport={() => setPassportOpen(true)}
          />

          {/* Destinations, so a white card like the grid below — not the
              band's muted fill. Up here because money is what a guest checks
              first. */}
          <DestGrid>
            <DestTile
              Icon={WalletIcon}
              title="Wallet"
              summary="Credits and cards"
              onClick={() => router.push(CONSUMER_ROUTES.newVisit.wallet)}
            />
            <DestTile
              Icon={PREMIUM_PLAN_ICON}
              title="Plan"
              summary={loading ? "…" : planTile}
              onClick={openPlan}
            />
          </DestGrid>

          {/* Everything here carries a COUNT — that is the whole rule, and the
              muted fill is what says so. Both numbers come off the
              `apiFetchConsumerMetrics` read the page already makes. */}
          <StatBand>
            <StatTile
              Icon={Footprints}
              label="Visits"
              count={visits}
              loading={loading}
              onClick={() => setVisitsOpen(true)}
            />
            {/* PARKED, and honest about it. There is no orders table or EF,
                `/inbox/orders` 308s away, and the concierge answers the
                delivery question with a flat no. Un-park = drop `soon`. */}
            <StatTile Icon={ShoppingBag} label="Orders" soon />
            <StatTile
              Icon={CalendarCheck}
              label="Bookings"
              count={reservationsBooked}
              loading={loading}
              onClick={() => setBookingsOpen(true)}
            />
          </StatBand>

          {/* The long tail, as a grid (MESITA-1628). LIVE CELLS ONLY: Gift,
              Share and AI Connector are `soon` with nothing behind them, and
              three greyed cells out of eleven is a quarter of the block — in
              a grid a dead cell reads as broken, in a list it reads as a
              roadmap. They stay behind More, which is what a More is for. */}
          <p className="text-muted-foreground type-label px-0.5 pt-1 font-bold tracking-[0.12em] uppercase">
            Everything else
          </p>
          <DestGrid>
            <DestTile
              Icon={UserRound}
              title="Profile"
              summary="Name and phone"
              onClick={() => profile && setEditOpen(true)}
              disabled={!profile}
            />
            <DestTile
              Icon={SettingsIcon}
              title="Settings"
              summary="Privacy, language"
              onClick={() => setSettingsOpen(true)}
            />
            <DestTile
              Icon={CreditCard}
              title="Cards"
              summary="Saved cards"
              onClick={() => setCardsOpen(true)}
            />
            <DestTile
              Icon={Instagram}
              title="Instagram"
              summary={loading ? "…" : igTile}
              onClick={() => setVerifyOpen(true)}
            />
            <DestTile
              Icon={BarChart3}
              title="Metrics"
              summary="Your numbers"
              onClick={() => setMetricsOpen(true)}
            />
            <DestTile
              Icon={CircleHelp}
              title="Help"
              summary="How rewards work"
              onClick={() => setHelpOpen(true)}
            />
            <DestTile
              Icon={MessageSquare}
              title="Contact"
              summary="Talk to us"
              onClick={() => setContactOpen(true)}
            />
            <DestTile
              Icon={MoreHorizontal}
              title="More"
              summary="Gift, Share, AI"
              onClick={() => setMoreOpen(true)}
            />
          </DestGrid>

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
      {/* One sheet per box. `userId` is the consumers row id — both bodies
          treat it as an on/off flag and read the session inside their EF, so
          the sheets render an honest zero state until the profile lands
          rather than firing a request they cannot attribute. */}
      <AlertsModal
        open={alertsOpen}
        onClose={() => setAlertsOpen(false)}
        userId={profile?.id ?? ""}
      />
      <VisitsModal
        open={visitsOpen}
        onClose={() => setVisitsOpen(false)}
        userId={profile?.id ?? ""}
      />
      <BookingsModal
        open={bookingsOpen}
        onClose={() => setBookingsOpen(false)}
      />
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
      {/* More is the PARKED TAIL now (MESITA-1628) — Gift, Share, AI
          Connector. Everything live moved onto the page as a grid cell. */}
      <MoreModal
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        onOpenShare={() => setShareOpen(true)}
        onOpenAiConnect={() => setAiOpen(true)}
      />
    </div>
  );
}
