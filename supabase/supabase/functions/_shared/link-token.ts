// The secret in a guest's private links (MESITA-3954 calendar feed,
// MESITA-3971 MCP connector): 32 random bytes, base64url, 43 characters.

export function newLinkToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** A token as the links carry it: base64url, at least 32 characters. */
export function isLinkToken(v: unknown): v is string {
  return typeof v === "string" && /^[A-Za-z0-9_-]{32,128}$/.test(v);
}
