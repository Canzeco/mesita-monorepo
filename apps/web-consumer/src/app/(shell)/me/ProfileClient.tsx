"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Bot,
  Gift,
  HelpCircle,
  Instagram,
  Mail,
  Settings as SettingsIcon,
  Share2,
  UserRound,
  Wallet,
} from "lucide-react";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { DeleteAccountSheet } from "@/components/consumer/DeleteAccountSheet";
import { EditProfileSheet } from "@/components/consumer/EditProfileSheet";
import { InstagramModal } from "@/components/consumer/me/InstagramModal";
import { ShareModal } from "@/components/consumer/me/ShareModal";
import { ClassModal } from "@/components/consumer/me/ClassModal";
import { SettingsModal } from "@/components/consumer/me/SettingsModal";
import { ContactModal } from "@/components/consumer/me/ContactModal";
import { HelpModal } from "@/components/consumer/me/HelpModal";
import { MetricsModal } from "@/components/consumer/me/MetricsModal";
import { AiConnectModal } from "@/components/consumer/me/AiConnectModal";
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
  CLASS_ICONS,
  PREMIUM_PLAN_ICON,
  PREMIUM_PLAN_PRICE_MXN,
} from "@/lib/consumer-data";
import { useConsumerClass } from "@/lib/class-context";
import { BoxRow } from "./profile-sections";
import { ProfileSummaryCard } from "./ProfileSummaryCard";

// The Me surface — Passport + modular boxes, ordered identity → money →
// account → support (MESITA-1079 v2):
//
//   Class · Instagram      who you are, and the door you came through
//   Plan · Yums · Gift     what you pay and what you hold
//   Share                  outward
//   Personal details · Metrics   your own record
//   AI Connector · Help · Contact · Settings   tools and support
//
// Every summary reads live wherever the page already holds the data — a box
// that states a fact the guest can check beats one that lists its own fields.
// Yums and Gift are PARKED (`soon`): the credit has no table, EF or type yet,
// so the boxes state the intent without inventing a balance.
//
// Flat page at /me; `openSettings` opens Settings on arrival for the legacy
// /me/settings deep link.
export function ProfileClient({
  openSettings = false,
}: {
  openSettings?: boolean;
}) {
  const supabase = useBrowserSupabase();
  const router = useRouter();
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
  const [settingsOpen, setSettingsOpen] = useState(openSettings);
  const [contactOpen, setContactOpen] = useState(false);
  const [metricsOpen, setMetricsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

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
  const personalSummary =
    [name, formatPhoneDisplay(profile?.phone)].filter(Boolean).join(" · ") ||
    "Name, phone, birthday, photo";

  const metricsSummary = [
    savedCents == null ? null : `${formatCurrency(savedCents)} saved`,
    visits == null ? null : `${visits} visits`,
  ]
    .filter(Boolean)
    .join(" · ");

  const ClassIcon = CLASS_ICONS[classKey];

  return (
    <div className="flex h-full flex-col">
      <div className="scrollbar-hide flex-1 overflow-y-auto px-4 pt-5 pb-8">
        <div className="flex flex-col gap-3">
          <ProfileSummaryCard
            profile={profile}
            loading={loading}
            onOpenClass={() => setClassOpen(true)}
          />

          {/* Identity — the class you hold, then the door you came through. */}
          <BoxRow
            Icon={ClassIcon}
            tint="amber"
            title="Class"
            summary={loading ? "…" : classSummary}
            onClick={() => setClassOpen(true)}
          />

          <BoxRow
            Icon={Instagram}
            tint="pink"
            title="Instagram"
            summary={loading ? "…" : igSummary}
            onClick={() => setVerifyOpen(true)}
          />

          {/* Money — the plan axis lives on its own surface (Stripe checkout
              + manage), never inside the Class sheet. */}
          <BoxRow
            Icon={PREMIUM_PLAN_ICON}
            tint="premium"
            title="Plan"
            summary={loading ? "…" : planSummary}
            onClick={() => router.push("/subscribe/premium")}
          />

          {/* Yums + Gift are PARKED: no yums table, EF or type exists yet, so
              neither box may quote a balance. Un-park = drop `soon` and give
              each a sheet. */}
          <BoxRow
            Icon={Wallet}
            tint="pink"
            title="Yums"
            summary="Mesita credit you earn and spend at the bill"
            onClick={() => undefined}
            soon
          />

          <BoxRow
            Icon={Gift}
            tint="pink"
            title="Gift"
            summary="Buy Yums or send them to a friend"
            onClick={() => undefined}
            soon
          />

          <BoxRow
            Icon={Share2}
            tint="pink"
            title="Share"
            summary="Invite a friend, both get Yums"
            onClick={() => setShareOpen(true)}
            soon
          />

          {/* Your own record. */}
          <BoxRow
            Icon={UserRound}
            tint="sky"
            title="Personal details"
            summary={loading ? "…" : personalSummary}
            onClick={() => profile && setEditOpen(true)}
            disabled={!profile}
          />

          <BoxRow
            Icon={BarChart3}
            tint="violet"
            title="Metrics"
            summary={
              loading
                ? "…"
                : metricsSummary || "Visits, places, reviews — your numbers"
            }
            onClick={() => setMetricsOpen(true)}
          />

          {/* Tools + support. */}
          {/* decision: Pato — Consumer MCP connect (MESITA-265), not a tip */}
          <BoxRow
            Icon={Bot}
            tint="violet"
            title="AI Connector"
            summary="Use Mesita from your chatbot"
            onClick={() => setAiOpen(true)}
            soon
          />

          <BoxRow
            Icon={HelpCircle}
            tint="sky"
            title="Help"
            summary="How the discount works"
            onClick={() => setHelpOpen(true)}
          />

          <BoxRow
            Icon={Mail}
            tint="emerald"
            title="Contact"
            summary="support@mesita.ai"
            onClick={() => setContactOpen(true)}
          />

          <BoxRow
            Icon={SettingsIcon}
            tint="muted"
            title="Settings"
            summary="Notifications, privacy, language"
            onClick={() => setSettingsOpen(true)}
          />

          <SignOutButton
            redirectTo="/"
            className="border-border bg-card hover:bg-muted mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border py-4 text-sm font-semibold transition"
          />
          <p className="text-muted-foreground -mt-1 text-center text-[11px]">
            Mesita · v2.4.1
          </p>
        </div>
      </div>

      {/* All modals kept mounted; LocalSheet plays the exit animation before
          going inert. */}
      <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} />
      <AiConnectModal open={aiOpen} onClose={() => setAiOpen(false)} />
      <ClassModal
        open={classOpen}
        onClose={() => setClassOpen(false)}
        onConnectInstagram={openVerify}
      />
      <InstagramModal open={verifyOpen} onClose={() => setVerifyOpen(false)} />
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
    </div>
  );
}
