import * as Sentry from "@sentry/react-native";

import { CONTRACT, updateId, variant } from "@/lib/build";
import { env } from "@/lib/env";

// Crash reports are built from an allowlist, so a phone number, a name, a
// session, a pay code, a gift or join token or a Stripe secret cannot be in
// one: an event is rebuilt here from the fields below and nothing else.

type Frame = { filename?: string; function?: string; module?: string; lineno?: number; colno?: number; in_app?: boolean };
type Exception = { type?: string; value?: string; mechanism?: unknown; stacktrace?: { frames?: Frame[] } };

const TAGS = ["fn", "kind", "code", "status", "request_id", "contract", "update", "variant", "route", "keys", "name"];
const SAFE = /^[\w .:/[\]()-]{1,200}$/;

/** A route's pattern, never its path: every dynamic segment is in brackets. */
export function routePattern(segments: readonly string[]): string {
  return `/${segments.join("/")}`;
}

type Event = Parameters<NonNullable<Sentry.ReactNativeOptions["beforeSend"]>>[0];

export function scrub(event: Event): Event {
  const tags = Object.fromEntries(
    Object.entries(event.tags ?? {}).filter(([name, value]) => TAGS.includes(name) && SAFE.test(String(value))),
  );
  return {
    type: event.type,
    event_id: event.event_id,
    timestamp: event.timestamp,
    platform: event.platform,
    level: event.level,
    release: event.release,
    dist: event.dist,
    environment: event.environment,
    sdk: event.sdk,
    tags,
    // The message can quote anything, so only the error's type is kept.
    exception: {
      values: ((event.exception?.values ?? []) as Exception[]).map((e) => ({
        type: e.type,
        value: "",
        mechanism: { type: "generic", handled: false },
        stacktrace: {
          frames: (e.stacktrace?.frames ?? []).map(({ filename, function: fn, module, lineno, colno, in_app }) => ({
            filename: filename?.split("?")[0],
            function: fn,
            module,
            lineno,
            colno,
            in_app,
          })),
        },
      })),
    },
    contexts: {
      os: pick(event.contexts?.os, ["name", "version"]),
      device: pick(event.contexts?.device, ["family", "model", "arch"]),
    },
    debug_meta: event.debug_meta,
  } as Event;
}

function pick(from: object | undefined, names: string[]) {
  return Object.fromEntries(Object.entries(from ?? {}).filter(([name]) => names.includes(name)));
}

export function startReporting() {
  if (!env.sentryDsn) return;
  Sentry.init({
    dsn: env.sentryDsn,
    environment: variant,
    sendDefaultPii: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
    enableCaptureFailedRequests: false,
    enableAutoSessionTracking: false,
    tracesSampleRate: 0,
    maxBreadcrumbs: 0,
    beforeBreadcrumb: () => null,
    beforeSend: scrub,
    initialScope: { tags: { contract: String(CONTRACT), update: updateId, variant } },
  });
}

type EdgeShape = { fn: string; kind: string; code: string; status: number | null; requestId: string | null };

function isEdge(err: unknown): err is EdgeShape {
  return err instanceof Error && err.name === "EdgeError";
}

/** Report an error, with the tags of a failed call when it is one. */
export function report(err: unknown, tags: Record<string, string> = {}) {
  if (!env.sentryDsn) return;
  const edge = isEdge(err)
    ? { fn: err.fn, kind: err.kind, code: err.code, status: String(err.status), request_id: String(err.requestId) }
    : {};
  Sentry.captureException(err, { tags: { ...edge, ...tags } });
}
