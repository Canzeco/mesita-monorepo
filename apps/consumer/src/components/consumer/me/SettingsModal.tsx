"use client";

import {
  Bell,
  Contact,
  Download,
  FileText,
  Globe,
  Languages,
  MapPin,
  ScrollText,
  Settings as SettingsIcon,
  Trash2,
  Users,
} from "lucide-react";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import {
  RowDivider,
  SettingsActionRow,
  SettingsGroup,
  SettingsLinkRow,
  SettingsStaticRow,
  StoredSelectRow,
  StoredToggleRow,
} from "@/components/consumer/me/settings-rows";

function SoonPill() {
  return (
    <span className="bg-muted text-muted-foreground shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase">
      Soon
    </span>
  );
}

// Device-level preferences, grouped. Everything here is client-only (no EF
// yet): the toggles + selects persist to localStorage; the legal links open
// the public site; export + delete are the two real account actions (delete
// hands off to the parent-owned DeleteAccountSheet so two LocalSheets never
// stack at the same z-layer).

const PREF_KEYS = {
  push: "mesita:notif:push",
  location: "mesita:perm:location",
  contacts: "mesita:perm:contacts",
  language: "mesita:pref:language",
  defaultCity: "mesita:pref:default-city",
};

const LANGUAGE_OPTIONS = [
  { value: "es", label: "Español" },
  { value: "en", label: "English" },
];

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
];

const TERMS_URL = "https://www.mesita.ai/terms";
const PRIVACY_URL = "https://www.mesita.ai/privacy";
const PRIVACY_EMAIL = "privacy@mesita.ai";

export function SettingsModal({
  open,
  onClose,
  onDeleteAccount,
}: {
  open: boolean;
  onClose: () => void;
  onDeleteAccount: () => void;
}) {
  return (
    <LocalSheet open={open} onClose={onClose} ariaLabel="Settings">
      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto p-5">
        <div className="flex items-center gap-3">
          <span className="bg-foreground/[0.06] text-foreground/70 flex h-12 w-12 shrink-0 items-center justify-center rounded-full">
            <SettingsIcon className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-display text-xl font-semibold tracking-tight">
              Settings
            </h2>
            <p className="text-muted-foreground text-[12px]">
              Preferences on this device
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-6">
          <SettingsGroup title="Notifications">
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
              sub="Join your campus circles"
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
              href={TERMS_URL}
              label="Terms of use"
              sub="mesita.ai/terms"
              external
            />
            <RowDivider />
            <SettingsLinkRow
              Icon={FileText}
              tint="muted"
              href={PRIVACY_URL}
              label="Privacy policy"
              sub="mesita.ai/privacy"
              external
            />
          </SettingsGroup>

          <SettingsGroup title="Privacy & data">
            <SettingsLinkRow
              Icon={Download}
              tint="emerald"
              href={`mailto:${PRIVACY_EMAIL}?subject=${encodeURIComponent(
                "Export my Mesita data",
              )}`}
              label="Export my data"
              sub={PRIVACY_EMAIL}
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

          <p className="text-muted-foreground text-center text-[11px]">
            Mesita · v2.4.1
          </p>
        </div>
      </div>
    </LocalSheet>
  );
}
