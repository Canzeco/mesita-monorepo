"use client";

import { Ban, Globe, Phone } from "lucide-react";
import { type AdminPlace } from "../actions";

// Reservations and Orders ask the same question: how does a guest reach
// the place, or do they not. Five picks (Pato 2026-08-25): Phone,
// WhatsApp, Instagram, Web Link, Not. The Reservationist still only
// DIALS phone — the other four are the place's own door, or no door.

export const SERVING_CHANNELS = [
  "phone",
  "whatsapp",
  "instagram",
  "web",
  "none",
] as const;

export type ChannelKey = (typeof SERVING_CHANNELS)[number];

export function isServingChannel(v: unknown): v is ChannelKey {
  return (
    typeof v === "string" &&
    (SERVING_CHANNELS as readonly string[]).includes(v)
  );
}

export function readChannel(raw: unknown): ChannelKey | "" {
  return isServingChannel(raw) ? raw : "";
}

const str = (v: unknown) => (typeof v === "string" ? v : "");

/** Digits from a wa.me URL (or plain E.164) for display. */
function displayWhatsApp(raw: string): string {
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
function displayInstagram(raw: string): string {
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

export function contactForChannel(
  place: AdminPlace,
  channel: ChannelKey,
): string {
  if (channel === "phone") return str(place.phone).trim();
  if (channel === "whatsapp") return displayWhatsApp(str(place.whatsapp_url));
  if (channel === "instagram") return displayInstagram(str(place.instagram_url));
  if (channel === "web") return str(place.website_url).trim();
  return "";
}

export function targetForChannel(
  place: AdminPlace,
  channel: ChannelKey,
): string | null {
  if (channel === "none") return null;
  const v = contactForChannel(place, channel);
  return v || null;
}

type Tile = {
  id: ChannelKey;
  label: string;
  kind: "phone" | "logo" | "web" | "none";
  logo?: string;
};

const TILES: Tile[] = [
  { id: "phone", label: "Phone", kind: "phone" },
  {
    id: "whatsapp",
    label: "WhatsApp",
    kind: "logo",
    logo: "/channels/whatsapp.svg",
  },
  {
    id: "instagram",
    label: "Instagram",
    kind: "logo",
    logo: "/channels/instagram.svg",
  },
  { id: "web", label: "Web Link", kind: "web" },
  { id: "none", label: "Not", kind: "none" },
];

export function ChannelPicker({
  place,
  selected,
  onSelect,
  disabled,
  ariaLabel,
  noneHint,
}: {
  place: AdminPlace;
  selected: ChannelKey | "";
  onSelect: (id: ChannelKey) => void;
  disabled: boolean;
  ariaLabel: string;
  /** What "Not" means on this rail. */
  noneHint: string;
}) {
  const resolved = selected ? TILES.find((t) => t.id === selected) : null;
  const contact = selected ? contactForChannel(place, selected) : "";

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-foreground/90 flex min-h-4 items-center type-body font-medium">
        Channel
      </span>
      <div
        role="group"
        aria-label={ariaLabel}
        className="grid grid-cols-2 gap-2 sm:grid-cols-5"
      >
        {TILES.map((opt) => {
          const contactValue = contactForChannel(place, opt.id);
          const needsContact = opt.id !== "none";
          const missing = needsContact && !contactValue;
          const pressed = selected === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onSelect(opt.id)}
              disabled={disabled || missing}
              aria-pressed={pressed}
              title={
                missing
                  ? `Add a ${opt.label} contact under Place → Channels`
                  : opt.id === "none"
                    ? noneHint
                    : undefined
              }
              className={
                "relative flex min-h-[5.25rem] flex-col items-center justify-center gap-1 rounded-xl border px-1.5 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 " +
                (pressed
                  ? "border-primary/50 bg-primary/8 text-primary ring-primary/15 ring-2"
                  : "border-border/60 bg-muted/40 text-foreground/70 hover:border-foreground/25 hover:bg-muted/70")
              }
            >
              {opt.kind === "phone" ? (
                <Phone
                  className={
                    "h-6 w-6 shrink-0 " +
                    (pressed ? "text-primary" : "text-muted-foreground")
                  }
                />
              ) : opt.kind === "web" ? (
                <Globe
                  className={
                    "h-6 w-6 shrink-0 " +
                    (pressed ? "text-primary" : "text-muted-foreground")
                  }
                />
              ) : opt.kind === "none" ? (
                <Ban
                  className={
                    "h-6 w-6 shrink-0 " +
                    (pressed ? "text-primary" : "text-muted-foreground")
                  }
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={opt.logo}
                  alt=""
                  aria-hidden
                  className="h-6 w-6 shrink-0 opacity-80"
                />
              )}
              {opt.label}
              {missing ? (
                <span className="text-muted-foreground/70 type-meta font-medium">
                  not set
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {resolved ? (
        <p className="text-muted-foreground mt-1 text-xs">
          {resolved.id === "none" ? (
            <span className="text-foreground/80 font-medium">{noneHint}</span>
          ) : (
            <>
              <span className="text-foreground/80 font-medium">
                {resolved.label}:
              </span>{" "}
              {contact ? (
                <span className="text-foreground/90 font-medium break-all">
                  {contact}
                </span>
              ) : (
                <span className="text-amber-700/90 font-medium">
                  not set — add under Place → Channels
                </span>
              )}
            </>
          )}
        </p>
      ) : (
        <p className="text-muted-foreground mt-1 text-xs">
          Pick how a guest reaches this place — or Not. Contacts live under
          Place → Channels.
        </p>
      )}
    </div>
  );
}
