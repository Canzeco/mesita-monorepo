"use client";

import { FileText, MessageSquare, ScrollText } from "lucide-react";
import { MESITA_PRIVACY_URL, MESITA_TERMS_URL } from "@/lib/mesita-contact";
import { APP_VERSION } from "@/lib/app-version";
import { MeScreen } from "@/components/consumer/me/MeScreen";
import { SignOutButton } from "@/components/auth/SignOutButton";
import {
  RowDivider,
  SettingsGroup,
  SettingsLinkRow,
} from "@/components/consumer/me/settings-rows";
import { PhoneRow } from "@/components/consumer/me/PhoneRow";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// Only rows that do something. Push, Location, Language and Default location
// saved to localStorage and nothing read them; Export my data was a mailto;
// Delete account went with them (Pato, MESITA-2589: "remove stupid fake
// buttons from settings"). The one server write left here is Sign out.
// There is no Privacy group: connecting Instagram means you show in Social,
// always (Pato, MESITA-2552: "if you connect your … instagram, is because
// you want to be seen").

export function SettingsModal() {
  return (
    <MeScreen title="Settings">
      <div className="flex flex-col gap-6">
        {/* Contact is the only door to a human. Support, below, is legal. */}
        <SettingsGroup title="Your account">
          {/* The login phone left Me's card for here (MESITA-2547). */}
          <PhoneRow />
          <RowDivider />
          <SettingsLinkRow
            Icon={MessageSquare}
            tint="muted"
            href={CONSUMER_ROUTES.mePages.settingsContact}
            label="Contact"
            sub="Talk to us"
          />
        </SettingsGroup>

        {/* Sign out is an account control, so it sits with the rest of
            them. Support follows: legal moved off its own tile
            (MESITA-2169) and /me/help 308s here. Nothing below Support
            but the version, which stays one line. */}
        <SettingsGroup title="Session">
          <SignOutButton
            redirectTo="/"
            className="hover:bg-muted flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold transition"
          />
        </SettingsGroup>

        <SettingsGroup title="Support">
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

        <p className="text-muted-foreground type-body text-center">
          Mesita · {APP_VERSION}
        </p>
      </div>
    </MeScreen>
  );
}
