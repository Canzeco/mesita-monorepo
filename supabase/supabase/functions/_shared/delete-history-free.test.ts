import { assert, assertEquals } from "jsr:@std/assert@1";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { validateConsumerPatch } from "./consumer-doc.ts";
import {
  accountDeletedResponse,
  consumerHasTransactionHistory,
  deleteConsumerAccount,
  HISTORY,
  isDeletedConsumer,
} from "./delete-history-free.ts";

Deno.test("validateConsumerPatch: accepts deleted_at ISO or null", () => {
  assert(validateConsumerPatch({ deleted_at: "2026-08-25T02:00:00.000Z" }).ok);
  assert(validateConsumerPatch({ deleted_at: null }).ok);
  assert(!validateConsumerPatch({ deleted_at: 1 }).ok);
});

function fakeHistoryAdmin(opts: {
  reservations: number;
  /** Rows per other history table. */
  rows?: Record<string, number>;
  readError?: string;
  patches?: Record<string, unknown>[];
  cleared?: string[];
  removed?: string[];
  updateError?: string;
  deleteUserError?: string;
}): SupabaseClient {
  const auth = {
    admin: {
      updateUserById: () => Promise.resolve({ data: { user: {} }, error: null }),
      deleteUser: () =>
        Promise.resolve({
          data: { user: {} },
          error: opts.deleteUserError ? { message: opts.deleteUserError } : null,
        }),
    },
  };
  return {
    from(table: string) {
      if (table === "reservation_tickets") {
        return {
          select: () => ({
            eq: () => Promise.resolve({ count: opts.reservations, error: null }),
          }),
        };
      }
      if (table === "consumers") {
        return {
          update: (patch: Record<string, unknown>) => ({
            eq: () => {
              opts.patches?.push(patch);
              return Promise.resolve({
                data: null,
                error: opts.updateError ? { message: opts.updateError } : null,
              });
            },
          }),
        };
      }
      if (["saved_locations", "consumer_calendar_feeds", "consumer_notifications"].includes(table)) {
        return {
          delete: () => ({
            eq: () => {
              opts.cleared?.push(table);
              return Promise.resolve({ error: null });
            },
          }),
        };
      }
      if (HISTORY.some(([t]) => t === table)) {
        return {
          update: (patch: Record<string, unknown>) => ({
            eq: () => {
              opts.patches?.push(patch);
              return Promise.resolve({ error: null });
            },
          }),
          select: () => ({
            eq: () =>
              Promise.resolve(
                opts.readError === table
                  ? { count: null, error: { message: "down" } }
                  : { count: opts.rows?.[table] ?? 0, error: null },
              ),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
    storage: {
      from: () => ({
        list: (prefix: string) => Promise.resolve({ data: [{ name: `${prefix}.jpg` }], error: null }),
        remove: (paths: string[]) => {
          opts.removed?.push(...paths);
          return Promise.resolve({ error: null });
        },
      }),
    },
    auth,
  } as unknown as SupabaseClient;
}

Deno.test("consumerHasTransactionHistory: reservations count as history", async () => {
  const res = await consumerHasTransactionHistory(
    fakeHistoryAdmin({ reservations: 1 }),
    "c1",
  );
  assert(res.ok);
  assertEquals(res.hasHistory, true);
});

Deno.test("consumerHasTransactionHistory: empty tickets is history-free", async () => {
  const res = await consumerHasTransactionHistory(
    fakeHistoryAdmin({ reservations: 0 }),
    "c1",
  );
  assert(res.ok);
  assertEquals(res.hasHistory, false);
});

Deno.test("deleteConsumerAccount: history-free hard-deletes auth", async () => {
  const res = await deleteConsumerAccount(
    fakeHistoryAdmin({ reservations: 0 }),
    "c1",
  );
  assert(res.ok);
  assertEquals(res.mode, "hard");
});

Deno.test("deleteConsumerAccount: history soft-deletes and never calls auth.deleteUser", async () => {
  let deleted = false;
  const admin = fakeHistoryAdmin({ reservations: 1 });
  (admin as unknown as { auth: { admin: { deleteUser: () => Promise<unknown> } } })
    .auth.admin.deleteUser =
    () => {
      deleted = true;
      return Promise.resolve({ data: { user: {} }, error: null });
    };
  const res = await deleteConsumerAccount(admin, "c1");
  assert(res.ok);
  assertEquals(res.mode, "soft");
  assertEquals(deleted, false);
});

Deno.test("isDeletedConsumer: only a non-empty deleted_at is closed", () => {
  assertEquals(isDeletedConsumer(null), false);
  assertEquals(isDeletedConsumer({ deleted_at: null }), false);
  assertEquals(isDeletedConsumer({ deleted_at: "" }), false);
  assertEquals(isDeletedConsumer({ deleted_at: "2026-08-25T02:45:00.000Z" }), true);
});

Deno.test("accountDeletedResponse: 410 with account_deleted", async () => {
  const res = accountDeletedResponse();
  assertEquals(res.status, 410);
  const body = await res.json();
  assertEquals(body.code, "account_deleted");
  assertEquals(body.ok, false);
});

Deno.test("consumer-web-delete-account never wipes tickets", async () => {
  const src = await Deno.readTextFile(
    new URL("../consumer-web-delete-account/index.ts", import.meta.url),
  );
  assert(src.includes("deleteConsumerAccount"));
  assert(!src.includes("writeTicket"));
});

Deno.test("every money table alone makes a close soft (MESITA-4921)", async () => {
  for (const [table] of HISTORY.filter(([t]) => t !== "reservation_tickets")) {
    const res = await deleteConsumerAccount(fakeHistoryAdmin({ reservations: 0, rows: { [table]: 1 } }), "c1");
    assert(res.ok, table);
    assertEquals(res.mode, "soft", table);
  }
});

Deno.test("a history read that fails deletes nothing", async () => {
  const patches: Record<string, unknown>[] = [];
  const removed: string[] = [];
  const admin = fakeHistoryAdmin({ reservations: 0, readError: "wallet_entries", patches, removed });
  (admin as unknown as { auth: { admin: { deleteUser: () => never } } }).auth.admin.deleteUser = () => {
    throw new Error("deleted on an unread table");
  };
  const res = await deleteConsumerAccount(admin, "c1");
  assertEquals(res.ok, false);
  assertEquals(patches, []);
  assertEquals(removed, []);
});

Deno.test("a soft close clears the person, their places and their photos", async () => {
  const patches: Record<string, unknown>[] = [];
  const cleared: string[] = [];
  const removed: string[] = [];
  const res = await deleteConsumerAccount(
    fakeHistoryAdmin({ reservations: 1, patches, cleared, removed }),
    "c1",
  );
  assert(res.ok);
  for (const k of ["full_name", "first_name", "last_name", "sex", "birthday", "birth_year", "avatar_url", "phone", "instagram_handle"]) {
    assertEquals(patches[0][k], null, k);
  }
  assertEquals(cleared, ["saved_locations", "consumer_calendar_feeds", "consumer_notifications"]);
  assertEquals(removed, ["c1/c1.jpg"]);
});
