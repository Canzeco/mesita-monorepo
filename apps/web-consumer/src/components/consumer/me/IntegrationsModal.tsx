"use client";

// /me/integrations (MESITA-3954, Pato: "Rename MCP for integrations and make
// a list of integrations, and one integration is the MCP"). One card of two
// rows, and only these two (MESITA-3971, Pato: "ONLY THESE ONES. BUT
// ACTUALLY MAKE THEM WORK"): Calendar, the reservations feed for Google,
// Apple and Outlook; MCP, the connector for Claude and ChatGPT.

import { CalendarDays, Plug } from "lucide-react";
import { MeScreen } from "@/components/consumer/me/MeScreen";
import {
  RowDivider,
  SettingsGroup,
  SettingsLinkRow,
} from "@/components/consumer/me/settings-rows";
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
        <RowDivider />
        <SettingsLinkRow
          Icon={Plug}
          tint="muted"
          href={CONSUMER_ROUTES.mePages.integrationsMcp}
          label="MCP"
          sub="Claude or ChatGPT"
        />
      </SettingsGroup>
    </MeScreen>
  );
}
