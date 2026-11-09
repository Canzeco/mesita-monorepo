// The calls this app makes, with plain fetch: no sign-in on visit.mesita.ai,
// so supabase-js has no session to carry. The proof token in the URL is the
// key (MESITA-3304). A refusal's words are the server's. The two
// NEXT_PUBLIC_SUPABASE_ variables are public and the build bakes them in, so
// changing one in Vercel needs a new build, and only a commit under
// apps/web-visit makes one.

/** What Mesita received, read by the proof's token. Never who paid. */
export type Proof = {
  place: { name: string | null };
  amount_cents: number;
  /** Lowercase ISO 4217 ("mxn"). */
  currency: string;
  paid_at: string;
  /** paid, refunded, partly_refunded. */
  status: string;
  /** When staff first marked it seen; set means "Already seen". */
  seen_at: string | null;
  /** The server's clock at the read: the page's ticking clock starts here. */
  server_time: string;
  test_mode: boolean;
  ticket: string | null;
};

/** A refusal. `invalid` means the server read the token and refused it (no
 *  such proof); anything else is a failure to check, which staff retry. */
export class VisitError extends Error {
  constructor(
    message: string,
    readonly code: string | null,
    readonly invalid: boolean,
  ) {
    super(message);
  }
}

/** What a refusal says, per page. */
type Words = { invalid: string; failed: string };
const PROOF_WORDS: Words = {
  invalid: "This proof is not valid. Ask the guest to show it again.",
  failed: "Couldn't check this proof. Try again.",
};
const STORY_WORDS: Words = {
  invalid: "This Story voucher is not valid. Ask the guest to show it again.",
  failed: "Couldn't check this Story voucher. Try again.",
};

async function call<T>(name: string, body: Record<string, unknown>, words: Words = PROOF_WORDS): Promise<T> {
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
    throw new VisitError(words.failed, null, false);
  }
  const data = (await res.json().catch(() => null)) as ({ ok?: boolean; error?: string; code?: string } & T) | null;
  if (data?.ok) return data;
  const code = data?.code ?? null;
  // 404 gone and 400 (not a token) both mean this QR is no proof.
  const invalid = code === "gone" || res.status === 400 || res.status === 404;
  throw new VisitError(
    invalid ? words.invalid : words.failed,
    code,
    invalid,
  );
}

export function getProof(token: string): Promise<Proof> {
  return call<Proof>("visit-web-get-proof", { token });
}

export function markProofSeen(token: string): Promise<{ seen_at: string }> {
  return call<{ seen_at: string }>("visit-web-mark-proof-seen", { token });
}

// ── The Story voucher (MESITA-3507) ─────────────────────────────────────────

/** A paid Story voucher waiting for staff. Names the buyer's Instagram so
 *  staff match the story to the account that bought it. */
export type StoryVoucher = {
  place: { name: string | null };
  instagram_handle: string | null;
  amount_cents: number;
  /** What the guest gets once activated: price plus bonus. */
  credit_cents: number;
  currency: string;
  paid_at: string | null;
  /** Set means already activated. */
  activated_at: string | null;
  /** Refunded before activation: it can no longer be activated. */
  refunded: boolean;
  test_mode: boolean;
  server_time: string;
};

export function getStory(token: string): Promise<StoryVoucher> {
  return call<StoryVoucher>("visit-web-get-story", { token }, STORY_WORDS);
}

export function activateStory(token: string): Promise<{ activated_at: string; already: boolean }> {
  return call<{ activated_at: string; already: boolean }>("visit-web-activate-story", { token }, STORY_WORDS);
}

// ── The waiter's charge (MESITA-3306) ───────────────────────────────────────

/** A charge staff just opened: the 4-digit code the guest types on Pay and
 *  the token this screen polls with (never the place code). */
export type OpenedCharge = {
  code: string;
  charge_token: string;
  amount_cents: number;
  /** The tip staff typed after asking (MESITA-3545). */
  tip_cents: number;
  currency: string;
  ticket: string | null;
  expires_at: string;
  server_time: string;
  place: { name: string | null };
  test_mode: boolean;
};

