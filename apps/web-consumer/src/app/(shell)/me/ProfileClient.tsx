"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bot,
  Instagram,
  MoreHorizontal,
  Settings as SettingsIcon,
  UserRound,
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
import { useConsumerClass } from "@/lib/class-context";
import { BoxRow } from "./profile-sections";
import { ProfileSummaryCard } from "./ProfileSummaryCard";

// The Me surface — Passport + SEVEN boxes (decision: Pato, MESITA-1123):
//
//   Instagram · Class · Plan     who you are and what you pay
//   Profile · Settings           your account
//   AI Connector · More          the tool that isn't live yet, then the tail
//
// Twelve boxes made this a wall to scroll, with parked rows (Credits, Gift,
// Share) sitting between live ones so the page read as mostly-unfinished.
// The long tail moved into MoreModal; the split is by FREQUENCY, not
// importance. Every summary reads live wherever the page already holds the
// data — a box that states a fact the guest can check beats one that lists
// its own fields.
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
  // redirect here with a status query; confirm it with a toast (the full page
  // load already re-seeded the real membership upstream). Read straight off
  // the URL so the page carries no prerender-bailout requirement.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("subscription");
    if (status === "success") {
      toast.success("You're Mesita Premium — welcome in.");
    } else if (status === "cancelled") {
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

  return (
    <div className="flex h-full flex-col">
      <div className="scrollbar-hide flex-1 overflow-y-auto px-4 pt-5 pb-8">
        <div className="flex flex-col gap-3">
          <ProfileSummaryCard
            profile={profile}
            loading={loading}
            onOpenClass={() => setClassOpen(true)}
            onOpenPlan={() => setPlanOpen(true)}
            onOpenInstagram={() => setVerifyOpen(true)}
          />

          {/* Identity — the door you came through, then the rung. */}
          <BoxRow
            Icon={Instagram}
            title="Instagram"
            summary={loading ? "…" : igSummary}
            onClick={() => setVerifyOpen(true)}
          />

          <BoxRow
            Icon={ClassIcon}
            title="Class"
            summary={loading ? "…" : classSummary}
            onClick={() => setClassOpen(true)}
          />

          {/* Money — the plan axis lives on its own surface (Stripe checkout
              + manage), never inside the Class sheet. */}
          <BoxRow
            Icon={PREMIUM_PLAN_ICON}
            title="Plan"
            summary={loading ? "…" : planSummary}
            onClick={() => setPlanOpen(true)}
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

          {/* Parked, so it sits under the live account rows (decision: Pato). */}
          {/* decision: Pato — Consumer MCP connect (MESITA-265), not a tip */}
          <BoxRow
            Icon={Bot}
            title="AI Connector"
            summary="Use Mesita from ChatGPT or Claude (MCP)"
            onClick={() => setAiOpen(true)}
            soon
          />

          {/* The long tail: Cards · Credits · Gift · Share · Metrics · Help · Contact. */}
          <BoxRow
            Icon={MoreHorizontal}
            title="More"
            summary="Cards, Credits, Gift, Share, Metrics, Help, Contact"
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
      <MoreModal
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        onOpenCards={() => setCardsOpen(true)}
        // Credits is a ROUTE, not a sheet — the stack needs the whole card.
        onOpenCredits={() => router.push("/credits")}
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
