"use client";

import { HelpCircle, Instagram, Mail, MessageCircle } from "lucide-react";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import {
  IconCircle,
  RowDivider,
  SettingsGroup,
} from "@/components/consumer/me/settings-rows";

// Contact sheet opened from the Me page's Contact box — the direct lines to
// Mesita: support email, help, and Instagram DMs.

const SUPPORT_EMAIL = "support@mesita.ai";
const INSTAGRAM_URL = "https://instagram.com/mesita.ai";

export function ContactModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <LocalSheet open={open} onClose={onClose} ariaLabel="Contact Mesita">
      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sky-500/10 text-sky-600">
            <MessageCircle className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-display text-xl font-semibold tracking-tight">
              Contact us
            </h2>
            <p className="text-muted-foreground text-[12px]">
              We usually reply within a day
            </p>
          </div>
        </div>

        <div className="mt-5">
          <SettingsGroup>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="hover:bg-muted flex w-full items-center gap-3 px-4 py-3 text-left transition"
            >
              <IconCircle tint="emerald">
                <Mail className="h-[18px] w-[18px]" />
              </IconCircle>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">Email us</span>
                <span className="text-muted-foreground block truncate text-[11px]">
                  {SUPPORT_EMAIL}
                </span>
              </span>
            </a>
            <RowDivider />
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
                "I need help with Mesita",
              )}`}
              className="hover:bg-muted flex w-full items-center gap-3 px-4 py-3 text-left transition"
            >
              <IconCircle tint="amber">
                <HelpCircle className="h-[18px] w-[18px]" />
              </IconCircle>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">Get help</span>
                <span className="text-muted-foreground block truncate text-[11px]">
                  Report a problem or ask a question
                </span>
              </span>
            </a>
            <RowDivider />
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noreferrer"
              className="hover:bg-muted flex w-full items-center gap-3 px-4 py-3 text-left transition"
            >
              <IconCircle tint="instagram">
                <Instagram className="h-[18px] w-[18px]" />
              </IconCircle>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">Instagram</span>
                <span className="text-muted-foreground block truncate text-[11px]">
                  @mesita.ai
                </span>
              </span>
            </a>
          </SettingsGroup>
        </div>
      </div>
    </LocalSheet>
  );
}
