// Showing an open gift's link again (MESITA-4390).
//
// Pato, 2026-11-18: "if i click to create gift, but i already have gift
// oepns, like show the prev list as a prev step … select current and copy or
// just create new gift". A link's key gates money, so wallet_gifts keeps its
// hash for claims (MESITA-3292). To show the link to its sender again, the
// key is ALSO kept sealed: AES-GCM under a key derived (HKDF-SHA-256) from
// the project's service-role secret. A copy of the database alone cannot
// open it; the EFs, which hold that secret, can. No new secret to manage: if
// the service-role secret rotates, old sealed keys stop opening and their
// gifts can only be taken back, as before.
//
// Sealed form: "v1." + base64url(12-byte IV ‖ ciphertext+tag).

const INFO = new TextEncoder().encode("mesita gift-token seal v1");
const SALT = new TextEncoder().encode("mesita-gift-token");

const keys = new Map<string, Promise<CryptoKey>>();

function sealKey(secret: string): Promise<CryptoKey> {
  let key = keys.get(secret);
  if (!key) {
    key = (async () => {
      const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), "HKDF", false, ["deriveKey"]);
      return crypto.subtle.deriveKey(
        { name: "HKDF", hash: "SHA-256", salt: SALT, info: INFO },
        base,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"],
      );
    })();
    keys.set(secret, key);
  }
  return key;
}

function toB64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array | null {
  try {
    const bin = atob(s.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - (s.length % 4)) % 4));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

/** The link's key, sealed for wallet_gifts.token_sealed. */
export async function sealGiftToken(token: string, secret: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await sealKey(secret), new TextEncoder().encode(token)),
  );
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv);
  out.set(ct, iv.length);
  return `v1.${toB64url(out)}`;
}

/** The key back, or null when it cannot be opened (no seal, another
 *  secret, tampered). Never throws. */
export async function openGiftToken(sealed: string | null | undefined, secret: string): Promise<string | null> {
  if (typeof sealed !== "string" || !sealed.startsWith("v1.")) return null;
  const raw = fromB64url(sealed.slice(3));
  if (!raw || raw.length <= 12) return null;
  try {
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: raw.slice(0, 12) }, await sealKey(secret), raw.slice(12));
    return new TextDecoder().decode(pt);
  } catch {
    return null;
  }
}
