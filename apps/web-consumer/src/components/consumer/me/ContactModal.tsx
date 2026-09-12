"use client";

import { HelpCircle, Instagram, Mail } from "lucide-react";
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

export function ContactModal() {
  return (
    <MeScreen title="Contact us">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sky-500/10 text-sky-600">
          <Mail className="h-5 w-5" />
        </span>
        <p className="text-muted-foreground text-xs">
          We usually reply within a day
        </p>
      </div>

        <div className="mt-5">
          <SettingsGroup>
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
          </SettingsGroup>
        </div>
    </MeScreen>
  );
}
