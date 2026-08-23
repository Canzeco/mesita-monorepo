"use server";

import { efInvoke } from "@/lib/supabase-ef";

// ─── The invitation door, admin side (MESITA-1160) ───────────────────────
//
// ONE Edge Function serves both halves. `admin-web-grant-class` writes the
// door FACT (consumers.invitation_class_key + invitation_granted_at) and then
// calls the shared recompute (_shared/class-doors.ts, MESITA-972), which
// settles the slot from every open door. Revoking is the same call with
// `classKey: null` — it clears the fact and the recompute lands the best
// door left (subscription → premium, reach → influencer, else standard).
//
// The consumer is named by `lookup`, not by uuid: the EF accepts a uuid, an
// 8-digit consumer code, a phone, an @handle or a name, and it REFUSES to
// guess — an ambiguous lookup comes back 409 listing the candidates, a miss
// comes back 404. Those two statuses are the whole UX of this page, so they
// are carried through to the client rather than flattened into a message.

/** `_shared/consumer-lookup.ts`'s ConsumerSummary, as the EF returns it. */
export type ConsumerSummary = {
  id: string;
  code: string | null;
  name: string | null;
  phone: string | null;
  instagramHandle: string | null;
  followers: number | null;
  classKey: string | null;
  classOrigin: string | null;
  grantedAt: string | null;
  invitationClassKey: string | null;
  invitationGrantedAt: string | null;
};

type GrantResponse = {
  consumerId: string;
  /** The class the recompute settled on — NOT necessarily the one granted. */
  classKey: string;
  origin: string;
  consumer: ConsumerSummary;
};

export type DoorResult =
  | { ok: true; consumer: ConsumerSummary; classKey: string; origin: string }
  | { ok: false; error: string; status: number };

async function callGrantClass(
  lookup: string,
  classKey: string | null,
): Promise<DoorResult> {
  const r = await efInvoke<GrantResponse>("admin-web-grant-class", {
    lookup,
    classKey,
  });
  if (!r.ok) return { ok: false, error: r.error, status: r.status };
  return {
    ok: true,
    consumer: r.data.consumer,
    classKey: r.data.classKey,
    origin: r.data.origin,
  };
}

export async function grantInvitation(
  lookup: string,
  classKey: string,
): Promise<DoorResult> {
  return callGrantClass(lookup, classKey);
}

export async function revokeInvitation(lookup: string): Promise<DoorResult> {
  return callGrantClass(lookup, null);
}
