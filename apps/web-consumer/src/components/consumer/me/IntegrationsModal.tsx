"use client";

// /me/integrations (MESITA-3954): one card of rows, behind Me's
// Integrations cell. Calendar only since MESITA-3976 (Pato: "I don't really
// want an MCP rn. just leave it as soon in the pro plan"); MCP is a Soon perk
// on Plan's Pro card.

import { CalendarDays } from "lucide-react";
import { MeScreen } from "@/components/consumer/me/MeScreen";
import { SettingsGroup, SettingsLinkRow } from "@/components/consumer/me/settings-rows";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

export function IntegrationsModal() {
  return (
    <MeScreen title="Integrations">
      <SettingsGroup>
        <SettingsLinkRow
          Icon={CalendarDays}
          tint="muted"
          href={CONSUMER_ROUTES.mePages.integrationsCalendar}
          label="Calendar"
          sub="Google, Apple or Outlook"
        />
      </SettingsGroup>
    </MeScreen>
  );
}
