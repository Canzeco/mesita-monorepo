"use client";

import { Bot, Copy, Sparkles } from "lucide-react";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import {
  IconCircle,
  RowDivider,
  SettingsGroup,
} from "@/components/consumer/me/settings-rows";
import { toast } from "@/lib/toast";

// How-to sheet from the Me page's AI box — explains connecting a Mesita
// profile to an external AI (ChatGPT, Claude, etc.). No OAuth product yet;
// this is the guest-facing instructions surface.

const PROFILE_PROMPT =
  "Use my Mesita profile when recommending places. I use Mesita for dining in Mexico City — prefer Verified Partners, my class rewards, and places I've saved.";

export function AiConnectModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(PROFILE_PROMPT);
      toast.success("Copied — paste it into your AI chat");
    } catch {
      toast("Couldn't copy — select the text manually");
    }
  }

  return (
    <LocalSheet open={open} onClose={onClose} ariaLabel="Connect Mesita to AI">
      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-violet-500/10 text-violet-600">
            <Bot className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-display text-xl font-semibold tracking-tight">
              AI
            </h2>
            <p className="text-muted-foreground text-[12px]">
              Connect your Mesita profile to an AI
            </p>
          </div>
        </div>

        <p className="text-muted-foreground mt-4 text-[13px] leading-relaxed">
          Tell ChatGPT, Claude, or any assistant that you use Mesita — paste a
          short profile note so recommendations match your class, saves, and
          Verified Partners.
        </p>

        <div className="mt-5">
          <SettingsGroup>
            <div className="px-4 py-3">
              <div className="mb-2 flex items-center gap-2">
                <IconCircle tint="violet">
                  <Sparkles className="h-[18px] w-[18px]" />
                </IconCircle>
                <span className="text-sm font-semibold">Starter prompt</span>
              </div>
              <p className="text-muted-foreground text-[12px] leading-relaxed">
                {PROFILE_PROMPT}
              </p>
            </div>
            <RowDivider />
            <button
              type="button"
              onClick={copyPrompt}
              className="hover:bg-muted flex w-full items-center gap-3 px-4 py-3 text-left transition"
            >
              <IconCircle tint="primary">
                <Copy className="h-[18px] w-[18px]" />
              </IconCircle>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">Copy prompt</span>
                <span className="text-muted-foreground block truncate text-[11px]">
                  Paste into your AI chat
                </span>
              </span>
            </button>
          </SettingsGroup>
        </div>
      </div>
    </LocalSheet>
  );
}
