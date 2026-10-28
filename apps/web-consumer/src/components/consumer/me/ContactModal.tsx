"use client";

import type { ReactNode } from "react";
import { HelpCircle, Mail } from "lucide-react";
import { Instagram } from "@/components/shared/instagram-icon";
import { MeScreen } from "@/components/consumer/me/MeScreen";
import {
  MESITA_INSTAGRAM_HANDLE,
  MESITA_INSTAGRAM_URL,
  MESITA_SUPPORT_EMAIL,
} from "@/lib/mesita-contact";
import {
  IconChip,
  MeLead,
  RowDivider,
  SettingsGroup,
} from "@/components/consumer/me/settings-rows";

// Contact sheet opened from the Me page's Contact box — the direct lines to
// Mesita: support email, help, and Instagram DMs.
//
// THE FRAME IS ContactFrame, AND THE FALLBACK WEARS IT (MESITA-2701): the
// title, the reply-time lead line, and the white card under it
// exist once; /me/settings/contact's loading.tsx fills the card with row
// silhouettes (Pato, MESITA-2701: "the placeholders must be similar to the
// page you are loading, like the sizes").

/** Contact's page, its rows passed in: the page's three lines out, or the
 *  fallback's silhouettes. `children` lands after the card (the fallback's
 *  status line). */
export function ContactFrame({
  rows,
  children,
}: {
  rows: ReactNode;
  children?: ReactNode;
}) {
  return (
    <MeScreen title="Contact">
      <MeLead>We usually reply within a day.</MeLead>
      <SettingsGroup>{rows}</SettingsGroup>
      {children}
    </MeScreen>
  );
}

export function ContactModal() {
  return (
    <ContactFrame
      rows={
        <>
          <a
            href={`mailto:${MESITA_SUPPORT_EMAIL}`}
            className="hover:bg-muted flex w-full items-center gap-3 px-4 py-3 text-left transition"
          >
            <IconChip>
              <Mail className="h-[18px] w-[18px]" />
            </IconChip>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">Email us</span>
              <span className="text-muted-foreground type-label block truncate">
                {MESITA_SUPPORT_EMAIL}
              </span>
            </span>
          </a>
          <RowDivider />
          <a
            href={`mailto:${MESITA_SUPPORT_EMAIL}?subject=${encodeURIComponent(
              "I need help with Mesita",
            )}`}
            className="hover:bg-muted flex w-full items-center gap-3 px-4 py-3 text-left transition"
          >
            <IconChip>
              <HelpCircle className="h-[18px] w-[18px]" />
            </IconChip>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">Get help</span>
              <span className="text-muted-foreground type-label block truncate">
                Report a problem or ask a question
              </span>
            </span>
          </a>
          <RowDivider />
          <a
            href={MESITA_INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:bg-muted flex w-full items-center gap-3 px-4 py-3 text-left transition"
          >
            <IconChip tint="instagram">
              <Instagram className="h-[18px] w-[18px]" />
            </IconChip>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">Instagram</span>
              <span className="text-muted-foreground type-label block truncate">
                {MESITA_INSTAGRAM_HANDLE}
              </span>
            </span>
          </a>
        </>
      }
    />
  );
}
