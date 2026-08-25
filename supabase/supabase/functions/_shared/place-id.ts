// Column remap for the 20260825005000 project_id → place_id cutover.
// Document types (TicketDoc, ReservationDoc) still speak `project_id` so
// HTTP JSON and existing call sites do not move. Postgres columns are
// `place_id`. The write doors are the only place the two names meet.

export function toPlaceIdPatch(
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (key === "ticket_code") continue;
    out[key === "project_id" ? "place_id" : key] = value;
  }
  return out;
}

export function remapPlaceIdIdent(name: string): string {
  if (name === "project_id") return "place_id";
  if (name === "ticket_code") return "check_code";
  return name;
}

export function remapPlaceIdSelect(select: string): string {
  return select
    .replace(/\bproject_id\b/g, "place_id")
    .replace(/\bticket_code\b/g, "check_code");
}

export function fromPlaceIdRow(
  row: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!row) return null;
  const out: Record<string, unknown> = { ...row };
  if ("place_id" in out) out.project_id = out.place_id;
  if ("check_code" in out && !("ticket_code" in out)) {
    out.ticket_code = out.check_code;
  }
  return out;
}

export function rowPlaceId(
  row: { place_id?: string | null; project_id?: string | null },
): string | null {
  return row.place_id ?? row.project_id ?? null;
}
