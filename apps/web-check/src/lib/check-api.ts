// Tickets v2/v3 (MESITA-806/849/850) — plain-fetch client for the public check-web-*
// Edge Functions. web-landing deliberately has NO supabase-js dependency:
// these endpoints are verify_jwt=false and the 128-bit check code in the URL
// is the whole authentication, so a bare fetch is the entire integration.
//
// The Supabase URL is a public constant (it ships in every app bundle);
// NEXT_PUBLIC_SUPABASE_URL overrides it if the project ever moves, but no
// Vercel env setup is required for this page to work.

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://yjalywfzdelacdzccpgb.supabase.co";

const FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`;

// The public payload — mirrors the allowlist shaped by the EF
// (_shared/ticket-check.ts shapeCheckPayload). Nothing class- or rung-shaped
// ever arrives here by design.
export type CheckActionState =
  "none" | "pending" | "submitted" | "approved" | "rejected";

export type CheckPayload = {
  status: string;
  created_at: string;
  first_scanned_at: string | null;
  currency: string;
  /** v4 (MESITA-1090): the CAS token — every staff verdict echoes this back
   *  as expectedUpdatedAt, so an approve can never land on numbers this
   *  screen never rendered. */
  updated_at?: string;
  approved_at?: string | null;
  fix_requested?: string | null;
  fix_note?: string | null;
  paid_method?: string | null;
  validated_at?: string | null;
  place: { name: string; slug: string | null };
  guest: { display_name: string; instagram_handle: string | null };
  bill: {
    bill_subtotal_cents: number | null;
    tip_cents?: number | null;
    tip_pct?: number | null;
    discount_percent: number | null;
    discount_cents: number | null;
    amount_due_cents: number | null;
    reward_cap_mxn: number | null;
  } | null;
  /** v3b (MESITA-850): the cap-as-instruction block — present only while the
   *  ticket has no bill. States what the place committed to ("N% off, up to
   *  MX$cap") so staff can apply it at their own POS and close directly. */
  offer?: {
    discount_percent: number | null;
    reward_cap_mxn: number | null;
  } | null;
  story: {
    required: boolean;
    state: CheckActionState;
    screenshot_url: string | null;
  };
  review: { required: boolean; state: CheckActionState };
  self_opened: boolean;
  scanned_before?: boolean;
  /** The place set a staff PIN (MESITA-823) — write actions must carry one.
   *  Boolean only; the digits never leave the server. */
  pin_required?: boolean;
  /** MESITA-1095: the guest bill is always required. Older bundles still
   *  read this flag; new UI treats any missing bill as blocking. */
  bill_required?: boolean;
};

/** A failed call. `status` is the HTTP status, or 0 when the request never
 *  reached the Edge Function (offline, DNS, CORS). Callers MUST branch on it:
 *  only 404 means "this check does not exist". */
export type EFFailure = {
  ok: false;
  error?: string;
  code?: string;
  status: number;
};

export type EFResult<T> = ({ ok: true } & T) | EFFailure;

async function callCheckEF<T>(
  fn: string,
  body: Record<string, unknown>,
): Promise<EFResult<T>> {
  let res: Response;
  try {
    res = await fetch(`${FUNCTIONS_BASE}/${fn}`, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, error: "network", status: 0 };
  }

  // A 502 from the edge, a cold-start timeout or a WAF page is not JSON —
  // swallow the parse error and let the status carry the meaning.
  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  const parsed = (payload ?? {}) as {
    ok?: boolean;
    error?: string;
    code?: string;
  };
  if (res.ok && parsed.ok) return payload as { ok: true } & T;
  return {
    ok: false,
    error: parsed.error,
    code: parsed.code,
    status: res.status,
  };
}

// Staff-facing Spanish for every way a call can fail. The Edge Functions
// answer in English ("Check not found", "Too many requests") — never show
// those raw, and never imply the ticket is fake when the truth is that
// Mesita is unreachable.
const FAILURE_CODE_COPY: Record<string, string> = {
  pin_required: "Este lugar pide un PIN del personal para continuar.",
  pin_invalid: "PIN incorrecto — inténtalo de nuevo.",
  bill_required:
    "Hay que registrar la cuenta antes de aprobar el ticket.",
  // v4 (MESITA-1090): la escritura del cliente siempre gana — un 409 aquí
  // fuerza a re-mirar la cuenta antes de aprobar, nunca aprueba en silencio.
  stale_ticket: "El cliente acaba de cambiar algo, revisa la cuenta otra vez.",
  fix_outstanding:
    "Hay una corrección pendiente — espera a que el cliente la envíe.",
  stale_state: "El ticket cambió de estado — actualiza la pantalla.",
};

export function checkErrorMessage(res: EFFailure): string {
  if (res.code && FAILURE_CODE_COPY[res.code])
    return FAILURE_CODE_COPY[res.code];
  if (res.status === 0) {
    return "Sin conexión. Revisa la señal del teléfono e inténtalo de nuevo.";
  }
  if (res.status === 404) {
    return "Este ticket ya no está disponible. Pide al cliente que vuelva a mostrar su QR.";
  }
  if (res.status === 429) {
    return "Demasiados intentos seguidos. Espera un momento y vuelve a intentarlo.";
  }
  if (res.status >= 500) {
    return "Mesita no responde en este momento. Inténtalo de nuevo en unos segundos.";
  }
  return "Algo salió mal — inténtalo de nuevo.";
}

export function fetchCheck(code: string) {
  return callCheckEF<{ check: CheckPayload }>("check-web-get-ticket", { code });
}

export function markPaid(code: string, pin?: string) {
  return callCheckEF<{ alreadyPaid?: boolean }>("check-web-mark-paid", {
    code,
    ...(pin ? { pin } : {}),
  });
}

// ── THE TICKET v4 — the handshake (MESITA-1090/1092). ────────────────────

/** open → scanned. An affirmative staff write, fired once by the page —
 *  never a side effect of a read. Idempotent: already-past-open answers ok. */
export function scanTicket(code: string, pin?: string) {
  return callCheckEF<{ status?: string; already?: boolean }>(
    "check-web-scan-ticket",
    { code, ...(pin ? { pin } : {}) },
  );
}

/** The verdict, half one: approve. Freezes the amount server-side. */
export function approveTicket(
  code: string,
  expectedUpdatedAt: string,
  pin?: string,
) {
  return callCheckEF<{ approvedAt?: string; already?: boolean }>(
    "check-web-approve-ticket",
    { code, expectedUpdatedAt, ...(pin ? { pin } : {}) },
  );
}

export type CheckFix = "bill" | "proof" | "reward";

/** The verdict, half two: send back ONE named fix. No free text beyond the
 *  optional note; the ticket stays scanned, same code, no new QR. */
export function requestFix(
  code: string,
  fix: CheckFix,
  expectedUpdatedAt: string,
  pin?: string,
) {
  return callCheckEF<{ fix?: string; already?: boolean }>(
    "check-web-request-fix",
    { code, fix, expectedUpdatedAt, ...(pin ? { pin } : {}) },
  );
}

/** paying/approved → revealed. Payment confirmed; the ticket closes. */
export function validateTicket(code: string, pin?: string) {
  return callCheckEF<{ alreadyPaid?: boolean }>("check-web-validate-ticket", {
    code,
    ...(pin ? { pin } : {}),
  });
}

/** The AUDIT-FREE live read the poll runs while a ticket is open on screen.
 *  check-web-get-ticket logs an event per read and the rate limiter counts
 *  events per ip — polling through it would rate-limit the waiter out of
 *  their own approve. This endpoint writes nothing. */
export type CheckPollPayload = {
  status: string;
  updated_at: string;
  fix_requested: string | null;
  fix_note: string | null;
  approved_at: string | null;
  validated_at: string | null;
  paid_method: string | null;
  bill: {
    bill_subtotal_cents: number | null;
    tip_cents: number | null;
    tip_pct: number | null;
    discount_percent: number | null;
    discount_cents: number | null;
    amount_due_cents: number | null;
  } | null;
  story_state: string;
  review_state: string;
};

export function pollTicket(code: string) {
  return callCheckEF<{ poll: CheckPollPayload }>("check-web-poll-ticket", {
    code,
  });
}

export function formatMxn(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} MXN`;
}
