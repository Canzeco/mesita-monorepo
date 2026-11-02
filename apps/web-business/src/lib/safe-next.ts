// A `next` path is only ever this app's own path: one leading slash, no
// scheme, no protocol-relative `//host`. Anything else is dropped.
export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return null;
  if (raw.startsWith("/auth/")) return null;
  return raw.slice(0, 300);
}

export const NEXT_COOKIE = "mb_next";
