// One 8-digit code per waiter (MESITA-4871). Mesita makes it on Business ›
// Offers and shows it once; the waiter types it at service.mesita.ai on each
// bill. The code alone names its place and its waiter (place_waiters
// .lookup_hash, a keyed hash). It buys a token `w1.<exp>.<waiter>.<jti>.<mac>`
// of 12 hours, signed over that hash: a new code or a removal ends it.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { timingSafeEqual } from "./timing-safe-equal.ts";

export const WAITER_NAME_MAX = 40;
export const WAITERS_MAX = 100;
const TOKEN_TTL_SEC = 12 * 60 * 60;

/** Eight digits, or null. Spaces a person typed do not count. */
export function readWaiterCode(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const code = v.replace(/\s/g, "");
  return /^\d{8}$/.test(code) ? code : null;
}

/** A waiter's name: 1 to 40 characters, one line; null otherwise. */
export function readWaiterName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  // deno-lint-ignore no-control-regex
  const name = v.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim();
  return name.length >= 1 && [...name].length <= WAITER_NAME_MAX ? name : null;
}

/** Eight digits from the platform CSPRNG, no modulo bias. */
export function mintWaiterCode(): string {
  const limit = Math.floor(0x100000000 / 100_000_000) * 100_000_000;
  let n: number;
  do n = crypto.getRandomValues(new Uint32Array(1))[0]; while (n >= limit);
  return String(n % 100_000_000).padStart(8, "0");
}

export async function lookupWaiterCode(serviceKey: string, code: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`waiter-code:${serviceKey}:${code}`));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

async function mac(serviceKey: string, text: string): Promise<string> {
  const keyBytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`waiter-token-key:${serviceKey}`)));
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(text))));
}

export type Waiter = { id: string; placeId: string; lookupHash: string };

export async function mintWaiterToken(serviceKey: string, w: Waiter, nowMs: number): Promise<string> {
  const exp = Math.floor(nowMs / 1000) + TOKEN_TTL_SEC;
  const jti = b64url(crypto.getRandomValues(new Uint8Array(16)));
  return `w1.${exp}.${w.id}.${jti}.${await mac(serviceKey, `${w.placeId}:${exp}:${w.id}:${jti}:${w.lookupHash}`)}`;
}

const TOKEN = /^w1\.(\d{10})\.([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]{43})$/;

/** The waiter a token names, unverified; null when it is not one. */
export function waiterOfToken(token: unknown): string | null {
  return typeof token === "string" ? TOKEN.exec(token)?.[2] ?? null : null;
}

/** The phone's id when the token is this waiter's, live and current. */
export async function checkWaiterToken(serviceKey: string, w: Waiter, token: string, nowMs: number): Promise<string | null> {
  const m = TOKEN.exec(token);
  if (!m || m[2] !== w.id) return null;
  const exp = Number(m[1]);
  const nowSec = Math.floor(nowMs / 1000);
  if (exp <= nowSec || exp > nowSec + TOKEN_TTL_SEC + 60) return null;
  const want = await mac(serviceKey, `${w.placeId}:${exp}:${w.id}:${m[3]}:${w.lookupHash}`);
  return timingSafeEqual(m[4], want) ? m[3] : null;
}

/** A waiter who still has a code, or null. */
export async function readWaiter(admin: SupabaseClient, id: string): Promise<(Waiter & { name: string }) | null> {
  const { data, error } = await admin.from("place_waiters").select("id, place_id, name, lookup_hash").eq("id", id).is("removed_at", null).maybeSingle();
  if (error) throw new Error(`place_waiters_read: ${error.message}`);
  const r = data as { id: string; place_id: string; name: string; lookup_hash: string | null } | null;
  return r?.lookup_hash ? { id: r.id, placeId: r.place_id, name: r.name, lookupHash: r.lookup_hash } : null;
}