/** What the poll answers while the charge lives. */
export type ChargeRead = {
  state: "open" | "paid";
  amount_cents: number;
  /** The charge's tip until the guest's payment binds it, then the payment's. */
  tip_cents: number;
  /** What moved on Mesita once paid (credit + card); less than the bill when
   *  the guest paid the rest at the table. */
  paid_cents: number | null;
  /** The guest is paying outside and waits for Received (MESITA-3545). */
  outside: { cents: number; tip_cents: number; expires_at: string | null } | null;
  /** Paid outside and confirmed by Received. */
  paid_outside: boolean;
  currency: string;
  ticket: string | null;
  expires_at: string;
  paid_at: string | null;
  server_time: string;
};

/** A refusal opening a charge: the server's sentence and code, and the wait
 *  when locked. */
export class ChargeError extends Error {
  constructor(
    message: string,
    readonly code: string | null,
    readonly retryAfterS: number | null,
  ) {
    super(message);
  }
}

async function post(name: string, body: Record<string, unknown>): Promise<{ res: Response | null; data: Record<string, unknown> | null }> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
      },
      body: JSON.stringify(body),
    });
    return { res, data: (await res.json().catch(() => null)) as Record<string, unknown> | null };
  } catch {
    return { res: null, data: null };
  }
}

export async function openCharge(args: {
  place_id: string;
  place_code: string;
  amount_cents: number;
  tip_cents: number;
  ticket: string | null;
}): Promise<OpenedCharge> {
  const { data } = await post("visit-web-open-charge", args);
  if (data?.ok) return data as unknown as OpenedCharge;
  const code = typeof data?.code === "string" ? data.code : null;
  const words = typeof data?.error === "string" && code ? data.error : "Couldn't open the charge. Try again.";
  throw new ChargeError(words, code, typeof data?.retry_after_s === "number" ? data.retry_after_s : null);
}

/** The poll: the charge, `gone` (expired or unknown: the screen stops), or
 *  `failed` (no answer: the screen keeps polling and says Reconnecting). */
export async function getCharge(token: string): Promise<ChargeRead | "gone" | "failed"> {
  const { res, data } = await post("visit-web-get-charge", { token });
  if (data?.ok) return data as unknown as ChargeRead;
  if (res && (res.status === 404 || res.status === 400)) return "gone";
  return "failed";
}

/** The waiter's Received on a bill the guest pays outside (MESITA-3545):
 *  `paid`, or the server's words to show ("Cancelled by the guest",
 *  "Expired", "Not paying outside yet"), or `failed` (no answer: tap again). */
export async function confirmCharge(token: string): Promise<{ paid_at: string } | { refused: string } | "failed"> {
  const { res, data } = await post("visit-web-confirm-charge", { token });
  if (data?.ok) return { paid_at: String(data.paid_at) };
  if (!res || res.status >= 500 || !data) return "failed";
  return { refused: typeof data.error === "string" ? data.error : "Couldn't confirm. Try again." };
}

// ── The staff list of payments (MESITA-3462) ────────────────────────────────

/** One payment as staff read it: never who paid. */
export type StaffPayment = {
  id: string;
  amount_cents: number;
  tip_cents: number;
  currency: string;
  paid_at: string;
  ticket: string | null;
  seen: boolean;
  refunded: boolean;
  /** Paid outside, confirmed by a Received at paid_at (MESITA-3545). */
  outside?: boolean;
  /** An outside bill nobody confirmed: "Outside · Expired". */
  expired?: boolean;
};

export type PaymentList = {
  payments: StaffPayment[];
  place: { name: string | null };
  server_time: string;
  test_mode: boolean;
  /** Only on the read that carried the place code: every read after carries
   *  this instead, never the code. */
  staff_token?: string;
};

/** The read: the list; `staff_only` (no staff access: the code is wrong, or
 *  the token is stale or the owner changed the code); a refusal staff can
 *  act on (`refused`, the server's words); or `failed` (no answer: the
 *  screen keeps reading and says Reconnecting). */
export async function listPayments(
  args: { place_id: string; place_code: string } | { place_id: string; staff_token: string },
): Promise<PaymentList | { kind: "staff_only" | "refused"; error: string; retryAfterS: number | null } | "failed"> {
  const { res, data } = await post("visit-web-list-payments", args);
  if (data?.ok) return data as unknown as PaymentList;
  if (!res || res.status >= 500 || !data) return "failed";
  const error = typeof data.error === "string" ? data.error : "Couldn't read the payments. Try again.";
  const retryAfterS = typeof data.retry_after_s === "number" ? data.retry_after_s : null;
  return { kind: data.code === "staff_only" ? "staff_only" : "refused", error, retryAfterS };
}
