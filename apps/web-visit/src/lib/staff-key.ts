// The staff token, per place, on this device (MESITA-3565; shared with the
// Staff QR's /staff page since MESITA-3696). The place code and the Staff
// QR's secret are never kept: only the 12-hour token the server answered.

type Kept = { token: string; expires_at: string | null };
const staffKeyFor = (placeId: string) => `mesita.staff.${placeId}`;

export function readStaff(placeId: string): string | null {
  try {
    const raw = localStorage.getItem(staffKeyFor(placeId));
    const k = raw ? (JSON.parse(raw) as Kept) : null;
    if (!k || typeof k.token !== "string") return null;
    if (k.expires_at && Date.parse(k.expires_at) <= Date.now()) return null;
    return k.token;
  } catch {
    return null;
  }
}

export function keepStaff(placeId: string, token: string | null, expiresAt: string | null) {
  try {
    if (token) localStorage.setItem(staffKeyFor(placeId), JSON.stringify({ token, expires_at: expiresAt } satisfies Kept));
    else localStorage.removeItem(staffKeyFor(placeId));
  } catch {
    // Private mode: the place code is asked again next time; nothing breaks.
  }
}

/** MESITA-3708: a token minted by the Staff QR (`s2.<exp>.qr.…`). Only these
 *  may Verify; any other kept token means "Scan your Staff QR". */
export function isStaffQrToken(token: string | null): boolean {
  return !!token && /^s2\.\d{10}\.qr\./.test(token);
}

// The guest's payment a waiter was on when told to scan the Staff QR: the
// /staff page sends them back there (ten minutes at most).
const NEXT_KEY = "mesita.staff.next";
const NEXT_TTL_MS = 10 * 60_000;

export function rememberNext(path: string) {
  try {
    localStorage.setItem(NEXT_KEY, JSON.stringify({ path, at: Date.now() }));
  } catch {
    // Private mode: the waiter scans the guest's screen again.
  }
}

export function takeNext(): string | null {
  try {
    const raw = localStorage.getItem(NEXT_KEY);
    localStorage.removeItem(NEXT_KEY);
    const n = raw ? (JSON.parse(raw) as { path?: unknown; at?: unknown }) : null;
    if (!n || typeof n.path !== "string" || !n.path.startsWith("/tab/") || typeof n.at !== "number") return null;
    return Date.now() - n.at <= NEXT_TTL_MS ? n.path : null;
  } catch {
    return null;
  }
}
