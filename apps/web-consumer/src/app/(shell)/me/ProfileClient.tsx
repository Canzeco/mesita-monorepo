"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  Bot,
  Crown,
  Instagram,
  HelpCircle,
  MessageCircle,
  Settings as SettingsIcon,
  Share2,
  UserRound,
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
import { errMsg, formatCompactCount } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import {
  apiFetchConsumerMetrics,
  apiFetchConsumerProfile,
  type ConsumerProfile,
} from "@/lib/api/profile";
import { CLASSES } from "@/lib/consumer-data";
import { useConsumerClass } from "@/lib/class-context";
import { BoxRow } from "./profile-sections";
import { ProfileSummaryCard } from "./ProfileSummaryCard";

// The Me surface — Membership Face Card + modular boxes (MESITA-904), ordered
// Instagram → Class → Personal details → Settings → Metrics → Share → AI →
// Help → Contact → Sign out (MESITA-955: IG above Class; box summaries mirror
// the card's live IG / Class status). Flat page at /me; `openSettings` opens
// Settings on arrival for the legacy /me/settings deep link.
export function ProfileClient({
  openSettings = false,
}: {
  openSettings?: boolean;
}) {
  const supabase = useBrowserSupabase();
  const {
    key: classKey,
    origin,
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
        // Card metrics row prefers metrics EF (visits · saved). Profile
        // stats.visits is the fallback when metrics fails.
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

  // Same live lines as ProfileSummaryCard identity rows (MESITA-955).
  const classLabel =
    CLASSES.find((c) => c.id === classKey)?.label ?? "Standard";
  const handle = classHandle ?? profile?.instagram_handle ?? null;
  const igConnected = origin === "instagram" || Boolean(handle);
  const igSummary = igConnected
    ? [handle ? `@${handle}` : "Connected", formatCompactCount(followers)]
        .filter(Boolean)
        .join(" · ")
    : "Instagram not connected";

  return (
    <div className="flex h-full flex-col">
      <div className="scrollbar-hide flex-1 overflow-y-auto px-4 pt-5 pb-8">
        <div className="flex flex-col gap-3">
          <ProfileSummaryCard
            profile={profile}
            savedCents={savedCents}
            visits={visits}
            loading={loading}
          />

          {/* Demo emulation lives INSIDE the modals now: the class preview
              toggle on the Class modal, the Instagram toggle + follower input
              on the Instagram modal. */}

          {/* Conversion cluster — Instagram first (connect path), then Class
              ladder. Box summaries mirror the card's live status. */}
          <BoxRow
            Icon={Instagram}
            tint="pink"
            title="Instagram"
            summary={loading ? "…" : igSummary}
            onClick={() => setVerifyOpen(true)}
          />

          <BoxRow
            Icon={Crown}
            tint="amber"
            title="Class"
            summary={loading ? "…" : classLabel}
            onClick={() => setClassOpen(true)}
          />

          {/* Account management. */}
          <BoxRow
            Icon={UserRound}
            tint="sky"
            title="Personal details"
            summary="Name, phone, birthday, photo"
            onClick={() => profile && setEditOpen(true)}
            disabled={!profile}
          />

          <BoxRow
            Icon={SettingsIcon}
            tint="muted"
            title="Settings"
            summary="Notifications, privacy, language"
            onClick={() => setSettingsOpen(true)}
          />

          {/* Metrics — lifetime counters (MESITA-904). After account cluster,
              before outward/SOON cluster — retrospective, not conversion. */}
          <BoxRow
            Icon={Activity}
            tint="violet"
            title="Metrics"
            summary="Visits, places, reviews — your numbers"
            onClick={() => setMetricsOpen(true)}
          />

          {/* Secondary / support — least-frequent, outward-facing. */}
          <BoxRow
            Icon={Share2}
            tint="pink"
            title="Share"
            summary="Invite friends to Mesita"
            onClick={() => setShareOpen(true)}
            soon
          />

          {/* decision: Pato — Consumer MCP connect (MESITA-265), not a tip */}
          <BoxRow
            Icon={Bot}
            tint="violet"
            title="AI Connector"
            summary="Control your Mesita through ChatGPT, Claude or any chatbot · Premium"
            onClick={() => setAiOpen(true)}
            soon
          />

          {/* Help — how the reward program works + the tier ladder. Moved
              off the Rewards wallet (MESITA-809): that page is for doing,
              this is for understanding. */}
          <BoxRow
            Icon={HelpCircle}
            tint="sky"
            title="Help"
            summary="How rewards work · tiers · discounts"
            onClick={() => setHelpOpen(true)}
          />

          <BoxRow
            Icon={MessageCircle}
            tint="emerald"
            title="Contact"
            summary="Email, help, Instagram"
            onClick={() => setContactOpen(true)}
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
