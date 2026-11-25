import { z } from "zod";

import { callEdge } from "@/lib/edge";

const cents = z.coerce.number().catch(0);

/** Credits the guest still holds, in cents, from the pay list. */
export async function creditsHeld(signal?: AbortSignal): Promise<number> {
  const answer = await callEdge(
    "consumer-web-list-pay-places",
    {},
    z.object({
      places: z.array(z.object({ available_cents: cents, pending_cents: cents })).catch([]),
    }),
    { signal },
  );
  return answer.places.reduce((sum, place) => sum + place.available_cents + place.pending_cents, 0);
}

export async function deleteAccount(): Promise<void> {
  await callEdge("consumer-web-delete-account", {}, z.object({}), { mutation: true });
}
