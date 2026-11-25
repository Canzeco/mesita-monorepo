// HTTP helpers shared by all Mesita Edge Functions: JSON response builder
// + the canonical OPTIONS pre-flight handler. Pure utilities; no DB calls,
// no fetches, no auth — safe to import from any product or internal EF.

import { CORS } from "./cors.ts";
import { errorMessage } from "./errors.ts";

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

/** Canonical success envelope `{ ok: true, ... }`. */
export function jsonOk(
  body: Record<string, unknown> = {},
  status = 200,
): Response {
  return json({ ok: true, ...body }, status);
}

/** Canonical error envelope `{ ok: false, error }`. */
export function jsonError(error: string, status = 400): Response {
  return json({ ok: false, error }, status);
}

export type EFHandler = (req: Request) => Response | Promise<Response>;

/** The handler, except a throw becomes a logged `{ ok: false }` 500 with CORS
 *  (MESITA-2856). Without it a throw is the runtime's bare 500 with no CORS
 *  headers, which the browser reports as a network failure it cannot read.
 *  Not covered: `runInBackground` work, and an error after a streamed body
 *  has started — both happen after this returns. */
export function withJsonErrors(fnName: string, handler: EFHandler): EFHandler {
  return async (req) => {
    try {
      return await handler(req);
    } catch (err) {
      return unhandledError(fnName, err);
    }
  };
}

function unhandledError(fnName: string, err: unknown): Response {
  console.error(`[${fnName}] unhandled`, errorMessage(err));
  return jsonError("Internal error", 500);
}

// ─── The app's contract number (MESITA-4931, Docs › Apps › A2 §8) ───
//
// An installed app outlives the backend it was built for. It sends one whole
// number in x-mesita-contract; the secret MOBILE_MIN_CONTRACT is the lowest
// one still served. The web sends none and is never checked. This is about
// compatibility and never grants or refuses access.

const WHOLE_NUMBER = /^\d+$/;

/** The app's number: null when it sent none, 0 when it is not a whole number. */
export function seenContract(req: Request): number | null {
  const raw = req.headers.get("x-mesita-contract");
  if (raw === null) return null;
  return WHOLE_NUMBER.test(raw.trim()) ? Number(raw.trim()) : 0;
}

/** The 426 for an app older than the minimum, or null. An unset or malformed
 *  minimum refuses nobody; a malformed one says so in the log. */
function refuseOldApp(fnName: string, req: Request): Response | null {
  if (!fnName.startsWith("consumer-web-") || req.method === "OPTIONS") return null;
  const seen = seenContract(req);
  if (seen === null) return null;
  // sb-request-id is Supabase's own id for the call, returned to the caller
  // on every answer, so a screen and this line share one id.
  console.log(`[${fnName}]`, JSON.stringify({ contract: seen, request_id: req.headers.get("sb-request-id") }));
  const raw = (Deno.env.get("MOBILE_MIN_CONTRACT") ?? "").trim();
  if (!raw) return null;
  if (!WHOLE_NUMBER.test(raw)) {
    console.error(`[${fnName}]`, JSON.stringify({ code: "min_contract_malformed" }));
    return null;
  }
  const min = Number(raw);
  if (seen >= min) return null;
  return json({
    ok: false,
    code: "update_app",
    error: "Update Mesita to continue.",
    min_contract: min,
    seen_contract: seen,
  }, 426);
}

const servedBy = new WeakMap<Request, string>();

/** The Edge Function serving this request; undefined outside serveJson. */
export function servingFunction(req: Request): string | undefined {
  return servedBy.get(req);
}

/** What serveJson serves: the app's contract check, then the handler, with a
 *  throw answered as JSON. */
export function servedHandler(fnName: string, handler: EFHandler): EFHandler {
  return withJsonErrors(fnName, (req) => {
    servedBy.set(req, fnName);
    return refuseOldApp(fnName, req) ?? handler(req);
  });
}

/** Every Edge Function serves through this; it is the only `Deno.serve(`
 *  in functions/ (serve-json-guard.test.ts). The try/catch in
 *  withJsonErrors does the work; `onError` is the runtime's own backstop. */
export function serveJson(fnName: string, handler: EFHandler): void {
  Deno.serve(
    { onError: (err) => unhandledError(fnName, err) },
    servedHandler(fnName, handler),
  );
}

/** The 500 for a caught failure: logs `[fnName] {request_id, ...fields, error}`
 *  and answers `{ ok:false, error: userError, request_id }`, so the guest's
 *  screen and the log line share one id. Pass `requestId` when the handler
 *  minted it earlier (to log it on other lines). */
