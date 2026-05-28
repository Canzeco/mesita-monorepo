"use client";

import { ChevronRight } from "lucide-react";
import { toast } from "@/lib/toast";

// WhatsApp reminders row. Horizontal iOS Settings–style layout matching
// CalendarConnectBox — icon, label + value, chevron — so the two stack
// inside one grouped card on /reservations and read as a single
// connector list.

export function WhatsAppRemindersBox() {
  function onConnect() {
    toast.action(
      "WhatsApp reminders are coming soon — confirmations + day-of pings on your phone.",
      { label: "Notify me", onClick: () => {} },
    );
  }
  return (
    <button
      type="button"
      onClick={onConnect}
      aria-label="Turn on WhatsApp reminders"
      className="hover:bg-muted/40 flex w-full items-center gap-3 px-3 py-3 text-left transition active:bg-muted/60"
    >
      <WhatsAppLogo />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-display text-[14px] leading-tight font-semibold">
          Reminders
        </span>
        <span className="text-muted-foreground mt-0.5 text-[12px] leading-tight">
          Pings on WhatsApp
        </span>
      </span>
      <ChevronRight className="text-muted-foreground/70 h-4 w-4 shrink-0" />
    </button>
  );
}

function WhatsAppLogo() {
  return (
    <svg
      viewBox="0 0 32 32"
      className="h-8 w-8 shrink-0"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect width="32" height="32" rx="6" fill="#25D366" />
      <path
        d="M22.8 9.2A9.5 9.5 0 0 0 16 6.4a9.6 9.6 0 0 0-8.3 14.4l-1 4.3 4.4-1.1a9.6 9.6 0 0 0 4.9 1.3h.0a9.6 9.6 0 0 0 6.8-16.1zM16 23.7h-.0a8 8 0 0 1-4.1-1.1l-.3-.2-2.6.7.7-2.6-.2-.3a8 8 0 1 1 6.5 3.5zm4.4-6c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1-.2-.1-1-.4-1.9-1.2-.7-.6-1.2-1.4-1.3-1.6-.1-.2 0-.4.1-.5l.4-.5c.1-.1.2-.3.3-.4.1-.2.0-.3 0-.4l-.7-1.7c-.2-.5-.4-.4-.5-.4h-.4c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 2s.8 2.3.9 2.5c.1.2 1.6 2.4 3.9 3.4l1.4.5c.6.2 1.1.2 1.6.1.5-.1 1.4-.6 1.6-1.2.2-.6.2-1.1.1-1.2-.1-.1-.3-.2-.5-.3z"
        fill="#ffffff"
      />
    </svg>
  );
}
