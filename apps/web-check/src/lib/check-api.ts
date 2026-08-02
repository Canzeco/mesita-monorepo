// Tickets v2 (MESITA-806) — plain-fetch client for the public check-web-*
// Edge Functions. web-landing deliberately has NO supabase-js dependency:
// these endpoints are verify_jwt=false and the 128-bit check code in the URL
// is the whole authentication, so a bare fetch is the entire integration.
//
// The Supabase URL is a public constant (it ships in every app bundle);
// NEXT_PUBLIC_SUPABASE_URL overrides it if the project ever moves, but no
// Vercel env setup is required for this page to work.

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://yjalywfzdelacdzccpgb.supabase.co";

const FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`;

// The public payload — mirrors the allowlist shaped by the EF
// (_shared/ticket-check.ts shapeCheckPayload). Nothing class- or rung-shaped
// ever arrives here by design.
export type CheckActionState = "none" | "pending" | "submitted" | "approved" | "rejected";

export type CheckPayload = {
  status: string;
  created_at: string;
  first_scanned_at: string | null;
  currency: string;
  place: { name: string; slug: string | null };
  guest: { display_name: string; instagram_handle: string | null };
  bill: {
    check_subtotal_cents: number | null;
    discount_percent: number | null;
    discount_cents: number | null;
    amount_due_cents: number | null;
    reward_cap_mxn: number | null;
  } | null;
  story: { required: boolean; state: CheckActionState; screenshot_url: string | null };
  review: { required: boolean; state: CheckActionState };
  self_opened: boolean;
  scanned_before?: boolean;
};

type EFResult<T> = { ok: true } & T | { ok: false; error?: string; code?: string };

async function callCheckEF<T>(
  fn: string,
  body: Record<string, unknown>,
): Promise<EFResult<T>> {
  try {
    const res = await fetch(`${FUNCTIONS_BASE}/${fn}`, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await res.json()) as EFResult<T>;
  } catch {
    return { ok: false, error: "network" };
  }
}

export function fetchCheck(code: string) {
  return callCheckEF<{ check: CheckPayload }>("check-web-get-ticket", { code });
}

export function submitBill(code: string, checkSubtotalCents: number) {
  return callCheckEF<{ check: unknown }>("check-web-submit-bill", {
    code,
    checkSubtotalCents,
  });
}

export function verifyAction(
  code: string,
  action: "story" | "review",
  decision: "approve" | "reject",
) {
  return callCheckEF<{ state: string }>("check-web-verify-action", {
    code,
    action,
    decision,
  });
}

export function markPaid(code: string) {
  return callCheckEF<{ alreadyPaid?: boolean }>("check-web-mark-paid", { code });
}

export function formatMxn(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} MXN`;
}
