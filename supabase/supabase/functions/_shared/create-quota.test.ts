// _shared/create-quota.test.ts
//
// Guard test 5, create-quota concurrency (MESITA-1247). Mocks
// place_creation_attempts against consumeConsumerCreateQuota's real
// algorithm — insert-then-count-then-maybe-delete (create-quota.ts, read in
// full). The file's own header claims parallel bursts are "self-limiting"
// because "each request in an N-wide burst sees the whole burst" — that
// claim is stronger than what insert-then-count actually guarantees under
// Postgres READ COMMITTED semantics for a truly simultaneous flood. This
// test pins what's provably true of the algorithm (the cap is never
// EXCEEDED), not the stronger claim in the comment — it does not "fix" the
// algorithm, that would be a separate behavior change requiring its own
// review.
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

Deno.test("concurrent burst: the cap is never EXCEEDED (split may vary with interleaving)", async () => {
  const store: Row[] = [];
  const admin = makeFakeAdmin(store);
  const results = await Promise.all(
    Array.from({ length: 25 }, (_, i) => consumeConsumerCreateQuota(admin, "consumer-1", `place-${i}`, "test")),
  );
  const successes = results.filter((r) => r.ok).length;
  assert(successes <= 20, `cap exceeded: ${successes}/25 succeeded concurrently`);
  assertEquals(store.length, successes);
});

Deno.test("different consumers do not share a window", async () => {
  const store: Row[] = [];
  const admin = makeFakeAdmin(store);
  for (let i = 0; i < 20; i++) await consumeConsumerCreateQuota(admin, "consumer-A", `place-${i}`, "test");
  const r = await consumeConsumerCreateQuota(admin, "consumer-B", "place-first", "test");
  assert(r.ok);
});
