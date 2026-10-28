// MESITA-2855 — Boost's money writes: a backing row never disagrees with
// Stripe after start, cancel or account deletion, and a failed write never
// reads as success. Stripe and the admin client are stubbed (unit only).

import { assertEquals } from "jsr:@std/assert@1";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  type BoostStart,
  cancelBackingAtPeriodEnd,
  cancelConsumerBackings,
  openBackingCheckout,
  type StripeCall,
} from "./boost.ts";

type Op = "update" | "delete" | "select";
type Result = { data?: unknown; error: { message: string } | null };

/** A place_backings stand-in: every awaited chain pops the next scripted
 *  result for its op (or succeeds empty) and is logged. */
function fakeAdmin(script: Partial<Record<Op, Result[]>>) {
  const log: Op[] = [];
  const next = (op: Op): Result => script[op]?.shift() ?? { data: null, error: null };
  const chain = (op: Op) => {
    const c: Record<string, unknown> = {};
    for (const m of ["eq", "not", "in", "select"]) c[m] = () => c;
    c.maybeSingle = () => Promise.resolve((log.push(op), next(op)));
    c.then = (res: (r: Result) => unknown, rej: (e: unknown) => unknown) =>
      Promise.resolve((log.push(op), next(op))).then(res, rej);
    return c;
  };
  const admin = {
    from: () => ({
      update: () => chain("update"),
      delete: () => chain("delete"),
      select: () => chain("select"),
    }),
  } as unknown as SupabaseClient;
  return { admin, log };
}

/** A Stripe stand-in answering by `METHOD path`; a function answer runs. */
function fakeStripe(answers: Record<string, unknown>) {
  const calls: string[] = [];
  const stripe: StripeCall = (method, path) => {
    const key = `${method} ${path}`;
    calls.push(key);
    const a = answers[key];
    if (a instanceof Error) return Promise.reject(a);
    return Promise.resolve((a ?? {}) as Record<string, unknown>);
  };
  return { stripe, calls };
}

const START: BoostStart = {
  placeId: "11111111-1111-4111-8111-111111111111",
  tier: "boost_2x",
  interval: "month",
  returnUrl: "https://mesita.ai/web/place/x",
} as BoostStart;
const CTX = { backingId: "b-1", consumerId: "c-1", placeName: "Cafe" };
const SESSION = { id: "cs_1", url: "https://checkout.stripe.com/cs_1", livemode: false };
const FAIL = { error: { message: "db down" } };

Deno.test("start-boost: a session-id write that fails twice expires the session, deletes the row, sends no url", async () => {
  const { admin, log } = fakeAdmin({
    update: [FAIL, FAIL],
    select: [{ data: { stripe_checkout_session_id: null }, error: null }],
  });
  const { stripe, calls } = fakeStripe({ "POST checkout/sessions": SESSION });
  const reply = await openBackingCheckout(admin, stripe, START, CTX);
  assertEquals(reply.status, 502);
  assertEquals("url" in reply.body, false);
  assertEquals(calls, ["POST checkout/sessions", "POST checkout/sessions/cs_1/expire"]);
  assertEquals(log, ["update", "update", "select", "delete"]);
});

Deno.test("start-boost: a write that failed but landed (re-read shows the session) opens checkout", async () => {
  const { admin, log } = fakeAdmin({
    update: [FAIL, FAIL],
    select: [{ data: { stripe_checkout_session_id: "cs_1" }, error: null }],
  });
  const { stripe, calls } = fakeStripe({ "POST checkout/sessions": SESSION });
  const reply = await openBackingCheckout(admin, stripe, START, CTX);
  assertEquals(reply.status, 200);
  assertEquals(reply.body.url, SESSION.url);
  assertEquals(calls, ["POST checkout/sessions"]);
  assertEquals(log.includes("delete"), false);
});

Deno.test("start-boost: a failed re-read counts as not landed; expire and delete still run", async () => {
  const { admin, log } = fakeAdmin({ update: [FAIL, FAIL], select: [FAIL], delete: [FAIL] });
  const { stripe, calls } = fakeStripe({
    "POST checkout/sessions": SESSION,
    "POST checkout/sessions/cs_1/expire": new Error("stripe down"),
  });
  const reply = await openBackingCheckout(admin, stripe, START, CTX);
  assertEquals(reply.status, 502);
  assertEquals("url" in reply.body, false);
  assertEquals(calls.at(-1), "POST checkout/sessions/cs_1/expire");
  assertEquals(log.at(-1), "delete");
});

Deno.test("start-boost: one failed write then a good retry opens checkout", async () => {
  const { admin, log } = fakeAdmin({ update: [FAIL] });
  const { stripe } = fakeStripe({ "POST checkout/sessions": SESSION });
  const reply = await openBackingCheckout(admin, stripe, START, CTX);
  assertEquals(reply.status, 200);
  assertEquals(reply.body.url, SESSION.url);
  assertEquals(log, ["update", "update"]);
});

const LIVE_ROW = { id: "b-1", stripe_subscription_id: "sub_1", status: "active" };

Deno.test("account deletion: a sub Stripe already ended is patched and counted", async () => {
  for (const status of ["canceled", "incomplete_expired"]) {
    const { admin, log } = fakeAdmin({ select: [{ data: [LIVE_ROW], error: null }] });
    const { stripe, calls } = fakeStripe({
      "DELETE subscriptions/sub_1": new Error("No such subscription"),
      "GET subscriptions/sub_1": { id: "sub_1", status },
    });
    const res = await cancelConsumerBackings(admin, "c-1", stripe);
    assertEquals(res, { ok: true, cancelled: 1 });
    assertEquals(calls, ["DELETE subscriptions/sub_1", "GET subscriptions/sub_1"]);
    assertEquals(log, ["select", "update"]);
  }
});

Deno.test("account deletion: a sub still live, or a lookup that fails, refuses", async () => {
  for (const get of [{ id: "sub_1", status: "active" }, new Error("stripe down")]) {
    const { admin, log } = fakeAdmin({ select: [{ data: [LIVE_ROW], error: null }] });
    const { stripe } = fakeStripe({
      "DELETE subscriptions/sub_1": new Error("boom"),
      "GET subscriptions/sub_1": get,
    });
    const res = await cancelConsumerBackings(admin, "c-1", stripe);
    assertEquals(res.ok, false);
    assertEquals(log, ["select"]);
  }
});

Deno.test("account deletion: a failed row write after Stripe cancelled refuses", async () => {
  const { admin } = fakeAdmin({ select: [{ data: [LIVE_ROW], error: null }], update: [FAIL] });
  const { stripe } = fakeStripe({ "DELETE subscriptions/sub_1": { id: "sub_1", status: "canceled" } });
  const res = await cancelConsumerBackings(admin, "c-1", stripe);
  assertEquals(res.ok, false);
  if (!res.ok) assertEquals(res.error.includes("backings_update"), true);
});

Deno.test("cancel-boost: a failed row write answers 500, never ok:true", async () => {
  const { admin } = fakeAdmin({ update: [FAIL] });
  const { stripe } = fakeStripe({ "POST subscriptions/sub_1": { id: "sub_1", status: "active" } });
  const reply = await cancelBackingAtPeriodEnd(admin, stripe, { id: "b-1", stripe_subscription_id: "sub_1" });
  assertEquals(reply.status, 500);
  assertEquals(reply.body.ok, false);
});
