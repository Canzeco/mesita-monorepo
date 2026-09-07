"use client";

import { FileText, Info, ScrollText } from "lucide-react";

import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { MESITA_PRIVACY_URL, MESITA_TERMS_URL } from "@/lib/mesita-contact";
import { APP_VERSION } from "@/lib/app-version";
import { SHEET_BODY_CLASS, SHEET_TITLE_CLASS } from "@/lib/ui-classes";
import { RowDivider, SettingsGroup, SettingsLinkRow } from "./settings-rows";

// About — the version and the legal small print (MESITA-1641).
//
// IT HOLDS WHAT NOTHING ELSE DOES. The cell was going to be a title over an
// empty sheet: the version already sat on the page as a footer line, and
// Terms and Privacy already had a Legal group inside Settings. So the Legal
// group MOVED here rather than being copied — Wallet's precedent
// (MESITA-1609), "removed, not demoted". There is still exactly one door to
// terms and one to privacy; they are just behind the cell whose name means
// "what this app is" instead of the one whose name means "change something".
//
// THE VERSION HAS ONE SOURCE. `APP_VERSION` feeds the About cell's summary
// line and this sheet, so the two can never disagree — which is exactly what
// a hardcoded string in a `<p>` at the bottom of the page was set up to do.
//
// The rows are `SettingsLinkRow`s on purpose: this sheet is small enough to
// have tempted a bespoke row, and a second link-row implementation is how two
// surfaces start rendering external links differently.
export function AboutModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <LocalSheet open={open} onClose={onClose} ariaLabel="About Mesita">
      <div className={SHEET_BODY_CLASS}>
        <div className="mb-4 flex items-center gap-3">
          <span className="bg-muted text-foreground flex h-12 w-12 shrink-0 items-center justify-center rounded-full">
            <Info className="h-5 w-5" />
          </span>
          <div>
            <h2 className={SHEET_TITLE_CLASS}>About Mesita</h2>
            <p className="text-muted-foreground text-xs">
              Version {APP_VERSION}
            </p>
          </div>
        </div>

        <SettingsGroup title="Legal">
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

        <p className="text-muted-foreground type-label mt-4 text-center">
          Mesita · {APP_VERSION}
        </p>
      </div>
    </LocalSheet>
  );
}
