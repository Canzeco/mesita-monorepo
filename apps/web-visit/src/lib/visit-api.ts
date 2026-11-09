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
