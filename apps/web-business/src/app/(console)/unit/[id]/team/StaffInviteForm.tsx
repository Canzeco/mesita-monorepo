"use client";

import { useState } from "react";
import { Loader2, MessageCircle, Phone as PhoneIcon, Send } from "lucide-react";

import { PhonePicker } from "@/components/ui/phone-picker";
import { PILL_BUTTON_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

type StaffChannel = "whatsapp" | "sms";

export function StaffInviteForm({
  busy,
  onSubmit,
  onPing,
}: {
  busy: boolean;
  onSubmit: (channel: StaffChannel, phone: string) => void | Promise<void>;
  onPing: (channel: StaffChannel, phone: string) => void | Promise<void>;
}) {
  const [channel, setChannel] = useState<StaffChannel>("whatsapp");
  const [phone, setPhone] = useState("");

  return (
    <form
      className="bg-muted/30 border-border/50 flex flex-col gap-3 rounded-xl border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(channel, phone.trim());
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
            channel === "whatsapp"
              ? "bg-whatsapp/15 text-whatsapp-deep"
              : "bg-sky-500/15 text-sky-700",
          )}
        >
          {channel === "whatsapp" ? (
            <MessageCircle className="h-3.5 w-3.5" />
          ) : (
            <PhoneIcon className="h-3.5 w-3.5" />
          )}
          Sending via {channel === "whatsapp" ? "WhatsApp" : "SMS"}
        </span>
      </div>

      <div className="flex w-full flex-col gap-3">
        <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center">
          <div className="border-border bg-background flex items-center overflow-hidden rounded-full border p-0.5 text-[12px] font-semibold">
            {(["whatsapp", "sms"] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setChannel(c)}
                className={cn(
                  "inline-flex min-w-[108px] items-center justify-center gap-1.5 rounded-full px-3 py-1.5 transition",
                  channel === c
                    ? c === "whatsapp"
                      ? "bg-whatsapp text-white shadow-sm"
                      : "bg-sky-600 text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {c === "whatsapp" ? (
                  <MessageCircle className="h-3.5 w-3.5" />
                ) : (
                  <PhoneIcon className="h-3.5 w-3.5" />
                )}
                {c === "whatsapp" ? "WhatsApp" : "SMS"}
              </button>
            ))}
          </div>
          <PhonePicker
            value={phone}
            onChange={setPhone}
            placeholder="33 1234 5678"
            className="w-full min-w-0 lg:flex-1"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={
              busy || (channel === "whatsapp" && phone.trim().length === 0)
            }
            className={cn(
              PILL_BUTTON_CLASS,
              "shrink-0 px-4 py-2 disabled:opacity-50",
            )}
          >
            {busy ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Send className="h-3 w-3" />
            )}
            Add
          </button>
          <button
            type="button"
            disabled={busy || phone.trim().length === 0}
            onClick={() => onPing(channel, phone.trim())}
            className="border-border bg-background text-foreground hover:bg-muted inline-flex h-10 items-center gap-2 rounded-full border px-4 text-[13px] font-semibold transition disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            Ping
          </button>
        </div>
      </div>
      <p className="text-muted-foreground text-[11px]">
        {channel === "whatsapp"
          ? "Les llega un WhatsApp en lenguaje natural; para unirse responden sí en Mesita Ops."
          : "Usa WhatsApp. El mesero acepta respondiendo sí en el chat de Ops."}
      </p>
    </form>
  );
}
