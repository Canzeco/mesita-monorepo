import { fetch } from "expo/fetch";
import { z } from "zod";

import { CONTRACT } from "@/lib/build";
import { env } from "@/lib/env";
import { forcedFetch } from "@/lib/pair-state";
import { report } from "@/lib/report";
import { currentToken, refreshToken, type Token } from "@/lib/supabase";

// The one way to call the backend (Docs › Apps › A2 §7).

// The real fetch, except in a build that can force a state for `pnpm pair`.
const post = forcedFetch(fetch);

export type EdgeErrorKind = "refusal" | "network" | "unreadable" | "server";
/** safe: ask again. after-fix: the guest changes something first.
 *  reconcile-first: it may have happened, re-read before asking again.
 *  never: the app cannot get past it. */
export type EdgeRetry = "safe" | "after-fix" | "reconcile-first" | "never";

export class EdgeError extends Error {
  readonly fn: string;
  readonly kind: EdgeErrorKind;
  readonly retry: EdgeRetry;
  /** The server's code, or the app's own: network, timeout,
   *  unreadable_answer, http_<status>. */
  readonly code: string;
  readonly status: number | null;
  /** A refusal's extra fields. */
  readonly body: Record<string, unknown>;
  /** Supabase's sb-request-id: ties a screen to a backend log line. */
  readonly requestId: string | null;

  constructor(init: Omit<EdgeError, "name" | "stack" | "cause" | "toString">) {
    super(init.message);
    this.name = "EdgeError";
    this.fn = init.fn;
    this.kind = init.kind;
    this.retry = init.retry;
    this.code = init.code;
    this.status = init.status;
    this.body = init.body;
    this.requestId = init.requestId;
  }
}

/** What the auth feature hears: the refusals that move the gate. */
export type Refusal = { code: "update_app" } | { code: "suspended"; message: string } | { code: "session" };
const listeners = new Set<(refusal: Refusal) => void>();

