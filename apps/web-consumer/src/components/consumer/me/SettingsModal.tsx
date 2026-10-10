"use client";

import {
  Bell,
  Download,
  MessageSquare,
  Globe,
  Languages,
  MapPin,
  Settings as SettingsIcon,
  Trash2,
} from "lucide-react";
import { useState } from "react";
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
  StoredSelectRow,
  StoredToggleRow,
} from "@/components/consumer/me/settings-rows";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// Device-level preferences, grouped. Every toggle and select persists to
// localStorage; the only server writes on this page are Delete account and
// Sign out.

const PREF_KEYS = {
  push: "mesita:notif:push",
  location: "mesita:perm:location",
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
  const [deleteOpen, setDeleteOpen] = useState(false);

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
              sub="Reservations and updates"
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

          {/* Contact lives here: Support has no contact reference of any
              kind, so this is the only door to a human in the product. */}
          <SettingsGroup title="Your account">
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

          {/* Sign out is an account control, so it sits with the rest of
              them. Last group on purpose: nothing below it but the
              version. */}
          <SettingsGroup title="Session">
            <SignOutButton
              redirectTo="/"
              className="hover:bg-muted flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold transition"
            />
          </SettingsGroup>

          <p className="text-muted-foreground type-body text-center">
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
