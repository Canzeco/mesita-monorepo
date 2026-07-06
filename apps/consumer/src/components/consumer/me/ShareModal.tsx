"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, Share2, UserPlus } from "lucide-react";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

// Compact share sheet opened from the Me page's Share box. Leads with the
// friend invite (native share sheet or clipboard copy) and links out to the
// full Invite page for the partner audiences (businesses, creators, agencies).

const SHARE_URL = "https://www.mesita.ai";
const SHARE_TITLE = "Come join me on Mesita";
const SHARE_TEXT = "Join me on Mesita — your seat at the table.";

export function ShareModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const payload = { title: SHARE_TITLE, text: SHARE_TEXT, url: SHARE_URL };
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share(payload);
        return;
      }
    } catch {
      // user dismissed the native sheet — fall through to copy
    }
    void copy();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${SHARE_TEXT} ${SHARE_URL}`);
      setCopied(true);
      toast.success("Invite link copied.");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("Couldn't copy the link.");
    }
  }

  return (
    <LocalSheet open={open} onClose={onClose} ariaLabel="Share Mesita">
      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto p-5">
        <div className="flex items-center gap-3">
          <span className="bg-pink-gradient flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white">
            <UserPlus className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-display text-xl font-semibold tracking-tight">
              Invite a friend
            </h2>
            <p className="text-muted-foreground text-[12px]">
              Your seat at the table — pass it on
            </p>
          </div>
        </div>

        <div className="bg-pink-gradient mt-5 overflow-hidden rounded-2xl p-5 text-white shadow-sm">
          <p className="font-display text-lg leading-snug font-bold tracking-tight">
            Bring someone to the table
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-white/85">
            Send them Mesita — discounts at partner spots, reservations, and
            rewards. Free to join.
          </p>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => void share()}
            className="bg-foreground text-background flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold transition active:scale-[0.99]"
          >
            <Share2 className="h-4 w-4" />
            Share invite
          </button>
          <button
            type="button"
            onClick={() => void copy()}
            className="border-border bg-card hover:bg-muted flex items-center justify-center gap-2 rounded-xl border py-3.5 text-sm font-semibold transition active:scale-[0.99]"
          >
            {copied ? (
              <Check className="h-4 w-4 text-emerald-600" strokeWidth={3} />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>

        <Link
          href={CONSUMER_ROUTES.share}
          onClick={onClose}
          className={cn(
            "text-muted-foreground hover:text-foreground mt-4 block text-center text-[12.5px] font-medium underline underline-offset-4",
          )}
        >
          Invite businesses, creators &amp; agencies
        </Link>
      </div>
    </LocalSheet>
  );
}
