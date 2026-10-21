"use client";

// /me/connector — use Mesita from an AI assistant, like ChatGPT or Claude
// (Pato, MESITA-2562; Main's "MCP Access"). NOT BUILT: there is no endpoint
// and no token to hand out, so every line is tagged Soon and the page offers
// no button. It never names a plan: who gets it is not decided.

import { Plug } from "lucide-react";

import { MeScreen } from "@/components/consumer/me/MeScreen";
import { PerkList } from "@/components/consumer/me/perk-list";
import { IconCircle, SettingsGroup } from "./settings-rows";

export function ConnectorModal() {
  return (
    <MeScreen title="Connector">
      <SettingsGroup>
        <div className="flex items-start gap-3 px-4 py-3" data-connector>
          <IconCircle tint="muted">
            <Plug className="h-[18px] w-[18px]" />
          </IconCircle>
          <div className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">
              Mesita in your AI assistant
            </span>
            <span className="text-muted-foreground type-label block">
              Connect ChatGPT or Claude to your Mesita account.
            </span>
            <PerkList
              label="What it will do"
              items={[
                { text: "Search places", soon: true },
                { text: "Save favorites", soon: true },
                { text: "Request reservations", soon: true },
              ]}
            />
          </div>
        </div>
      </SettingsGroup>
    </MeScreen>
  );
}
