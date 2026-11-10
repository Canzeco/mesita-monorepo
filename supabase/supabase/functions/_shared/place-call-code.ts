// The claim call (MESITA-3127). Mesita's own 6-digit code, said twice by a
// Twilio call to the place's listing phone from the place-facing line (the
// Reservationist's, which already dials places). Only a hash is stored.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { phoneDigits } from "./phone.ts";
import { reservationFromNumber } from "./elevenlabs.ts";

/** How long a said code works. */
export const CODE_MINUTES = 10;
/** Wrong tries before the code is spent. */
export const CODE_TRIES = 5;

/** Calls are OFF while we test on the Stripe sandbox (MESITA-3594, Pato:
 *  "do enable hardcode code"; reverses MESITA-3400 for now, as MESITA-3148
 *  did): Call the place stores TEST_CODE and dials no one, so no real
 *  restaurant gets a call. Set back to true before real places are claimed. */
export const CALLS_LIVE = false;
export const TEST_CODE = "123456";

/** Six random digits, leading zeros kept. */
export function newCode(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return String(n).padStart(6, "0");
}

/** SHA-256 hex of the code, bound to its place and guest. */
export async function hashCode(placeId: string, consumerId: string, code: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${placeId}:${consumerId}:${code}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Stores a fresh code for (place, guest), replacing any earlier one. */
export async function storeCode(admin: SupabaseClient, placeId: string, consumerId: string, code: string) {
  return await admin.from("place_verification_codes").upsert({
    place_id: placeId,
    consumer_id: consumerId,
    code_hash: await hashCode(placeId, consumerId, code),
    attempts: 0,
    expires_at: new Date(Date.now() + CODE_MINUTES * 60_000).toISOString(),
    created_at: new Date().toISOString(),
  });
}

/** Drops the code when its call never went out. */
export async function dropCode(admin: SupabaseClient, placeId: string, consumerId: string) {
  return await admin.from("place_verification_codes").delete().eq("place_id", placeId).eq("consumer_id", consumerId);
}

/** The listing phone as E.164 (`+` and digits), or null when it can't be one. */
export function toE164(raw: string | null | undefined): string | null {
  if (!raw || !raw.trim().startsWith("+")) return null;
  const digits = phoneDigits(raw);
  return digits.length >= 10 && digits.length <= 15 ? `+${digits}` : null;
}

/** What a code is for: claiming a place, or signing in (MESITA-3405). */
export type CodePurpose = "claim" | "sign_in";

const HELLO: Record<CodePurpose, { es: string; en: string }> = {
  claim: { es: "Hola, le llama Mesita. Su código para reclamar este lugar es:", en: "Hello, this is Mesita. Your code to claim this place is:" },
  sign_in: { es: "Hola, le llama Mesita. Su código para entrar es:", en: "Hello, this is Mesita. Your sign-in code is:" },
};

/** What the call says: Spanish for a Mexican number, English otherwise. */
export function callTwiml(code: string, e164: string, purpose: CodePurpose = "claim"): string {
  const spoken = code.split("").join(". ");
  const es = e164.startsWith("+52");
  const voice = es ? 'language="es-MX" voice="Polly.Mia"' : 'language="en-US" voice="Polly.Joanna"';
  const hello = es ? HELLO[purpose].es : HELLO[purpose].en;
  const again = es ? "Repito:" : "Again:";
  const bye = es ? "Gracias." : "Thank you.";
  return `<Response><Pause length="1"/><Say ${voice}>${hello} ${spoken}.</Say><Pause length="1"/>` +
    `<Say ${voice}>${again} ${spoken}.</Say><Say ${voice}>${bye}</Say></Response>`;
}

export type CallResult = { ok: true; sid: string | null } | { ok: false; error: string };

/** Places the call. Twilio answers 201 once it is queued; whether anyone
 *  picks up is not known here (no status webhook). */
export async function placeCodeCall(to: string, code: string, purpose: CodePurpose = "claim"): Promise<CallResult> {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID")?.trim();
  const token = Deno.env.get("TWILIO_AUTH_TOKEN")?.trim();
  if (!sid || !token) return { ok: false, error: "Twilio is not configured" };
  const form = new URLSearchParams({ To: to, From: reservationFromNumber(), Twiml: callTwiml(code, to, purpose) });
  let r: Response;
  try {
    r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Calls.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${btoa(`${sid}:${token}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    return { ok: false, error: String(err) };
  }
  const body = await r.json().catch(() => ({})) as { sid?: string; code?: number; message?: string };
  if (!r.ok) return { ok: false, error: `Twilio ${r.status}${body.code ? ` ${body.code}` : ""}: ${body.message ?? "call refused"}` };
  return { ok: true, sid: body.sid ?? null };
}
