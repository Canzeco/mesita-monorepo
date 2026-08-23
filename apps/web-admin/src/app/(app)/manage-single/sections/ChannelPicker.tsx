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

/** Read a stored channel column. Only 'phone' is a served pick (MESITA-842). */
export function readChannel(raw: unknown): ChannelKey | "" {
  return raw === "phone" ? "phone" : "";
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
  const resolved = options.find((o) => o.id === selected) ?? null;

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-foreground/90 flex min-h-4 items-center type-body font-medium">
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
                  "relative flex min-h-[5.25rem] flex-col items-center justify-center gap-1 rounded-xl border px-1.5 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 " +
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
                  <span className="text-muted-foreground/70 type-meta font-medium">
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
              className="border-border/60 bg-muted/25 relative flex min-h-[5.25rem] cursor-not-allowed flex-col items-center justify-center gap-1 rounded-xl border border-dashed px-1.5 py-2 text-xs font-semibold opacity-60"
            >
              <span className="bg-muted text-muted-foreground absolute top-1.5 right-1.5 rounded-full px-1.5 py-0 type-meta font-bold tracking-wider uppercase">
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
                <span className="text-muted-foreground/70 type-meta font-medium">
                  not set
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* ONE line, not three (design pass 2026-08-22). This used to list every
          channel's contact — Phone, WhatsApp, Instagram — and BOTH the Orders
          and the Reservations box render this picker, so the Settings tab
          restated the same three place-level facts six times in one viewport.
          The tiles above already say which channels are unset; the only thing
          left worth stating is what the CURRENT selection actually resolves
          to, which is the one fact that differs between the two boxes. */}
      {resolved ? (
        <p className="text-muted-foreground mt-1 text-xs">
          <span className="text-foreground/80 font-medium">
            {resolved.contactKind}:
          </span>{" "}
          {resolved.contact ? (
            <span className="text-foreground/90 font-medium break-all">
              {resolved.contact}
            </span>
          ) : (
            <span className="text-amber-700/90 font-medium">
              not set — add under Place → Channels
            </span>
          )}
        </p>
      ) : (
        <p className="text-muted-foreground mt-1 text-xs">
          Pick a channel. Contacts are edited under Place → Channels.
        </p>
      )}
    </div>
  );
}
