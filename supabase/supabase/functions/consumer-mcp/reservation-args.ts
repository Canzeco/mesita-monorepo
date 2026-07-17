import { UUID_RE } from "./tool-args.ts";

export function parseReservationArgs(args: Record<string, unknown>): {
  ok: true;
  placeId: string;
  reservedAt: Date;
  partySize: number;
  notes: string | null;
} | { ok: false; error: string } {
  const placeId = String(args.place_id ?? "");
  const reservedAtRaw = String(args.reserved_at ?? "");
  const partySize = Math.trunc(Number(args.party_size));
  const notes = typeof args.notes === "string"
    ? args.notes.trim() || null
    : null;

  if (!UUID_RE.test(placeId)) return { ok: false, error: "place_id must be a UUID" };
  const reservedAt = new Date(reservedAtRaw);
  if (Number.isNaN(reservedAt.getTime())) {
    return { ok: false, error: "reserved_at must be a valid ISO 8601 timestamp" };
  }
  if (!Number.isFinite(partySize) || partySize < 1 || partySize > 50) {
    return { ok: false, error: "party_size must be 1..50" };
  }

  return { ok: true, placeId, reservedAt, partySize, notes };
}
