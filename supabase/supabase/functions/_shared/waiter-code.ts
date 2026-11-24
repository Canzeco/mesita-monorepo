// One 6-digit code per place (MESITA-4904). Mesita makes it on
// Business › Offers; the waiter types it at service.mesita.ai on each bill, and
// the place is the guest's QR's. It buys a token `w2.<exp>.<code row>.<jti>.<name>.<mac>`
// (the name typed with it, or empty) of 12 hours, signed over place_waiters.lookup_hash, a random key: a new code
// or a removal ends it.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { timingSafeEqual } from "./timing-safe-equal.ts";

export const WAITER_NAME_MAX = 40;
const TOKEN_TTL_SEC = 12 * 60 * 60;

/** Six digits, or null. Spaces a person typed do not count. */
export function readWaiterCode(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const code = v.replace(/\s/g, "");
  return /^\d{6}$/.test(code) ? code : null;
}

/** A waiter's name: 1 to 40 characters, one line; null otherwise. */
export function readWaiterName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  // deno-lint-ignore no-control-regex
  const name = v.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim();
  return name.length >= 1 && [...name].length <= WAITER_NAME_MAX ? name : null;
}

/** Six digits from the platform CSPRNG, no modulo bias. */
export function mintWaiterCode(): string {
  const limit = Math.floor(0x100000000 / 1_000_000) * 1_000_000;
  let n: number;
  do n = crypto.getRandomValues(new Uint32Array(1))[0]; while (n >= limit);
  return String(n % 1_000_000).padStart(6, "0");
}

/** A new key for a waiter's tokens. */
export const mintWaiterKey = () =>
  [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, "0")).join("");

function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

/** The name inside a token: base64url of its UTF-8, "" for none. */
const nameOut = (name: string | null) => (name ? b64url(new TextEncoder().encode(name)) : "");
function nameIn(text: string): string | null {
  if (text === "") return null;
  try {
    const bin = atob(text.replaceAll("-", "+").replaceAll("_", "/"));
    return readWaiterName(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
  } catch {
    return null;
  }
}

async function mac(serviceKey: string, text: string): Promise<string> {
  const keyBytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`waiter-token-key:${serviceKey}`)));
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(text))));
}

export type Waiter = { id: string; placeId: string; lookupHash: string };

export async function mintWaiterToken(serviceKey: string, w: Waiter, name: string | null, nowMs: number): Promise<string> {
  const exp = Math.floor(nowMs / 1000) + TOKEN_TTL_SEC;
  const jti = b64url(crypto.getRandomValues(new Uint8Array(16)));
  const who = nameOut(name);
  return `w2.${exp}.${w.id}.${jti}.${who}.${await mac(serviceKey, `${w.placeId}:${exp}:${w.id}:${jti}:${w.lookupHash}:${who}`)}`;
}

/** A 40-character name is at most 214 characters here. */
export const WAITER_TOKEN_MAX = 400;
const TOKEN = /^w2\.(\d{10})\.([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]{0,214})\.([A-Za-z0-9_-]{43})$/;

/** The waiter a token names, unverified; null when it is not one. */
export function waiterOfToken(token: unknown): string | null {
  return typeof token === "string" ? TOKEN.exec(token)?.[2] ?? null : null;
}

/** The phone's id and the typed name when the token is this waiter's, live and current. */
export async function checkWaiterToken(serviceKey: string, w: Waiter, token: string, nowMs: number): Promise<{ jti: string; name: string | null } | null> {
  const m = TOKEN.exec(token);
  if (!m || m[2] !== w.id) return null;
  const exp = Number(m[1]);
  const nowSec = Math.floor(nowMs / 1000);
  if (exp <= nowSec || exp > nowSec + TOKEN_TTL_SEC + 60) return null;
  const want = await mac(serviceKey, `${w.placeId}:${exp}:${w.id}:${m[3]}:${w.lookupHash}:${m[4]}`);
  return timingSafeEqual(m[5], want) ? { jti: m[3], name: nameIn(m[4]) } : null;
}

/** A place's code row while it is live, or null. */
export async function readWaiter(admin: SupabaseClient, id: string): Promise<Waiter | null> {
  const { data, error } = await admin.from("place_waiters").select("id, place_id, lookup_hash").eq("id", id).is("removed_at", null).maybeSingle();
  if (error) throw new Error(`place_waiters_read: ${error.message}`);
  const r = data as { id: string; place_id: string; lookup_hash: string | null } | null;
  return r?.lookup_hash ? { id: r.id, placeId: r.place_id, lookupHash: r.lookup_hash } : null;
}
