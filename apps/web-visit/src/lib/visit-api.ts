// The calls this app makes (MESITA-3240), with plain fetch: no sign-in, so
// supabase-js has no session to carry. A refusal's words are the server's. The two
// NEXT_PUBLIC_SUPABASE_ variables are public and the build bakes them in, so changing
// one in Vercel needs a new build, and only a commit under apps/web-visit makes one.

export type VisitReward = { kind: string; percent: number; cap_cents: number | null };

export type VisitQuote = { percent: number; discount_cents: number; total_cents: number };

/** The shared visit (MESITA-3270), the same picture the guest's phone reads. */
export type Visit = {
  place_name: string;
  currency: string;
  code_set: boolean;
  guest_name: string;
  /** What staff typed from the ticket. */
  bill_cents: number | null;
  bill_confirmed_at: string | null;
  story: boolean;
  story_offered: boolean;
  /** The rewards that count right now: Story only once staff saw it. */
  rewards: VisitReward[];
  quote: VisitQuote | null;
  quote_with_story: VisitQuote | null;
  step: "bill" | "task" | "pay";
};

export type ClosedVisit = {
  bill_cents: number;
  discount_cents: number;
  total_cents: number;
  currency: string;
};

/** A refusal, with the server's machine word so a poll can tell "ended" from a bad line. */
export class VisitError extends Error {
  constructor(
    message: string,
    readonly code: string | null,
  ) {
    super(message);
  }
}

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
    throw new VisitError("Couldn't reach Mesita. Try again.", null);
  }
  const data = (await res.json().catch(() => null)) as ({ ok?: boolean; error?: string; code?: string } & T) | null;
  if (!data?.ok) throw new VisitError(data?.error ?? "Something went wrong. Try again.", data?.code ?? null);
  return data;
}

/** The QR wouldn't scan (MESITA-3262): the two codes get what its link would have held. */
export function findVisit(memberNumber: string, placeCode: string): Promise<{ place_id: string; code: string }> {
  return call("visit-web-find-visit", { member_number: memberNumber, place_code: placeCode });
}

export function getVisit(placeId: string, code: string): Promise<Visit> {
  return call<Visit>("visit-web-get-visit", { place_id: placeId, code });
}

export function setBill(input: { placeId: string; code: string; placeCode: string; billCents: number }): Promise<Visit> {
  return call<Visit>("visit-web-set-bill", {
    place_id: input.placeId,
    code: input.code,
    place_code: input.placeCode,
    bill_cents: input.billCents,
  });
}

export function setTask(input: { placeId: string; code: string; placeCode: string; seen: boolean }): Promise<Visit> {
  return call<Visit>("visit-web-set-task", {
    place_id: input.placeId,
    code: input.code,
    place_code: input.placeCode,
    seen: input.seen,
  });
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
