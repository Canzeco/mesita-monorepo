// Instagram by DM (MESITA-2575): the pure half of
// meta-instagram-receive-message and the DM side of
// consumer-web-claim-instagram. The guest sends Mesita's Instagram account
// their one-time code; Meta's webhook carries the message to us with the
// sender's Instagram-scoped id (IGSID), and Meta's User Profile API returns
// the sender's username, follower count and photo. Consent exists because
// the guest wrote first; Mesita never messages anyone first.
//
// Off until every Meta secret is set: the Me › Instagram page then keeps the
// bio-code flow (MESITA-2461).

import { numOf } from "./parse-utils.ts";
import { normalizeHandle } from "./instagram-claim.ts";

/** The Graph API version the webhook calls. Bump on purpose, never `latest`. */
export const META_GRAPH_VERSION = "v25.0";

export type InstagramDmConfig = {
  appSecret: string;
  verifyToken: string;
  accessToken: string;
  /** Mesita's Instagram username, without "@": the account guests write to. */
  username: string;
};

/** The DM channel's secrets, or null while any is missing (the switch). */
export function readInstagramDmConfig(
  get: (k: string) => string | undefined = (k) => Deno.env.get(k),
): InstagramDmConfig | null {
  const appSecret = get("META_IG_APP_SECRET")?.trim();
  const verifyToken = get("META_IG_VERIFY_TOKEN")?.trim();
  const accessToken = get("META_IG_ACCESS_TOKEN")?.trim();
  const username = normalizeHandle(get("META_IG_USERNAME"));
  if (!appSecret || !verifyToken || !accessToken || !username) return null;
  return { appSecret, verifyToken, accessToken, username };
}

/** The chat link that opens a DM to Mesita's account. */
export function dmLink(username: string): string {
  return `https://ig.me/m/${username}`;
}

/** The first MESITA-XXXXXX in a message, normalized, or null. */
export function codeInMessage(text: unknown): string | null {
  if (typeof text !== "string") return null;
  const m = text.toUpperCase().match(/MESITA\s*-\s*([A-Z0-9]{6})(?![A-Z0-9])/);
  return m ? `MESITA-${m[1]}` : null;
}

/** One inbound message from the webhook body. */
export type InboundDm = { senderId: string; text: string };

/**
 * The guest-sent text messages in a webhook body. Echoes (Mesita's own
 * replies), reactions, reads and anything without text are dropped.
 */
export function inboundMessages(body: unknown): InboundDm[] {
  const b = body as { object?: unknown; entry?: unknown };
  if (b?.object !== "instagram" || !Array.isArray(b.entry)) return [];
  const out: InboundDm[] = [];
  for (const entry of b.entry as { messaging?: unknown }[]) {
    if (!Array.isArray(entry?.messaging)) continue;
    for (const ev of entry.messaging as Record<string, unknown>[]) {
      const sender = (ev.sender as { id?: unknown } | undefined)?.id;
      const message = ev.message as
        | { text?: unknown; is_echo?: unknown }
        | undefined;
      if (typeof sender !== "string" || !message || message.is_echo === true) {
        continue;
      }
      if (typeof message.text !== "string" || !message.text.trim()) continue;
      out.push({ senderId: sender, text: message.text });
    }
  }
  return out;
}

/** What the User Profile API told us about the sender. */
export type DmProfile = {
  handle: string;
  followers: number;
  photoUrl: string | null;
};

/** The User Profile API's answer, checked; null when it has no username. */
export function readDmProfile(raw: unknown): DmProfile | null {
  const r = raw as Record<string, unknown> | null;
  const handle = normalizeHandle(r?.username);
  if (!handle) return null;
  const followers = numOf(r?.follower_count);
  const pic = r?.profile_pic;
  return {
    handle,
    followers: followers != null && followers > 0 ? Math.trunc(followers) : 0,
    photoUrl: typeof pic === "string" && /^https:\/\//.test(pic) ? pic : null,
  };
}

/** Meta's GET handshake when the webhook is subscribed. */
export function verifyHandshake(
  params: URLSearchParams,
  verifyToken: string,
): string | null {
  return params.get("hub.mode") === "subscribe" &&
      params.get("hub.verify_token") === verifyToken
    ? params.get("hub.challenge")
    : null;
}

function hex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Meta signs every POST: `X-Hub-Signature-256: sha256=<hex HMAC-SHA256 of
 * the raw body with the app secret>`. Compared in constant time.
 */
export async function signatureIsValid(
  rawBody: string,
  header: string | null,
  appSecret: string,
): Promise<boolean> {
  if (!header?.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const want = hex(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody)),
  );
  const got = header.slice("sha256=".length).toLowerCase();
  if (got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i++) {
    diff |= want.charCodeAt(i) ^ got.charCodeAt(i);
  }
  return diff === 0;
}

/** The bot's replies. Plain, one line each. */
export const DM_REPLY = {
  verified: (handle: string) =>
    `You're verified on Mesita ✅ @${handle} is connected. Head back to the app.`,
  unknownCode:
    "That code isn't valid or has expired. Get a new one in the Mesita app (Me › Instagram).",
  failed: "Something went wrong on our side. Try sending the code again in a minute.",
} as const;
