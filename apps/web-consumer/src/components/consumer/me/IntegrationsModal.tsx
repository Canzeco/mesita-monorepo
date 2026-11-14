"use client";

// /me/integrations (MESITA-3954): one card of rows, behind Me's
// Integrations cell. Calendar opens its page; MCP is Soon and opens nothing
// (MESITA-3976, Pato: "MCP to soon, we said" — it was a working connector
// for an hour under MESITA-3971). Pro's plan card says Soon too.

import { CalendarDays, Plug } from "lucide-react";
import { MeScreen } from "@/components/consumer/me/MeScreen";
import {
  IconChip,
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
        <div className="flex w-full items-center gap-3 px-4 py-3 text-left" aria-disabled>
          <IconChip>
            <Plug className="h-[18px] w-[18px]" />
          </IconChip>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">
              MCP
              <span className="bg-muted text-muted-foreground type-meta ml-1.5 rounded-full px-1.5 py-0.5 align-middle font-semibold">
                Soon
              </span>
            </span>
            <span className="text-muted-foreground type-label block truncate">
              ChatGPT or Claude
            </span>
          </span>
        </div>
      </SettingsGroup>
    </MeScreen>
  );
}
