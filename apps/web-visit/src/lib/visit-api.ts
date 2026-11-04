// The two calls this app makes (MESITA-3240), with plain fetch: no sign-in, so
// supabase-js has no session to carry. A refusal's words are the server's.

export type VisitReward = { kind: string; percent: number; cap_cents: number | null };

export type Visit = {
  place_name: string;
  currency: string;
  code_set: boolean;
  guest_name: string;
  /** What the guest typed (MESITA-3245). The place corrects it if it is wrong. */
  bill_cents: number | null;
  rewards: VisitReward[];
};

export type ClosedVisit = {
  bill_cents: number;
  discount_cents: number;
  total_cents: number;
  currency: string;
};

async function call<T>(name: string, body: Record<string, unknown>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Couldn't reach Mesita. Try again.");
  }
  const data = (await res.json().catch(() => null)) as ({ ok?: boolean; error?: string } & T) | null;
  if (!data?.ok) throw new Error(data?.error ?? "Something went wrong. Try again.");
  return data;
}

export function getVisit(placeId: string, code: string): Promise<Visit> {
  return call<Visit>("visit-web-get-visit", { place_id: placeId, code });
}

export function closeVisit(input: {
  placeId: string;
  code: string;
  placeCode: string;
  billCents: number;
  rewardKinds: string[];
  requestId: string;
}): Promise<ClosedVisit> {
  return call<ClosedVisit>("visit-web-close-visit", {
    place_id: input.placeId,
    code: input.code,
    place_code: input.placeCode,
    bill_cents: input.billCents,
    reward_kinds: input.rewardKinds,
    request_id: input.requestId,
  });
}
