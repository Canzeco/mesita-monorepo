// The staff token, per place, on this device (MESITA-3565). The waiter code
// is never kept: only the 12-hour token the server answered. There is no
// Staff QR (MESITA-3734).

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

// The places this phone works at (MESITA-4823), last used first: the guest's
// QR names no place, so the phone says which one it bills for. Names only;
// the key is the token above.
export type StaffPlace = { id: string; name: string | null };
const PLACES_KEY = "mesita.staff-places";

export function readStaffPlaces(): StaffPlace[] {
  try {
    const v = JSON.parse(localStorage.getItem(PLACES_KEY) ?? "[]") as unknown;
    return Array.isArray(v) ? v.filter((p): p is StaffPlace => typeof (p as StaffPlace | null)?.id === "string").slice(0, 10) : [];
  } catch {
    return [];
  }
}

export function rememberStaffPlace(place: StaffPlace) {
  try {
    localStorage.setItem(PLACES_KEY, JSON.stringify([place, ...readStaffPlaces().filter((p) => p.id !== place.id)].slice(0, 10)));
  } catch {
    // Private mode: the manager's link is opened again next time.
  }
}
