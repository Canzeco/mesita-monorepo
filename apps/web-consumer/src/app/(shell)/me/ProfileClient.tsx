"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CalendarCheck,
  CircleHelp,
  CreditCard,
  Bot,
  Footprints,
  Gift,
  Settings as SettingsIcon,
  Share2,
  ShoppingBag,
  Wallet as WalletIcon,
} from "lucide-react";
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
import { DestGrid, DestTile } from "./profile-sections";
import { ProfileSummaryCard } from "./ProfileSummaryCard";

// The Me surface — ONE CELL SHAPE, REPEATED (MESITA-1633):
//
//   the passport   who you are, with a 2×2 sub-grid inside it: Profile
//                  across the top, then Instagram · Class. Only Class in
//                  metal (MESITA-1634)
//   six pairs      Wallet·Plan · Alerts·Visits · Orders·Bookings ·
//                  Connector·Cards · Gift·Share · Settings·Help
//
// NO MORE DRAWER (MESITA-1635). Gift and Share were the last two rows in it,
// so with them on the page it held nothing. Everything this account has is on
// one screen now; four cells are `soon`, which is honest about the roadmap
// rather than hiding it a tap deeper.
//
// WHY IT LOOKS LIKE THIS. The page it replaces stacked FOUR cell shapes and
// three fills — passport tiles, a white pair, a muted count band, then a grid
// — and two of those were 2-up white cards that looked identical while
// belonging to different groups, with the band between them reading as a
// stripe rather than a section. One shape, repeated, is the whole fix.
//
// A COUNT IS A SUMMARY LINE, NOT A MATERIAL. Visits and Bookings read
// "12 visits" / "None yet" where every other cell reads its own summary, so
// the band had nothing left to be and `StatBand`/`StatTile` went with it.
// Zero and unknown say the same words on purpose: a failed metrics read is
// not a guest with no visits, and a hard 0 would state a fact we lack.
//
// ALERTS IS A CELL AND THERE IS NO BELL. Having both was two doors to one
// sheet, the drift Wallet, Plan and Passport each cost us to remove. It still
// carries no count — there is no read/unread tracking anywhere in this
// codebase (checked again here: no column, no EF, no client state) — so it
// says what it is, never how many.
//
// NOTHING HERE DUPLICATES THE PASSPORT. Profile, Instagram and Class are its
// sub-cells, so none of them gets a pair cell too.
//
// METRICS, CONTACT AND SIGN OUT LIVE IN SETTINGS (MESITA-1634). Sign out was
// a button in the page body and is now a row where the rest of the account
// controls are. Contact came off the grid on instruction, but it is NOT
// deleted: HelpModal carries no contact or support reference of any kind, so
// ContactModal is the only door to a human in the product.
//
// Every summary reads live wherever the page already holds the data:
// `apiFetchConsumerMetrics` returns both counts in the one read on mount.
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
  // The passport owns the whole identity read now (MESITA-1633) — class,
  // Instagram and profile are its three sub-cells. All this page still needs
  // is which plan, for the Plan cell's summary.
  const { plan } = useConsumerClass();

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
  // A COUNT IS A SUMMARY LINE (MESITA-1633) — the band that printed numerals
  // is gone, so these read like every other cell's summary. Zero and unknown
  // say the same thing: a failed metrics read is not a guest with no visits,
  // and printing a hard 0 for it would state a fact we do not have.
  const visitsTile = !visits ? "None yet" : `${visits} visit${visits === 1 ? "" : "s"}`;
  const bookingsTile = !reservationsBooked
    ? "None yet"
    : `${reservationsBooked} booked`;

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
            onOpenProfile={() => profile && setEditOpen(true)}
          />

          {/* ONE SHAPE, REPEATED (MESITA-1633). Six pairs and a full-width
              drawer, all the same `DestTile`. The header bell, the count band
              and the "Everything else" heading are gone: the page used to
              stack four cell shapes and three fills, and two of those were
              2-up white cards that looked identical while belonging to
              different groups.

              A COUNT IS A SUMMARY LINE NOW, not its own material. Visits and
              Bookings read "12 visits" / "None yet" where every other cell
              reads its own short summary, so the band had nothing left to be.

              ALERTS IS A CELL AND THERE IS NO BELL. Having both was two doors
              to one sheet, the drift Wallet, Plan and Passport each cost us
              to remove. It still carries no unread count — none exists in
              this codebase — so it says what it is, not how many. */}
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

            <DestTile
              Icon={Bell}
              title="Alerts"
              summary="Notifications"
              onClick={() => setAlertsOpen(true)}
            />
            <DestTile
              Icon={Footprints}
              title="Visits"
              summary={loading ? "…" : visitsTile}
              onClick={() => setVisitsOpen(true)}
            />

            {/* PARKED. No orders table, no EF, `/inbox/orders` 308s away, and
                the concierge answers delivery with a flat no. */}
            <DestTile Icon={ShoppingBag} title="Orders" summary="" soon />
            <DestTile
              Icon={CalendarCheck}
              title="Bookings"
              summary={loading ? "…" : bookingsTile}
              onClick={() => setBookingsOpen(true)}
            />

            {/* PARKED — out of More and onto the page as an honest Soon cell,
                because the brief named it. Gift and Share stay in More. */}
            <DestTile
              Icon={Bot}
              title="Connector"
              summary=""
              soon
              // Handler stays wired while parked so un-parking is a `soon`
              // removal alone — the sheet it opens already works.
              onClick={() => setAiOpen(true)}
            />
            <DestTile
              Icon={CreditCard}
              title="Cards"
              summary="Saved cards"
              onClick={() => setCardsOpen(true)}
            />

            {/* PARKED, both. Gift has no sheet at all yet; Share's exists
                and stays wired so un-parking is a `soon` removal alone. These
                were the last two rows in More, so More held nothing and is
                deleted (MESITA-1635) — an empty drawer is worse than none. */}
            <DestTile Icon={Gift} title="Gift" summary="" soon />
            <DestTile
              Icon={Share2}
              title="Share"
              summary=""
              soon
              onClick={() => setShareOpen(true)}
            />

            <DestTile
              Icon={SettingsIcon}
              title="Settings"
              summary="Privacy, language"
              onClick={() => setSettingsOpen(true)}
            />
            <DestTile
              Icon={CircleHelp}
              title="Help"
              summary="How rewards work"
              onClick={() => setHelpOpen(true)}
            />

          </DestGrid>

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
      {/* Settings absorbed Metrics, Contact and Sign out (MESITA-1634). Each
          hands off to a sheet at the SAME z-layer, so Settings closes first —
          two LocalSheets must never stack. */}
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onDeleteAccount={() => setDeleteOpen(true)}
        onOpenMetrics={() => setMetricsOpen(true)}
        onOpenContact={() => setContactOpen(true)}
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
    </div>
  );
}
