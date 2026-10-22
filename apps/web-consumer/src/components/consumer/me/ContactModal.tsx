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
  IconCircle,
  RowDivider,
  SettingsGroup,
} from "@/components/consumer/me/settings-rows";

// Contact sheet opened from the Me page's Contact box — the direct lines to
// Mesita: support email, help, and Instagram DMs.
//
// THE FRAME IS ContactFrame, AND THE FALLBACK WEARS IT (MESITA-2701): the
// title, the 48px mail disc and its line, and the white card 20px under
// exist once; /me/settings/contact's loading.tsx fills the card with row
// silhouettes (Pato, MESITA-2701: "the placeholders must be similar to the
// page you are loading, like the sizes").

/** The fixed words over the card: the mail disc and the reply time. */
function ContactIntro() {
  return (
    <div className="flex items-center gap-3">
      <span className="bg-muted text-muted-foreground flex h-12 w-12 shrink-0 items-center justify-center rounded-full">
        <Mail className="h-5 w-5" />
      </span>
      <p className="text-muted-foreground text-xs">
        We usually reply within a day
      </p>
    </div>
  );
}

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
    <MeScreen title="Contact us">
      <ContactIntro />
      <div className="mt-5">
        <SettingsGroup>{rows}</SettingsGroup>
      </div>
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
            <IconCircle tint="emerald">
              <Mail className="h-[18px] w-[18px]" />
            </IconCircle>
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
            <IconCircle tint="amber">
              <HelpCircle className="h-[18px] w-[18px]" />
            </IconCircle>
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
            <IconCircle tint="instagram">
              <Instagram className="h-[18px] w-[18px]" />
            </IconCircle>
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
