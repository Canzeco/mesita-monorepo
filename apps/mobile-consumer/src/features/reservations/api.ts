import { z } from "zod";

import { callEdge } from "@/lib/edge";

const text = z.string().nullish().catch(null);
const number = z.coerce.number().nullish().catch(null);

export type Reservation = {
  id: string;
  when: string;
  party: number | null;
  state: string;
  notes: string | null;
  placeName: string | null;
  placeId: string | null;
  reference: string | null;
};

const rowSchema = z
  .object({
    id: z.string(),
    reserved_at: text,
    party_size: number,
    state: text,
    notes: text,
    reference_code: text,
    place: z
      .object({ id: text, name: text })
      .nullish()
      .catch(null),
  })
  .transform(
    (row): Reservation => ({
      id: row.id,
      when: row.reserved_at ?? "",
      party: row.party_size ?? null,
      state: row.state ?? "",
      notes: row.notes ?? null,
      placeName: row.place?.name ?? null,
      placeId: row.place?.id ?? null,
      reference: row.reference_code ?? null,
    }),
  );

export function listReservations(signal?: AbortSignal): Promise<Reservation[]> {
  return callEdge("consumer-web-list-reservations", { scope: "all" }, z.object({ reservations: z.array(rowSchema).catch([]) }), {
    signal,
  }).then((answer) => answer.reservations);
}

export type ReserveNotify = "app" | "call";

export type ReserveInput = {
  placeId: string;
  reservedAt: string;
  partySize: number;
  notes: string;
  firstName: string;
  lastName: string;
  requestId: string;
  onConfirm: ReserveNotify;
  onReject: ReserveNotify;
};

export async function createReservation(input: ReserveInput): Promise<string> {
  const notes = input.notes.trim();
  const answer = await callEdge(
    "consumer-web-create-reservation",
    {
      project_id: input.placeId,
      reserved_at: input.reservedAt,
      party_size: input.partySize,
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim(),
      request_id: input.requestId,
      consumer_notify: input.onReject,
      confirm_notify: input.onConfirm,
      ...(notes ? { notes } : {}),
    },
    z.object({ reservation: z.object({ id: z.string() }) }),
    { mutation: true },
  );
  return answer.reservation.id;
}

export async function updateReservation(id: string, reservedAt: string, partySize: number): Promise<void> {
  await callEdge(
    "consumer-web-update-reservation",
    { reservation_id: id, reserved_at: reservedAt, party_size: partySize },
    z.object({}),
    { mutation: true },
  );
}

export async function cancelReservation(id: string): Promise<void> {
  await callEdge("consumer-web-cancel-reservation", { reservation_id: id }, z.object({}), { mutation: true });
}
