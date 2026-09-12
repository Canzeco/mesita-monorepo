"use client";

import {
  BarChart3,
  Bell,
  Contact,
  Download,
  MessageSquare,
  EyeOff,
  Globe,
  Images,
  Languages,
  MapPin,
  Settings as SettingsIcon,
  Trash2,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  MESITA_PRIVACY_EMAIL,
} from "@/lib/mesita-contact";
import { APP_VERSION } from "@/lib/app-version";
import { MeScreen } from "@/components/consumer/me/MeScreen";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { DeleteAccountSheet } from "@/components/consumer/DeleteAccountSheet";
import {
  RowDivider,
  SettingsActionRow,
  SettingsGroup,
  SettingsLinkRow,
  SettingsStaticRow,
  StoredSelectRow,
  StoredToggleRow,
  ToggleRow,
} from "@/components/consumer/me/settings-rows";
import {
  apiFetchConsumerProfile,
  apiUpdateConsumerProfile,
  type ConsumerProfile,
} from "@/lib/api/profile";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { errMsg } from "@/lib/utils";
import { toast } from "@/lib/toast";

function SoonPill() {
  return (
    <span className="bg-muted text-muted-foreground type-meta shrink-0 rounded-full px-2 py-0.5 font-bold tracking-wide uppercase">
      Soon
    </span>
  );
}

// Device-level preferences, grouped. Notifications / permissions / language
// persist to localStorage. Privacy toggles are EF-backed (MESITA-913).

const PREF_KEYS = {
  push: "mesita:notif:push",
  location: "mesita:perm:location",
  contacts: "mesita:perm:contacts",
  language: "mesita:pref:language",
  defaultCity: "mesita:pref:default-city",
} as const;

const LANGUAGE_OPTIONS = [
  { value: "es", label: "Español" },
  { value: "en", label: "English" },
] as const;

// Fallback location used to seed recommendations when the consumer hasn't
// shared their live location.
const CITY_OPTIONS = [
  { value: "cdmx", label: "Ciudad de México" },
  { value: "mty", label: "Monterrey" },
  { value: "gdl", label: "Guadalajara" },
  { value: "qro", label: "Querétaro" },
  { value: "pue", label: "Puebla" },
  { value: "cun", label: "Cancún" },
  { value: "tij", label: "Tijuana" },
] as const;

