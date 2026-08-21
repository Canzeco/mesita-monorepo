"use client";

import { Phone } from "lucide-react";
import { type AdminPlace } from "../actions";

// The three-tile channel picker, shared by Reservations and Orders
// (MESITA-1155). Both rails ask the same question — which of the place's own
// contacts does Mesita use to reach it — so they ask it with the same control.
//
// Phone is the only live channel on either rail. WhatsApp and Instagram render
// as Soon tiles rather than being hidden, so the operator sees that each
// channel binds a DIFFERENT contact (`phone` / `whatsapp_url` /
// `instagram_url`) and that the contact itself is edited under Place →
// Channels, never here.

/** Only phone is selectable today on either rail. */
export type ChannelKey = "phone";

export type ChannelTarget = {
  channel: ChannelKey;
  value?: string | null;
  fallbacks?: { channel: ChannelKey; value?: string | null }[];
};

export type ChannelOption =
  | {
      id: "phone";
      label: "Phone";
      selectable: true;
      contact: string;
      contactKind: "Phone";
    }
  | {
      id: "whatsapp" | "instagram";
      label: "WhatsApp" | "Instagram";
      selectable: false;
      contact: string;
      contactKind: "WhatsApp" | "Instagram";
      logo: string;
    };

const str = (v: unknown) => (typeof v === "string" ? v : "");

/** Digits from a wa.me URL (or plain E.164) for display. */
export function displayWhatsApp(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  const m = t.match(/wa\.me\/(\+?\d+)/i);
  if (m?.[1]) {
    const digits = m[1].replace(/\D/g, "");
    return digits ? `+${digits}` : t;
  }
  return t;
}

/** @handle or short path from an Instagram URL. */
export function displayInstagram(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  try {
    const u = new URL(t.startsWith("http") ? t : `https://${t}`);
    const seg = u.pathname.replace(/^\/+|\/+$/g, "").split("/")[0];
    if (seg) return seg.startsWith("@") ? seg : `@${seg}`;
  } catch {
    /* fall through */
  }
  return t;
}

/** The place's three contacts, in tile order. */
export function channelOptions(place: AdminPlace): ChannelOption[] {
  return [
    {
      id: "phone",
      label: "Phone",
      selectable: true,
      contact: str(place.phone).trim(),
      contactKind: "Phone",
    },
    {
      id: "whatsapp",
      label: "WhatsApp",
      selectable: false,
      contact: displayWhatsApp(str(place.whatsapp_url)),
      contactKind: "WhatsApp",
      logo: "/channels/whatsapp.svg",
    },
    {
      id: "instagram",
      label: "Instagram",
      selectable: false,
      contact: displayInstagram(str(place.instagram_url)),
      contactKind: "Instagram",
      logo: "/channels/instagram.svg",
    },
  ];
}

/** Read a stored { channel, value } target off a products blob key. */
export function readChannel(raw: unknown): ChannelKey | "" {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    if (obj.channel === "phone") return "phone";
  }
  return "";
}

export function ChannelPicker({
  options,
  selected,
  onSelect,
  disabled,
  ariaLabel,
  soonVerb,
}: {
  options: ChannelOption[];
  selected: ChannelKey | "";
  onSelect: (id: ChannelKey) => void;
  disabled: boolean;
  ariaLabel: string;
  /** "booking" | "ordering" — only used in the Soon tooltips. */
  soonVerb: string;
}) {
  const hasPhone = options[0].contact !== "";

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-foreground/90 flex min-h-4 items-center text-[13px] font-medium">
        Channel
      </span>
      <div role="group" aria-label={ariaLabel} className="grid grid-cols-3 gap-2">
        {options.map((opt) => {
          if (opt.selectable) {
            const pressed = selected === "phone";
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => hasPhone && onSelect("phone")}
                disabled={disabled || !hasPhone}
                aria-pressed={pressed}
                title={
                  !hasPhone
                    ? "Add a Phone contact under Place → Channels to use it"
                    : undefined
                }
                className={
                  "relative flex min-h-[5.25rem] flex-col items-center justify-center gap-1 rounded-xl border px-1.5 py-2 text-[12px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 " +
                  (pressed
                    ? "border-primary/50 bg-primary/8 text-primary ring-primary/15 ring-2"
                    : "border-border/60 bg-muted/40 text-foreground/70 hover:border-foreground/25 hover:bg-muted/70")
                }
              >
                <Phone
                  className={
                    "h-6 w-6 shrink-0 " +
                    (pressed ? "text-primary" : "text-muted-foreground")
                  }
                />
                Phone
                {!hasPhone ? (
                  <span className="text-muted-foreground/70 text-[9px] font-medium">
                    not set
                  </span>
                ) : null}
              </button>
            );
          }

          return (
            <div
              key={opt.id}
              aria-disabled
              title={`${opt.label} ${soonVerb} — coming soon`}
              className="border-border/60 bg-muted/25 relative flex min-h-[5.25rem] cursor-not-allowed flex-col items-center justify-center gap-1 rounded-xl border border-dashed px-1.5 py-2 text-[12px] font-semibold opacity-60"
            >
              <span className="bg-muted text-muted-foreground absolute top-1.5 right-1.5 rounded-full px-1.5 py-0 text-[9px] font-bold tracking-wider uppercase">
                Soon
              </span>
              {/* Static brand SVG — same pattern as Place → Channels. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={opt.logo}
                alt=""
                aria-hidden
                className="h-6 w-6 shrink-0 opacity-80"
              />
              <span className="text-foreground/70">{opt.label}</span>
              {!opt.contact ? (
                <span className="text-muted-foreground/70 text-[9px] font-medium">
                  not set
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      <ul className="mt-1 grid gap-1">
        {options.map((opt) => (
          <li key={opt.id} className="text-muted-foreground text-xs">
            <span className="text-foreground/80 font-medium">
              {opt.contactKind}:
            </span>{" "}
            {opt.contact ? (
              <span className="text-foreground/90 font-medium break-all">
                {opt.contact}
              </span>
            ) : (
              <span className="text-amber-700/90 font-medium">
                not set — add under Place → Channels
              </span>
            )}
            {!opt.selectable ? (
              <span className="text-muted-foreground/70"> · Soon</span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
