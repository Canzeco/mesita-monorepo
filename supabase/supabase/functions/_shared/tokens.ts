// URL-safe random invite tokens for place_invites — 18 random bytes encoded
// as base64url. The only minter: the SQL helper public.generate_invite_token()
// was dropped in migration 20260626200000_minimize_functions.sql.

export function newInviteToken(byteLength = 18): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
