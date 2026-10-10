"use client";

// Support — Legal and the app version. Opened from the Me > Support tile
// (titled Support since MESITA-2080).

import { FileText, ScrollText } from "lucide-react";

import { MeScreen } from "@/components/consumer/me/MeScreen";
import { APP_VERSION } from "@/lib/app-version";
import { MESITA_PRIVACY_URL, MESITA_TERMS_URL } from "@/lib/mesita-contact";
import { RowDivider, SettingsGroup, SettingsLinkRow } from "./settings-rows";

export function HelpModal() {
  return (
    <MeScreen title="Support">
      <div className="flex flex-col gap-4">
        {/* ABOUT LIVES HERE (Pato, MESITA-1650: "Remove the about box at the
            bottom, that must go in help"). The About cell is gone from Me, so
            this sheet inherited what it held: the Legal group — which
            MESITA-1641 had already moved OUT of Settings — and the app
            version. Legal has never had two doors and still does not; it just
            moved one more time. `SettingsLinkRow` on purpose: a second
            link-row implementation is how two surfaces start rendering
            external links differently. */}
        <SettingsGroup title="Legal">
          <SettingsLinkRow
            Icon={ScrollText}
            tint="muted"
            href={MESITA_TERMS_URL}
            label="Terms of use"
            sub="consumer.mesita.ai/terms"
            external
          />
          <RowDivider />
          <SettingsLinkRow
            Icon={FileText}
            tint="muted"
            href={MESITA_PRIVACY_URL}
            label="Privacy policy"
            sub="consumer.mesita.ai/privacy"
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
