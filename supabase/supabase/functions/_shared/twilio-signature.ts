// Twilio webhook signature validation (HMAC-SHA1) — extracted from twilio.ts.

import { timingSafeEqual } from "./timing-safe-equal.ts";

/** Reconstruct the public URL Twilio POSTed to (set TWILIO_WEBHOOK_URL if needed). */
export function webhookUrlForFunction(functionName: string): string {
  const explicit = Deno.env.get(`TWILIO_WEBHOOK_URL_${functionName.toUpperCase().replace(/-/g, "_")}`);
  if (explicit?.trim()) return explicit.trim();
  const base = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "");
  if (!base) throw new Error("SUPABASE_URL missing");
  return `${base}/functions/v1/${functionName}`;
}

export async function validateTwilioRequest(
  authToken: string,
  signature: string | null,
  url: string,
  params: Record<string, string>,
): Promise<boolean> {
  if (!signature) return false;
  const sorted = Object.keys(params).sort();
  let payload = url;
  for (const key of sorted) payload += key + params[key];
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(authToken),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
  return timingSafeEqual(expected, signature);
}
