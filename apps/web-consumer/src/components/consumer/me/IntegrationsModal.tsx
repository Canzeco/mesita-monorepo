"use client";

// /me/integrations (MESITA-3954): one card of rows, behind Me's
// Integrations cell. Calendar opens its page; MCP is Soon and opens nothing
// (MESITA-3976, Pato: "MCP to soon, we said" — it was a working connector
// for an hour under MESITA-3971). Pro's plan card says Soon too.
//
// THE APPS' OWN MARKS AT EACH ROW'S RIGHT (MESITA-3984, Pato: "add them
// inside integrations, even if redundant … ALSO ADD ICONS FOR CHATGPT AND
// CLAUDE"): the words stay, the marks repeat them, before the arrow.

import { CalendarDays, ChevronRight, Plug } from "lucide-react";
import type { ReactNode } from "react";
import { MeScreen } from "@/components/consumer/me/MeScreen";
import { IconChip, RowDivider, SettingsGroup } from "@/components/consumer/me/settings-rows";
import { PushLink } from "@/components/consumer/nav/PushLink";
import { AssistantMarksRow } from "@/components/shared/assistant-marks";
import { CalendarMarksRow } from "@/components/shared/calendar-marks";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

const ROW_CLASS = "flex w-full items-center gap-3 px-4 py-3 text-left";
const MARK_SIZE = 28;

function RowBody({ icon, title, sub, marks }: { icon: ReactNode; title: ReactNode; sub: string; marks: ReactNode }) {
  return (
    <>
      <IconChip>{icon}</IconChip>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="text-muted-foreground type-label block truncate">{sub}</span>
      </span>
      {marks}
    </>
  );
}

export function IntegrationsModal() {
  return (
    <MeScreen title="Integrations">
      <SettingsGroup>
        <PushLink
          href={CONSUMER_ROUTES.mePages.integrationsCalendar}
          className={`${ROW_CLASS} hover:bg-muted transition`}
        >
          <RowBody
            icon={<CalendarDays className="h-[18px] w-[18px]" />}
            title="Calendar"
            sub="Google, Apple or Outlook"
            marks={<CalendarMarksRow size={MARK_SIZE} />}
          />
          <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
        </PushLink>
        <RowDivider />
        <div className={ROW_CLASS} aria-disabled>
          <RowBody
            icon={<Plug className="h-[18px] w-[18px]" />}
            title={
              <>
                MCP
                <span className="bg-muted text-muted-foreground type-meta ml-1.5 rounded-full px-1.5 py-0.5 align-middle font-semibold">
                  Soon
                </span>
              </>
            }
            sub="ChatGPT or Claude"
            marks={<AssistantMarksRow size={MARK_SIZE} />}
          />
          {/* The arrow's width, so both rows' marks end on one line. */}
          <span className="h-4 w-4 shrink-0" aria-hidden />
        </div>
      </SettingsGroup>
    </MeScreen>
  );
}
