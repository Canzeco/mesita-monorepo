// _shared/create-quota.test.ts
//
// Guard test 5, create-quota concurrency (MESITA-1247). Mocks
// place_creation_attempts against consumeConsumerCreateQuota's real
// algorithm — insert-then-count-then-maybe-delete (create-quota.ts, read in
// full). The file's own header claims parallel bursts are "self-limiting"
// because "each request in an N-wide burst sees the whole burst" — that
// claim is stronger than what insert-then-count actually guarantees under
// Postgres READ COMMITTED semantics for a truly simultaneous flood.
//
// REVIEW FINDING, fixed by rescoping rather than by a cleverer mock
// (MESITA-1247): an earlier version of this file had a test named
// "concurrent burst: the cap is never EXCEEDED", built on `Promise.all` over
// this same in-memory mock, asserting that claim. It was provably unable to
// exercise the property its name claimed. Why: this mock's `insert()` writes
// to `store` SYNCHRONOUSLY, inside the promise executor, before the first
// `await` in consumeConsumerCreateQuota ever suspends. `Array.from({length:
// N}, fn)` inside `Promise.all` invokes all N calls synchronously up to
// their first `await` — so all N inserts land in `store` before ANY call's
// `count()` runs. Every call then sees the SAME final count. There is no JS
// microtask reordering that changes this: with a synchronous, single
// shared-array mock, "N calls via Promise.all" and "N calls sequentially"
// are the same trace. Proven, not asserted: instrumenting the old test
// printed 0 successes of 25 on every run (every call saw the full 25 and
// rejected) — the exact degenerate case the reviewer identified, and the
// reason `successes <= 20` passed regardless of whether the underlying
// algorithm's window check was broken.
//
// The REAL race the header comment gestures at — two genuinely concurrent
// Postgres connections each committing an INSERT and then reading a COUNT
// whose MVCC snapshot was taken before the other's commit — has no
// faithful analog in a single-threaded interpreter: JS never gives two
// calls a mutually-exclusive view of shared state the way two DB
// transactions can. Modeling that honestly would mean re-implementing
// snapshot isolation in the mock (each call gets its own frozen view of
// `store`, current as of some deliberately-earlier point) — a materially
// different, higher-stakes piece of test infrastructure than this guard
// suite's scope, and still wouldn't validate anything about the REAL
// algorithm (whose fix, if the race is judged worth closing, is a database
// change — an atomic constraint or advisory lock — not a test change).
//
// What stays: the three tests below that provably hold given the mock's
// real semantics (sequential exactly-20-of-25, rejected-attempt cleanup,
// per-consumer isolation) — including a `Promise.all` smoke test that
// concurrent JS invocation doesn't crash or corrupt the store, honestly
// scoped to what it can show.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { consumeConsumerCreateQuota } from "./create-quota.ts";

type Row = { id: string; consumer_id: string; created_at: string };

// deno-lint-ignore no-explicit-any
function makeFakeAdmin(store: Row[]): any {
  let n = 0;
  return {
    from(table: string) {
      if (table !== "place_creation_attempts") throw new Error(`unexpected table ${table}`);
      return {
        insert(row: { consumer_id: string }) {
          const created = { id: String(++n), consumer_id: row.consumer_id, created_at: new Date().toISOString() };
          return {
            select: () => ({
              single: () => {
                store.push(created);
                return Promise.resolve({ data: { id: created.id }, error: null });
              },
            }),
          };
        },
        select() {
          let consumerId: string | undefined;
          const builder = {
            eq(col: string, val: string) {
              if (col === "consumer_id") consumerId = val;
              return builder;
            },
            gte() {
              const count = store.filter((r) => r.consumer_id === consumerId).length;
              return Promise.resolve({ count, error: null });
            },
          };
          return builder;
        },
        delete() {
          return {
            eq(col: string, val: string) {
              const i = store.findIndex((r) => (r as Record<string, unknown>)[col] === val);
              if (i >= 0) store.splice(i, 1);
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  };
}

Deno.test("sequential bursts: exactly 20 of 25 succeed, cap holds", async () => {
  const store: Row[] = [];
  const admin = makeFakeAdmin(store);
  let successes = 0;
  for (let i = 0; i < 25; i++) {
    const r = await consumeConsumerCreateQuota(admin, "consumer-1", `place-${i}`, "test");
    if (r.ok) successes++;
  }
  assertEquals(successes, 20);
  assertEquals(store.length, 20); // rejected attempts cleaned up after themselves
});

Deno.test("a rejected attempt does not extend the window (net-zero row count)", async () => {
  const store: Row[] = [];
  const admin = makeFakeAdmin(store);
  for (let i = 0; i < 20; i++) await consumeConsumerCreateQuota(admin, "consumer-1", `place-${i}`, "test");
  const before = store.length;
  const r = await consumeConsumerCreateQuota(admin, "consumer-1", "place-reject", "test");
  assert(!r.ok);
  assertEquals(store.length, before);
});

Deno.test("Promise.all of 25 calls doesn't crash or corrupt the store (smoke test, not a concurrency proof — see file header)", async () => {
  const store: Row[] = [];
  const admin = makeFakeAdmin(store);
  const results = await Promise.all(
    Array.from({ length: 25 }, (_, i) => consumeConsumerCreateQuota(admin, "consumer-1", `place-${i}`, "test")),
  );
  // Given this mock's synchronous insert(), Promise.all here is provably
  // equivalent to the sequential loop above: every call's count() sees all
  // 25 rows regardless of submission order, so either every call rejects
  // (today: 0 successes, all read count=25 > cap=20) or, if a future change
  // ever widened the cap past 25, every call would succeed. What this DOES
  // prove: no crash, no store corruption, and the store's row count always
  // matches the number of calls that actually got an `ok: true` back —
  // i.e., no accounting drift under concurrent invocation.
  const successes = results.filter((r) => r.ok).length;
  assertEquals(successes, 0, "with 25 truly-simultaneous inserts landing before any count runs, every call sees count=25 > cap=20");
  assertEquals(store.length, successes, "every rejected attempt cleaned up its own row — no orphaned rows");
});

Deno.test("different consumers do not share a window", async () => {
  const store: Row[] = [];
  const admin = makeFakeAdmin(store);
  for (let i = 0; i < 20; i++) await consumeConsumerCreateQuota(admin, "consumer-A", `place-${i}`, "test");
  const r = await consumeConsumerCreateQuota(admin, "consumer-B", "place-first", "test");
  assert(r.ok);
});
