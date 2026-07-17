import { isEmailish } from "../_shared/input.ts";

/** One person the reservationist can call/message when booking. */
export type ReservationContact = {
  name: string;
  role?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
};

const MAX_RESERVATION_CONTACTS = 8;

export function sanitiseReservationContacts(
  v: unknown,
): ReservationContact[] | "invalid" {
  if (v == null) return [];
  if (!Array.isArray(v)) return "invalid";
  if (v.length > MAX_RESERVATION_CONTACTS) return "invalid";
  const out: ReservationContact[] = [];
  for (const raw of v) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "invalid";
    const row = raw as Record<string, unknown>;
    const name = typeof row.name === "string"
      ? row.name.trim().slice(0, 80)
      : "";
    if (!name) return "invalid";
    const role = typeof row.role === "string" && row.role.trim()
      ? row.role.trim().slice(0, 60)
      : null;
    const phone = typeof row.phone === "string" && row.phone.trim()
      ? row.phone.trim().slice(0, 40)
      : null;
    let email: string | null = null;
    if (typeof row.email === "string" && row.email.trim()) {
      const e = row.email.trim().toLowerCase().slice(0, 254);
      if (!isEmailish(e)) return "invalid";
      email = e;
    }
    const notes = typeof row.notes === "string" && row.notes.trim()
      ? row.notes.trim().slice(0, 200)
      : null;
    if (!phone && !email) return "invalid";
    out.push({ name, role, phone, email, notes });
  }
  return out;
}
