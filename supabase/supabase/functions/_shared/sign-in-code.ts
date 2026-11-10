// Phone sign-in by SMS or call (MESITA-3405, MESITA-3470). Supabase Auth
// makes the code and checks it; its Send SMS hook (supabase-auth-send-sms)
// hands us the code and we text it, or call with it when the guest picked
// Call (consumer-web-call-sign-in-code marked the number in sign_in_calls).
// Pure helpers plus the one Twilio Messages call.

import { timingSafeEqual } from "./timing-safe-equal.ts";

/** How long a Call pick waits for Auth's code. */
export const SIGN_IN_CALL_PICK_SECONDS = 120;
/** One call per number per this many seconds. */
export const SIGN_IN_CALL_GAP_SECONDS = 60;

/** The Messaging Service Supabase Auth sent through before the hook. */
const DEFAULT_MESSAGING_SERVICE = "MG7e48a98519ee7d81d7cf1e49bb167b61";

/** The SMS text — the same words Auth's template used. */
export function signInSmsBody(code: string): string {
  return `Your Mesita verification code is ${code}`;
}

/** Auth hands the phone as digits ("528125680835"); the browser sends E.164.
 *  Both become "+528125680835", or null when it can't be a phone. */
export function signInPhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
}

function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

/**
 * Checks a Supabase Auth hook call (Standard Webhooks): the signature header
 * holds one or more `v1,<base64 HMAC-SHA256 of "id.timestamp.body">`, keyed
 * by the secret's base64 part (`v1,whsec_<base64>`). The timestamp must be
 * within 5 minutes.
 */
export async function verifyHookSignature(
  secret: string,
  headers: Headers,
  body: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  const id = headers.get("webhook-id");
  const ts = headers.get("webhook-timestamp");
  const sigs = headers.get("webhook-signature");
  if (!id || !ts || !sigs) return false;
  const t = Number(ts);
  if (!Number.isFinite(t) || Math.abs(nowSeconds - t) > 300) return false;
  const keyB64 = secret.trim().replace(/^v1,/, "").replace(/^whsec_/, "");
  let keyBytes: Uint8Array<ArrayBuffer>;
  try {
    keyBytes = b64ToBytes(keyB64);
  } catch {
    return false;
  }
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = bytesToB64(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${ts}.${body}`)));
  return sigs.split(" ").some((s) => {
    const [version, sig] = s.split(",");
    return version === "v1" && !!sig && timingSafeEqual(sig, expected);
  });
}

export type SmsResult = { ok: true; sid: string | null } | { ok: false; status: number; error: string };

/** Texts the code through the Twilio Messaging Service. A refusal keeps
 *  Twilio's error link in the message: the sign-in form maps its number
 *  (web-consumer lib/phone-otp.ts) to words a guest can act on. */
export async function sendSignInSms(to: string, code: string): Promise<SmsResult> {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID")?.trim();
  const token = Deno.env.get("TWILIO_AUTH_TOKEN")?.trim();
  if (!sid || !token) return { ok: false, status: 500, error: "Twilio is not configured" };
  const service = Deno.env.get("TWILIO_MESSAGE_SERVICE_SID")?.trim() || DEFAULT_MESSAGING_SERVICE;
  const form = new URLSearchParams({ To: to, MessagingServiceSid: service, Body: signInSmsBody(code) });
  let r: Response;
  try {
    r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${btoa(`${sid}:${token}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    return { ok: false, status: 502, error: String(err) };
  }
  const body = await r.json().catch(() => ({})) as { sid?: string; code?: number; message?: string; more_info?: string };
  if (!r.ok) {
    const more = body.more_info ?? (body.code ? `https://www.twilio.com/docs/errors/${body.code}` : "");
    return { ok: false, status: r.status, error: `${body.message ?? "Twilio refused the SMS"}${more ? ` More information: ${more}` : ""}` };
  }
  return { ok: true, sid: body.sid ?? null };
}