export function onRefusal(listener: (refusal: Refusal) => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** A list the server may extend: a value this build does not know reads as
 *  "unknown", never as a failure. */
export function oneOf<const T extends readonly [string, ...string[]]>(...values: T) {
  return z.enum([...values, "unknown"] as [...T, "unknown"]).catch("unknown" as never);
}

export type CallOptions = {
  /** A mutation may have happened when its answer is lost. */
  mutation?: boolean;
  signal?: AbortSignal;
};

const READ_MS = 15_000;
const MUTATION_MS = 30_000;

type Answer = { status: number; requestId: string | null; json: unknown };

async function send(name: string, body: unknown, token: Token, opts: CallOptions): Promise<Answer> {
  const fail = (code: "network" | "timeout", message: string) =>
    new EdgeError({
      fn: name,
      kind: "network",
      retry: opts.mutation ? "reconcile-first" : "safe",
      code,
      status: null,
      message,
      body: {},
      requestId: null,
    });

  const abort = new AbortController();
  let timedOut = false;
  const timer = setTimeout(
    () => {
      timedOut = true;
      abort.abort();
    },
    opts.mutation ? MUTATION_MS : READ_MS,
  );
  const cancel = () => abort.abort();
  opts.signal?.addEventListener("abort", cancel);
  if (opts.signal?.aborted) abort.abort();
  try {
    const res = await post(`${env.supabaseUrl}/functions/v1/${name}?forceFunctionRegion=us-west-2`, {
      method: "POST",
      headers: {
        apikey: env.supabaseKey,
        Authorization: `Bearer ${token.kind === "member" ? token.token : env.supabaseKey}`,
        "Content-Type": "application/json",
        "x-mesita-contract": String(CONTRACT),
      },
      body: JSON.stringify(body),
      signal: abort.signal,
    });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      // Not JSON: classified by its status below.
    }
    return { status: res.status, requestId: res.headers.get("sb-request-id"), json };
  } catch (err) {
    if (opts.signal?.aborted && !timedOut) throw err;
    throw timedOut
      ? fail("timeout", "Mesita took too long to answer.")
      : fail("network", "No connection.");
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener("abort", cancel);
  }
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export async function callEdge<S extends z.ZodType>(
  name: `consumer-web-${string}`,
  body: Record<string, unknown>,
  schema: S,
  opts: CallOptions = {},
): Promise<z.infer<S>> {
  let token = await currentToken();
  // Nothing was sent, so nothing can have happened.
  const unreachable = () =>
    new EdgeError({
      fn: name,
      kind: "network",
      retry: "safe",
      code: "network",
      status: null,
      message: "No connection.",
      body: {},
      requestId: null,
    });
  if (token.kind === "unreachable") throw unreachable();

  let answer = await send(name, body, token, opts);

  // A 401 is answered before any work, so a mutation may be sent again.
  if (answer.status === 401 && token.kind === "member") {
    token = await refreshToken();
    if (token.kind === "unreachable") throw unreachable();
    if (token.kind === "anonymous") {
      emit({ code: "session" });
    } else {
      answer = await send(name, body, token, opts);
      if (answer.status === 401 && isSessionCode(answer.json)) emit({ code: "session" });
    }
  }

  return read(name, answer, schema, opts);
}

function isSessionCode(json: unknown): boolean {
  return isObject(json) && json.ok === false && (json.code === "sign_in" || json.code === "session_invalid");
}

function emit(refusal: Refusal) {
  listeners.forEach((listen) => listen(refusal));
}

function read<S extends z.ZodType>(name: string, answer: Answer, schema: S, opts: CallOptions): z.infer<S> {
  const { status, requestId, json } = answer;
  const envelope = isObject(json) && typeof json.ok === "boolean" ? json : null;
  const lost: EdgeRetry = opts.mutation ? "reconcile-first" : "safe";
  const make = (
    kind: EdgeErrorKind,
    retry: EdgeRetry,
    code: string,
    message: string,
    extra: Record<string, unknown> = {},
  ) => new EdgeError({ fn: name, kind, retry, code, status, message, body: extra, requestId });

  if (status >= 500) {
    const sentence = typeof envelope?.error === "string" ? envelope.error : "Mesita could not answer.";
    const code = typeof envelope?.code === "string" ? envelope.code : `http_${status}`;
    const error = make("server", lost, code, sentence);
    report(error);
    throw error;
  }

  if (!envelope || (status >= 400 && envelope.ok)) {
    if (status < 400) throw unreadable(make, lost, ["(answer)"]);
    // A gateway's own answer: nothing of ours ran.
    throw make("refusal", status === 429 ? "safe" : "after-fix", `http_${status}`, "Mesita could not answer.");
  }

  if (!envelope.ok) {
    const { ok: _ok, code: rawCode, error: rawError, ...extra } = envelope;
    const code = typeof rawCode === "string" ? rawCode : `http_${status}`;
    const message = typeof rawError === "string" ? rawError : "Something went wrong.";
    if (code === "update_app") emit({ code });
    if (code === "suspended") emit({ code, message });
    const retry: EdgeRetry = code === "update_app" || code === "suspended" ? "never" : "after-fix";
    throw make("refusal", retry, code, message, extra);
  }

  const parsed = schema.safeParse(envelope);
  if (parsed.success) return parsed.data;
  throw unreadable(make, lost, [...new Set(parsed.error.issues.map((i) => i.path.join(".") || "(answer)"))]);
}

/** Says which keys failed and never their values. */
function unreadable(
  make: (kind: EdgeErrorKind, retry: EdgeRetry, code: string, message: string, extra?: Record<string, unknown>) => EdgeError,
  retry: EdgeRetry,
  keys: string[],
): EdgeError {
  const error = make("unreadable", retry, "unreadable_answer", "Mesita's answer could not be read.", { keys });
  report(error, { keys: keys.join(" ") });
  return error;
}
