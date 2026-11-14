"use client";

// /me/integrations (MESITA-3954, Pato: "Rename MCP for integrations and make
// a list of integrations, and one integration is the MCP"). One card of
// rows: Calendar opens its page; MCP for ChatGPT or Claude is Soon and opens
// nothing.

import { CalendarDays, ChevronRight, Plug } from "lucide-react";
import { MeScreen } from "@/components/consumer/me/MeScreen";
import { IconChip, RowDivider, SettingsGroup } from "@/components/consumer/me/settings-rows";
import { PushLink } from "@/components/consumer/nav/PushLink";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

const ROW_CLASS = "flex w-full items-center gap-3 px-4 py-3 text-left";

export function IntegrationsModal() {
  return (
    <MeScreen title="Integrations">
      <SettingsGroup>
        <PushLink
          href={CONSUMER_ROUTES.mePages.integrationsCalendar}
          className={`${ROW_CLASS} hover:bg-muted transition`}
        >
          <IconChip>
            <CalendarDays className="h-[18px] w-[18px]" />
          </IconChip>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Calendar</span>
            <span className="text-muted-foreground type-label block truncate">
              Google, Apple or Outlook
            </span>
          </span>
          <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
        </PushLink>
        <RowDivider />
        <div className={ROW_CLASS} aria-disabled>
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
