// Gift Credits — the PUBLIC preview call (MESITA-1677).
//
// A PLAIN FETCH, NOT invokeEF/supabase-js — deliberately, mirroring
// apps/web-validate's check-api.ts. gift-web-preview-code is verify_jwt=false
// (config.toml): the keyed HMAC digest of the code is the whole
// authentication, and this is called from a Server Component OUTSIDE the
// (shell) auth wall, before the guest has any session at all. Pulling in the
// authed Supabase client machinery here would be reaching for a tool this
// page structurally cannot use yet — sign-in is step TWO, after this render.
//
// The Supabase URL is a public constant (it ships in every app bundle);
// NEXT_PUBLIC_SUPABASE_URL overrides it if the project ever moves.

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://yjalywfzdelacdzccpgb.supabase.co";

const FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`;

export type GiftPreview =
  | {
    state: "unclaimed";
    organizationName: string;
    paidCents: number;
    bonusCents: number;
    creditedCents: number;
    note: string | null;
    /** True only if a future hold ever returns — see the EF's own comment.
     *  Always false today (credits activate immediately on claim). */
    pending: boolean;
    expiresAt: string;
  }
  | { state: "claimed" }
  | { state: "cancelled" };

export type GiftPreviewResult =
  | { ok: true; gift: GiftPreview }
  | { ok: false; status: number };

export async function fetchGiftPreview(code: string): Promise<GiftPreviewResult> {
  let res: Response;
  try {
    res = await fetch(`${FUNCTIONS_BASE}/gift-web-preview-code`, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
  } catch {
    return { ok: false, status: 0 };
  }

  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  const parsed = (payload ?? {}) as { ok?: boolean; gift?: GiftPreview };
  if (res.ok && parsed.ok && parsed.gift) {
    return { ok: true, gift: parsed.gift };
  }
  return { ok: false, status: res.status };
}