export function failWithRequestId(
  fnName: string,
  userError: string,
  err: unknown,
  fields: Record<string, unknown> = {},
  requestId: string = crypto.randomUUID(),
): Response {
  console.error(`[${fnName}]`, JSON.stringify({ request_id: requestId, ...fields, error: errorMessage(err) }));
  return json({ ok: false, error: userError, request_id: requestId }, 500);
}

// Use as the first line of every serveJson handler:
//   if (req.method === "OPTIONS") return corsPreflight();
export function corsPreflight(): Response {
  return new Response(null, { headers: CORS });
}

/** Canonical 405 for every Mesita EF that only accepts POST (+ OPTIONS). */
export function methodNotAllowed(): Response {
  return json({ ok: false, error: "Method not allowed" }, 405);
}

/** Return a 405 unless `req.method` is one of `allowed` (OPTIONS handled separately). */
export function rejectUnlessMethods(
  req: Request,
  ...allowed: string[]
): Response | null {
  return allowed.includes(req.method) ? null : methodNotAllowed();
}

// Parse a JSON request body for endpoints where the body is REQUIRED.
// Returns a tagged result so the handler can early-return the 400 without
// repeating the try/catch:
//
//   const bodyRes = await readJson<Body>(req);
//   if (!bodyRes.ok) return bodyRes.response;
//   const body = bodyRes.body;
//
// A malformed/empty body yields a 400 `{ ok: false, error: "Invalid JSON" }`
// — the canonical shape every other validation error in these EFs uses.
//
// So does a literal `null` body: `JSON.parse` accepts it, and nearly every
// caller reads a field off `bodyRes.body` at once, so it used to throw out
// of the Deno.serve handler as a bare 500 with no CORS headers — the same
// hole readJsonOr closed for MESITA-1730 below. Scalars and arrays still
// pass: a field read on them is `undefined`, not a throw.
export async function readJson<T>(
  req: Request,
): Promise<{ ok: true; body: T } | { ok: false; response: Response }> {
  try {
    const parsed = await req.json();
    if (parsed === null) {
      return { ok: false, response: jsonError("Invalid JSON", 400) };
    }
    return { ok: true, body: parsed as T };
  } catch {
    return {
      ok: false,
      response: jsonError("Invalid JSON", 400),
    };
  }
}

// Lenient variant for endpoints where the body is OPTIONAL — anonymous
// browse, optional pagination/filter fields, etc. Returns `fallback` when
// the body is absent or unparseable instead of erroring:
//
//   const body = await readJsonOr<Body>(req, {});
/** The request body, or `fallback` when there isn't a usable one.
 *
 *  `catch` is not enough. It only fires on a PARSE failure, and `JSON.parse`
 *  accepts the literal `null` happily — so a body of `null` used to come back
 *  as `null`, past the fallback, into 51 call sites that all do
 *  `readJsonOr<Body>(req, {})` and then read a field off it. Every one threw a
 *  TypeError out of the Deno.serve handler: the runtime's own 500, with no CORS
 *  headers and no { ok:false } envelope, so a browser saw a CORS failure rather
 *  than an error it could render (MESITA-1730). The reachable ones were not
 *  only admin: consumer browse, business place reads, and the eleven-* agent
 *  webhooks all sat behind this.
 *
 *  Every caller passes an object and dereferences it immediately, so coalescing
 *  null to the fallback is what all of them already meant. */
export async function readJsonOr<T>(req: Request, fallback: T): Promise<T> {
  try {
    const parsed = await req.json();
    return (parsed ?? fallback) as T;
  } catch {
    return fallback;
  }
}

// MESITA-26 alias window — place-row id payload key unification.
// The same place-row id arrives as `projectId` (older admin calls) or
// `placeId` (create/find). Canonical key going forward is `placeId`.
//
// Every receiving EF reads the id through this helper so BOTH the legacy
// and the canonical key keep working while clients migrate. Precedence:
// placeId > projectId (first non-empty string wins, trimmed).
// Once all clients send `placeId`, drop the legacy key here in one place.
export function readPlaceIdAlias(body: {
  placeId?: unknown;
  projectId?: unknown;
}): string {
  for (const key of ["placeId", "projectId"] as const) {
    const v = body[key];
    if (typeof v === "string" && v.trim() !== "") return v.trim();
  }
  return "";
}

// Clamp and integer-normalize numeric pagination limits.
// Keeps limit handling consistent across list endpoints.
export function clampIntRange(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

/** A body `limit`: a number is truncated into 1..max; anything else is the default. */
export function readLimit(raw: unknown, fallback: number, max: number): number {
  return typeof raw === "number" ? clampIntRange(raw, 1, max) : fallback;
}
