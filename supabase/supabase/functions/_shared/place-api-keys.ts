// Place API key helpers — mint, hash, resolve bearer → place_id.
// Used by business-web-*-place-api-key EFs and future place-scoped HTTP APIs.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { json } from "./http.ts";

export const PLACE_API_KEY_PREFIX = "mesita_place_";

function bytesToHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function hashPlaceApiKey(plaintext: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(plaintext),
  );
  return bytesToHex(digest);
}

/** Mint a new plaintext key. Caller must hash + persist before returning. */
export async function mintPlaceApiKeyPlaintext(): Promise<{
  plaintext: string;
  prefix: string;
  hash: string;
}> {
  const secret = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(24)));
  const plaintext = `${PLACE_API_KEY_PREFIX}${secret}`;
  return {
    plaintext,
    prefix: plaintext.slice(0, 16),
    hash: await hashPlaceApiKey(plaintext),
  };
}

export type PlaceApiKeyRow = {
  id: string;
  place_id: string;
  key_prefix: string;
  label: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

/**
 * Resolve Authorization: Bearer mesita_place_… → active key row.
 * Touches last_used_at best-effort. Returns 401 Response on failure.
 */
export async function resolvePlaceApiBearer(
  req: Request,
  admin: SupabaseClient,
): Promise<
  | { ok: true; key: PlaceApiKeyRow }
  | { ok: false; response: Response }
> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return {
      ok: false,
      response: json({ ok: false, error: "Missing bearer token" }, 401),
    };
  }
  const plaintext = authHeader.slice("Bearer ".length).trim();
  if (
    !plaintext.startsWith(PLACE_API_KEY_PREFIX) ||
    plaintext.length < 24
  ) {
    return {
      ok: false,
      response: json({ ok: false, error: "Invalid place API key" }, 401),
    };
  }

  const keyHash = await hashPlaceApiKey(plaintext);
  const { data, error } = await admin
    .from("place_api_keys")
    .select(
      "id, place_id, key_prefix, label, created_at, last_used_at, revoked_at",
    )
    .eq("key_hash", keyHash)
    .is("revoked_at", null)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      response: json({ ok: false, error: `key_lookup: ${error.message}` }, 500),
    };
  }
  if (!data) {
    return {
      ok: false,
      response: json({ ok: false, error: "Invalid or revoked API key" }, 401),
    };
  }

  void admin
    .from("place_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);

  return { ok: true, key: data as PlaceApiKeyRow };
}
