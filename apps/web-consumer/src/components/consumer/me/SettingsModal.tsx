"use client";

import {
  Bell,
  Contact,
  Download,
  EyeOff,
  FileText,
  Globe,
  Images,
  Languages,
  MapPin,
  ScrollText,
  Settings as SettingsIcon,
  Trash2,
  Users,
} from "lucide-react";
import { useState } from "react";
import {
  MESITA_PRIVACY_EMAIL,
  MESITA_PRIVACY_URL,
  MESITA_TERMS_URL,
} from "@/lib/mesita-contact";
import { SHEET_TITLE_CLASS, SHEET_BODY_CLASS } from "@/lib/ui-classes";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
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
  apiUpdateConsumerProfile,
  type ConsumerProfile,
} from "@/lib/api/profile";
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

export function SettingsModal({
  open,
  onClose,
  onDeleteAccount,
  profile,
  onProfileChange,
}: {
  open: boolean;
  onClose: () => void;
  onDeleteAccount: () => void;
  profile: ConsumerProfile | null;
  onProfileChange: (next: ConsumerProfile) => void;
}) {
  const supabase = useBrowserSupabase();
  // Optimistic override while a privacy write is in flight; otherwise the
  // profile prop is the source of truth (no setState-in-effect sync).
  const [privacyDraft, setPrivacyDraft] = useState<{
    privateAccount: boolean;
    showStories: boolean;
  } | null>(null);
  const [savingPrivacy, setSavingPrivacy] = useState(false);

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
      onProfileChange(updated);
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
    <LocalSheet open={open} onClose={onClose} ariaLabel="Settings">
      <div className={SHEET_BODY_CLASS}>
        <div className="flex items-center gap-3">
          <span className="bg-foreground/[0.06] text-foreground/70 flex h-12 w-12 shrink-0 items-center justify-center rounded-full">
            <SettingsIcon className="h-5 w-5" />
          </span>
          <div>
            <h2 className={SHEET_TITLE_CLASS}>Settings</h2>
            <p className="text-muted-foreground text-xs">
              Preferences on this device
            </p>
          </div>
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

          <SettingsGroup title="Legal">
            <SettingsLinkRow
              Icon={ScrollText}
              tint="muted"
              href={MESITA_TERMS_URL}
              label="Terms of use"
              sub="mesita.ai/terms"
              external
            />
            <RowDivider />
            <SettingsLinkRow
              Icon={FileText}
              tint="muted"
              href={MESITA_PRIVACY_URL}
              label="Privacy policy"
              sub="mesita.ai/privacy"
              external
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
              onClick={() => {
                onClose();
                onDeleteAccount();
              }}
            />
          </SettingsGroup>

          <p className="text-muted-foreground type-label text-center">
            Mesita · v2.4.1
          </p>
        </div>
      </div>
    </LocalSheet>
  );
}
