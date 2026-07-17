// Reservations Config catalog — the human-facing names behind the endpoint policy.
//
// Every Mesita place carries ONE selected reservation endpoint at
// products.reservations = { channel, value } — the address the Reservationist
// actually books through. This config decides how the Enricher picks it: an
// ordered channel priority, the channels parked out of the running, and whether
// an operator's hand-picked channel survives a re-enrich.
//
// The channel keys are the contract shared with the Edge Functions
// (admin-web-{get,update}-reservations-config) and with
// supabase/functions/_shared/enrich-reservation-endpoint.ts — keep them in
// lock-step.

export type ReservationChannel = "phone" | "whatsapp" | "instagram";

export type ReservationsConfig = {
  /** Ordered, most preferred first. Order IS the rule. Always ranks every channel. */
  priority: ReservationChannel[];
  /** Parked channels — skipped even when they're the place's only contact. */
  disabled: ReservationChannel[];
  /** True: a channel an operator picked by hand is never re-seeded by an enrich. */
  respectAdminOverride: boolean;
};

export const CHANNEL_KEYS: ReservationChannel[] = ["phone", "whatsapp", "instagram"];

export type Channel = {
  key: ReservationChannel;
  label: string;
  emoji: string;
  /** The places column the endpoint value is read from. */
  source: string;
  blurb: string;
};

export const CHANNELS: Channel[] = [
  {
    key: "phone",
    label: "Phone",
    emoji: "☎️",
    source: "places.phone",
    blurb:
      "A call to the place's line. The most universal channel — nearly every place has one, and it reaches a human who can hold a table.",
  },
  {
    key: "whatsapp",
    label: "WhatsApp",
    emoji: "💬",
    source: "places.whatsapp_url",
    blurb:
      "A WhatsApp thread with the place. Written, async and the default way Mexico books — but only some places publish a number.",
  },
  {
    key: "instagram",
    label: "Instagram",
    emoji: "📸",
    source: "places.instagram_url",
    blurb:
      "A DM to the place's IG. The weakest channel — DMs get missed — but often the only contact a new place publishes.",
  },
];

export const DEFAULT_CONFIG: ReservationsConfig = {
  priority: ["phone", "whatsapp", "instagram"],
  disabled: [],
  respectAdminOverride: true,
};

function isChannel(v: unknown): v is ReservationChannel {
  return v === "phone" || v === "whatsapp" || v === "instagram";
}

/**
 * Coerce whatever the row holds into a renderable config. Anything malformed
 * resolves to the default — the page must always be usable, never a blank screen.
 * Mirrors coerceReservationsPolicy in the EF _shared module.
 */
export function coerceConfig(raw: unknown): ReservationsConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return DEFAULT_CONFIG;
  const c = raw as Record<string, unknown>;

  const priority: ReservationChannel[] = Array.isArray(c.priority)
    ? c.priority.filter(isChannel).filter((ch, i, a) => a.indexOf(ch) === i)
    : [];
  // Append any channel the row forgot to rank so it stays reachable, last.
  for (const ch of CHANNEL_KEYS) {
    if (!priority.includes(ch)) priority.push(ch);
  }

  const disabled: ReservationChannel[] = Array.isArray(c.disabled)
    ? c.disabled.filter(isChannel).filter((ch, i, a) => a.indexOf(ch) === i)
    : [];

  return {
    priority,
    disabled,
    respectAdminOverride:
      typeof c.respectAdminOverride === "boolean" ? c.respectAdminOverride : true,
  };
}

export function channelMeta(key: ReservationChannel): Channel {
  return CHANNELS.find((c) => c.key === key) ?? CHANNELS[0];
}