export function SettingsModal() {
  const supabase = useBrowserSupabase();
  const [profile, setProfile] = useState<ConsumerProfile | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  // Optimistic override while a privacy write is in flight; otherwise the
  // fetched profile is the source of truth (no setState-in-effect sync).
  const [privacyDraft, setPrivacyDraft] = useState<{
    privateAccount: boolean;
    showStories: boolean;
  } | null>(null);
  const [savingPrivacy, setSavingPrivacy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { consumer } = await apiFetchConsumerProfile(supabase);
        if (!cancelled) setProfile(consumer);
      } catch (e) {
        if (!cancelled) toast(errMsg(e, "Couldn't load your profile."));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const privateAccount =
    privacyDraft?.privateAccount ?? profile?.privacy_public === false;
  const showStories =
    privacyDraft?.showStories ?? profile?.privacy_show_stories !== false;

  async function persistPrivacy(
    draft: { privateAccount: boolean; showStories: boolean },
    patch: {
      privacy_public?: boolean;
      privacy_show_stories?: boolean;
    },
  ) {
    setPrivacyDraft(draft);
    setSavingPrivacy(true);
    try {
      const updated = await apiUpdateConsumerProfile(supabase, patch);
      setProfile(updated);
      setPrivacyDraft(null);
    } catch (e) {
      setPrivacyDraft(null);
      toast(errMsg(e, "Couldn't save privacy settings."));
    } finally {
      setSavingPrivacy(false);
    }
  }

  function onPrivateToggle() {
    const nextPrivate = !privateAccount;
    // Turning private ON hides Mesita stories by default; the guest can opt
    // back in with the second toggle. Turning private OFF leaves stories as-is.
    if (nextPrivate) {
      void persistPrivacy(
        { privateAccount: true, showStories: false },
        { privacy_public: false, privacy_show_stories: false },
      );
      return;
    }
    void persistPrivacy(
      { privateAccount: false, showStories },
      { privacy_public: true },
    );
  }

  function onStoriesToggle() {
    const next = !showStories;
    void persistPrivacy(
      { privateAccount, showStories: next },
      { privacy_show_stories: next },
    );
  }

  return (
    <MeScreen title="Settings">
      <div className="mb-4 flex items-center gap-3">
        <span className="bg-foreground/[0.06] text-foreground/70 flex h-12 w-12 shrink-0 items-center justify-center rounded-full">
          <SettingsIcon className="h-5 w-5" />
        </span>
        <p className="text-muted-foreground text-xs">
          Preferences on this device
        </p>
      </div>

        <div className="mt-5 flex flex-col gap-6">
          <SettingsGroup title="Alerts">
            <StoredToggleRow
              Icon={Bell}
              tint="amber"
              storageKey={PREF_KEYS.push}
              label="Push notifications"
              sub="Ticket updates and rewards"
            />
          </SettingsGroup>

          <SettingsGroup title="Community">
            <SettingsStaticRow
              Icon={Users}
              tint="violet"
              label="Communities"
              sub="Connect with your community"
              trailing={<SoonPill />}
            />
          </SettingsGroup>

          <SettingsGroup title="Permissions">
            <StoredToggleRow
              Icon={MapPin}
              tint="sky"
              storageKey={PREF_KEYS.location}
              label="Location"
              sub="Recommend places near you"
              defaultOn={false}
            />
            <RowDivider />
            <StoredToggleRow
              Icon={Contact}
              tint="violet"
              storageKey={PREF_KEYS.contacts}
              label="Contacts"
              sub="Find friends already on Mesita"
              defaultOn={false}
            />
          </SettingsGroup>

          <SettingsGroup title="Privacy">
            <ToggleRow
              Icon={EyeOff}
              tint="rose"
              label="Private account"
              sub="When on, other guests see you as anonymous in the social feed and on reviews. Your Instagram can stay public — this only affects Mesita."
              on={privateAccount}
              onToggle={onPrivateToggle}
              disabled={!profile || savingPrivacy}
            />
            <RowDivider />
            <ToggleRow
              Icon={Images}
              tint="violet"
              label="Show stories on Mesita"
              sub="Let other Mesita guests see your story activity. Separate from posting to Instagram."
              on={showStories}
              onToggle={onStoriesToggle}
              disabled={!profile || savingPrivacy}
            />
          </SettingsGroup>

          <SettingsGroup title="Preferences">
            <StoredSelectRow
              Icon={Languages}
              tint="primary"
              storageKey={PREF_KEYS.language}
              label="Language"
              sub="App language"
              options={LANGUAGE_OPTIONS}
              defaultValue="es"
            />
            <RowDivider />
            <StoredSelectRow
              Icon={Globe}
              tint="emerald"
              storageKey={PREF_KEYS.defaultCity}
              label="Default location"
              sub="Used when location isn't shared"
              options={CITY_OPTIONS}
              defaultValue="cdmx"
            />
          </SettingsGroup>

          {/* Off the page and in here (MESITA-1634). Metrics was a grid cell
              and is a number you check occasionally, not one you navigate by.
              Contact came off the grid on instruction and is kept rather than
              deleted: HelpModal has no contact or support reference of any
              kind, so this is the only door to a human in the product. */}
          <SettingsGroup title="Your account">
            <SettingsLinkRow
              Icon={BarChart3}
              tint="muted"
              href={CONSUMER_ROUTES.mePages.settingsMetrics}
              label="Metrics"
              sub="Saved, visits, reviews"
            />
            <RowDivider />
            <SettingsLinkRow
              Icon={MessageSquare}
              tint="muted"
              href={CONSUMER_ROUTES.mePages.settingsContact}
              label="Contact"
              sub="Talk to us"
            />
          </SettingsGroup>

          <SettingsGroup title="Your data">
            <SettingsLinkRow
              Icon={Download}
              tint="emerald"
              href={`mailto:${MESITA_PRIVACY_EMAIL}?subject=${encodeURIComponent(
                "Export my Mesita data",
              )}`}
              label="Export my data"
              sub={MESITA_PRIVACY_EMAIL}
            />
            <RowDivider />
            <SettingsActionRow
              Icon={Trash2}
              tint="destructive"
              label="Delete account"
              sub="Permanently delete your account"
              destructive
              onClick={() => setDeleteOpen(true)}
            />
          </SettingsGroup>

          {/* Sign out left the page body for here (MESITA-1634) — it is an
              account control and the rest of them are in this sheet. Last
              group on purpose: nothing below it but the version. */}
          <SettingsGroup title="Session">
            <SignOutButton
              redirectTo="/"
              className="hover:bg-muted flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold transition"
            />
          </SettingsGroup>

          <p className="text-muted-foreground type-label text-center">
            Mesita · {APP_VERSION}
          </p>
        </div>
      <DeleteAccountSheet
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
      />
    </MeScreen>
  );
}
