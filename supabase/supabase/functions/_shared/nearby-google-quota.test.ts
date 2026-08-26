// _shared/nearby-google-quota.test.ts
//
// Mocks nearby_google_attempts against consumeNearbyGoogleQuota's real
// insert-then-count-then-maybe-delete. Same mock caveat as create-quota.test.ts:
// a synchronous in-memory store cannot prove Postgres snapshot isolation.
import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  consumeNearbyGoogleQuota,
  GOOGLE_NEARBY_GLOBAL_MAX,
  GOOGLE_NEARBY_IP_MAX,
} from "./nearby-google-quota.ts";

type Row = { id: string; ip_hash: string; created_at: string };

// deno-lint-ignore no-explicit-any
function makeFakeAdmin(store: Row[]): any {
  let n = 0;
  return {
    from(table: string) {
      if (table !== "nearby_google_attempts") {
        throw new Error(`unexpected table ${table}`);
      }
      return {
        insert(row: { ip_hash: string }) {
          const created = {
            id: String(++n),
            ip_hash: row.ip_hash,
            created_at: new Date().toISOString(),
          };
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
          let ipHash: string | undefined;
          let scoped = false;
          const builder = {
            eq(col: string, val: string) {
              if (col === "ip_hash") {
                ipHash = val;
                scoped = true;
              }
              return builder;
            },
            gte() {
              const count = scoped
                ? store.filter((r) => r.ip_hash === ipHash).length
                : store.length;
              return Promise.resolve({ count, error: null });
            },
          };
          return builder;
        },
        delete() {
          return {
            eq(col: string, val: string) {
              const i = store.findIndex((r) =>
                (r as Record<string, unknown>)[col] === val
              );
              if (i >= 0) store.splice(i, 1);
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  };
}

Deno.test("sequential bursts: exactly the cap succeed, extras skip Google", async () => {
  const store: Row[] = [];
  const admin = makeFakeAdmin(store);
  let allowed = 0;
  for (let i = 0; i < GOOGLE_NEARBY_IP_MAX + 5; i++) {
    const r = await consumeNearbyGoogleQuota(admin, "ip-a");
    if (r.allow) allowed++;
  }
  assertEquals(allowed, GOOGLE_NEARBY_IP_MAX);
  assertEquals(store.length, GOOGLE_NEARBY_IP_MAX);
});

Deno.test("a rejected attempt does not extend the window", async () => {
  const store: Row[] = [];
  const admin = makeFakeAdmin(store);
  for (let i = 0; i < GOOGLE_NEARBY_IP_MAX; i++) {
    await consumeNearbyGoogleQuota(admin, "ip-a");
  }
  const before = store.length;
  const r = await consumeNearbyGoogleQuota(admin, "ip-a");
  assert(!r.allow);
  assertEquals(store.length, before);
});

Deno.test("different IPs do not share a window", async () => {
  const store: Row[] = [];
  const admin = makeFakeAdmin(store);
  for (let i = 0; i < GOOGLE_NEARBY_IP_MAX; i++) {
    await consumeNearbyGoogleQuota(admin, "ip-a");
  }
  const r = await consumeNearbyGoogleQuota(admin, "ip-b");
  assert(r.allow);
});

Deno.test("missing IP hash skips Google and writes nothing", async () => {
  const store: Row[] = [];
  const admin = makeFakeAdmin(store);
  const r = await consumeNearbyGoogleQuota(admin, null);
  assert(!r.allow);
  assertEquals(store.length, 0);
});

Deno.test("global window cap binds unique-hash spray", async () => {
  const store: Row[] = [];
  const admin = makeFakeAdmin(store);
  let allowed = 0;
  for (let i = 0; i < GOOGLE_NEARBY_GLOBAL_MAX + 5; i++) {
    const r = await consumeNearbyGoogleQuota(admin, `ip-${i}`);
    if (r.allow) allowed++;
  }
  assertEquals(allowed, GOOGLE_NEARBY_GLOBAL_MAX);
  assertEquals(store.length, GOOGLE_NEARBY_GLOBAL_MAX);
});
