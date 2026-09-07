"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CalendarCheck,
  CircleHelp,
  Bot,
  Footprints,
  Gift,
  IdCard,
  Info,
  Settings as SettingsIcon,
  Share2,
  ShoppingBag,
  UserRound,
  Users,
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
import { AboutModal } from "@/components/consumer/me/AboutModal";
import { APP_VERSION } from "@/lib/app-version";
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
  apiFetchConsumerProfile,
  type ConsumerProfile,
} from "@/lib/api/profile";
import { PREMIUM_PLAN_ICON, PREMIUM_PLAN_PRICE_MXN } from "@/lib/consumer-data";
import { trackEvent } from "@/lib/analytics/track";
import { useConsumerClass } from "@/lib/class-context";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { DestGrid, DestTile } from "./profile-sections";
import { ProfileSummaryCard } from "./ProfileSummaryCard";

// The Me surface — the passport, then five pairs and a tail:
//
//   passport       identity + the two axes, DISPLAY ONLY (MESITA-1646)
//   2              Profile · Passport
//   2              Wallet · Plan
//   2              Notifications · Visits
//   2              Orders · Reservations
//   2              Share · Gift
//   2              Settings · Help
//   2              Connector · Friends
//   1              About, full width
//
// WHY EVERY ROW BELOW IS A PAIR. MESITA-1636 varied the widths so the column
// would not read as undifferentiated, and paid for it with a four-up whose
// cells were too narrow to carry a summary. The passport leads by being a
// different OBJECT — a document, with a photo, twice the height of a cell —
// not by the rows underneath it changing shape (MESITA-1639).
//
// THE PASSPORT IS ONE BUTTON and nothing inside it is interactive. The three
// doors that used to be sub-cells — Profile, Instagram, Class — are rows in
// `PassportModal` now. That is not a convenience: Instagram is the only reach
// door, and the Class ladder carries the ONLY entrance for a 10-digit invite
// PIN (Docs › Passport §C). Never make one of those rows inert without giving
// its surface another way in first.
//
// NOTHING ON THIS PAGE PRINTS A NUMBER any more, which is why the mount does
// ONE EF read. The four-up carries no summary line, so the metrics call that
// used to ride along for Visits and Bookings was fetching data nobody
// displayed; MetricsModal fetches its own when it opens.
//
// ALERTS CARRIES NO COUNT for a different reason: there is no read/unread
// tracking anywhere in this codebase (checked again here — no column, no EF,
// no client state), so a badge would be invented rather than merely absent.
//
// NO CARDS CELL. `new-visit/wallet/CreditsClient` opens the SAME `CardsModal`
// this page does, and Wallet is a cell here whose summary is already "Credits
// and cards" — a second door is what this page keeps removing. `CardsModal`
// stays mounted regardless: `/me?cards=` is Stripe's return URL.
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
  const [loading, setLoading] = useState(true);

  // Modal state. Only one is meaningfully open at a time; each is a LocalSheet
  // kept mounted so its exit animation plays. The legacy /me/settings deep link
  // opens the Settings box — seeded from the prop so there is no
  // setState-in-effect.
  const [shareOpen, setShareOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
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
        // ONE EF read on mount. `apiFetchConsumerMetrics` used to ride along
        // for the Visits and Bookings counts; the four-up carries no summary
        // line (MESITA-1636), so nothing on this page prints a number any
        // more and the second round trip was pure waste. MetricsModal fetches
        // its own when it opens, which is the only place those numbers show.
        const { consumer } = await apiFetchConsumerProfile(supabase);
        if (cancelled) return;
        setProfile(consumer);
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
          {/* JUST VISIBLE (Pato, MESITA-1646). The card displays; the grid
              navigates. It takes no handlers at all. */}
          <ProfileSummaryCard profile={profile} loading={loading} />

          {/* The pair that replaces the card's doors. `Passport` is the only
              way into the document now, and its sheet carries the Instagram
              and Class rows — the only entrances to the connect flow and to
              the ladder's "Join with Invitation" (Docs › Passport §C). */}
          <DestGrid>
            <DestTile
              Icon={UserRound}
              title="Profile"
              summary="Name, photo, birthday"
              onClick={() => profile && setEditOpen(true)}
            />
            <DestTile
              Icon={IdCard}
              title="Passport"
              summary="Class and Instagram"
              onClick={() => setPassportOpen(true)}
            />
          </DestGrid>

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
          </DestGrid>

          {/* Activity, TWO PAIRS AND FULL SIZE (decision: Pato, MESITA-1639).
              It was one four-across `compact` row, and four cells at 375px are
              80px wide — no room for a second line, so these were the only
              four cells on Me that never said what they hold. The row a guest
              most needs to read was the row that explained nothing, and it
              read as a different material from everything around it. Two
              ordinary pairs cost one row of height and buy four summaries. */}
          <DestGrid>
            <DestTile
              Icon={Bell}
              title="Notifications"
              summary="Visits and bookings"
              onClick={() => setAlertsOpen(true)}
            />
            <DestTile
              Icon={Footprints}
              title="Visits"
              summary="Tickets and QRs"
              onClick={() => setVisitsOpen(true)}
            />
          </DestGrid>

          <DestGrid>
            {/* Parked, so the Soon pill takes the summary slot. */}
            <DestTile Icon={ShoppingBag} title="Orders" summary="" soon />
            {/* THE RENAME STOPS AT THE LABEL (Pato, MESITA-1640), the rule
                CLAUDE.md already states for Pay. `bookingsOpen`,
                `BookingsModal` and /reservation/[id] are untouched. */}
            <DestTile
              Icon={CalendarCheck}
              title="Reservations"
              summary="Upcoming and past"
              onClick={() => setBookingsOpen(true)}
            />
          </DestGrid>

          <DestGrid>
            {/* PARKED. Share's sheet exists and stays wired so un-parking is
                a `soon` removal alone; Gift has no sheet at all yet. */}
            <DestTile
              Icon={Share2}
              title="Share"
              summary=""
              soon
              onClick={() => setShareOpen(true)}
            />
            <DestTile Icon={Gift} title="Gift" summary="" soon />
          </DestGrid>

          <DestGrid>
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

          {/* Both parked, so this is a dead ROW (MESITA-1641), and it sits
              BELOW Settings and Help (MESITA-1642). That was the argument for
              the ordering all along — the two most-reached cells in the tail
              must not be pushed under a pair that opens nothing — and for one
              release this row was above them anyway. */}
          <DestGrid>
            <DestTile
              Icon={Bot}
              title="Connector"
              summary=""
              soon
              onClick={() => setAiOpen(true)}
            />
            {/* No friends surface exists — the nearest thing is a Contacts
                toggle in Settings ("Find friends already on Mesita"). Visible
                and inert beats a cell that opens nothing. */}
            <DestTile Icon={Users} title="Friends" summary="" soon />
          </DestGrid>

          {/* About closes the page, full width. It holds what nothing else
              does: the version, and the Legal group that MOVED out of
              Settings (MESITA-1641) — a copy there would have been a second
              door to terms and privacy. The `Mesita · v2.4.1` footer line
              this replaces is gone; `APP_VERSION` is the one source. */}
          <DestGrid>
            <DestTile
              Icon={Info}
              title="About"
              summary={`Mesita · ${APP_VERSION}`}
              full
              onClick={() => setAboutOpen(true)}
            />
          </DestGrid>
        </div>
      </div>

      {/* All modals kept mounted; LocalSheet plays the exit animation before
          going inert. */}
      <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} />
      <CardsModal open={cardsOpen} onClose={() => setCardsOpen(false)} />
      <AiConnectModal open={aiOpen} onClose={() => setAiOpen(false)} />
      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
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
        // The two doors the card gave up (MESITA-1646). Instagram is the only
        // reach door and the Class ladder is the only entrance for an invite
        // PIN, so these are not conveniences — without them those surfaces
        // are unreachable. Profile is NOT here: it is a grid cell now, and a
        // second door to a surface one tap away is MESITA-1609's rule.
        onOpenInstagram={() => setVerifyOpen(true)}
        onOpenClass={() => setClassOpen(true)}
      />
    </div>
  );
}
