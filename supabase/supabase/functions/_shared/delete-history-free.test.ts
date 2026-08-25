import { assert, assertEquals } from "jsr:@std/assert@1";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { validateConsumerPatch } from "./consumer-doc.ts";
import {
  accountDeletedResponse,
  consumerHasTransactionHistory,
  deleteConsumerAccount,
  isDeletedConsumer,
  rejectDeletedConsumer,
} from "./delete-history-free.ts";

Deno.test("validateConsumerPatch: accepts deleted_at ISO or null", () => {
  assert(validateConsumerPatch({ deleted_at: "2026-08-25T02:00:00.000Z" }).ok);
  assert(validateConsumerPatch({ deleted_at: null }).ok);
  assert(!validateConsumerPatch({ deleted_at: 1 }).ok);
});

function fakeHistoryAdmin(opts: {
  visit: number;
  reservations: number;
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
      if (table === "visit_tickets" || table === "reservation_tickets") {
        const n = table === "visit_tickets" ? opts.visit : opts.reservations;
        return {
          select: () => ({
            eq: () => Promise.resolve({ count: n, error: null }),
          }),
        };
      }
      if (table === "consumers") {
        return {
          update: () => ({
            eq: () =>
              Promise.resolve({
                data: null,
                error: opts.updateError ? { message: opts.updateError } : null,
              }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
    auth,
  } as unknown as SupabaseClient;
}

Deno.test("consumerHasTransactionHistory: visits count as history", async () => {
  const res = await consumerHasTransactionHistory(
    fakeHistoryAdmin({ visit: 2, reservations: 0 }),
    "c1",
  );
  assert(res.ok);
  assertEquals(res.hasHistory, true);
});

Deno.test("consumerHasTransactionHistory: reservations count as history", async () => {
  const res = await consumerHasTransactionHistory(
    fakeHistoryAdmin({ visit: 0, reservations: 1 }),
    "c1",
  );
  assert(res.ok);
  assertEquals(res.hasHistory, true);
});

Deno.test("consumerHasTransactionHistory: empty tickets is history-free", async () => {
  const res = await consumerHasTransactionHistory(
    fakeHistoryAdmin({ visit: 0, reservations: 0 }),
    "c1",
  );
  assert(res.ok);
  assertEquals(res.hasHistory, false);
});

Deno.test("deleteConsumerAccount: history-free hard-deletes auth", async () => {
  const res = await deleteConsumerAccount(
    fakeHistoryAdmin({ visit: 0, reservations: 0 }),
    "c1",
  );
  assert(res.ok);
  assertEquals(res.mode, "hard");
});

Deno.test("deleteConsumerAccount: history soft-deletes and never calls auth.deleteUser", async () => {
  let deleted = false;
  const admin = fakeHistoryAdmin({ visit: 1, reservations: 0 });
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

Deno.test("rejectDeletedConsumer: 410 when deleted_at is set", async () => {
  const admin = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({
              data: { deleted_at: "2026-08-25T02:45:00.000Z" },
              error: null,
            }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;
  const res = await rejectDeletedConsumer(admin, "c1");
  assert(res);
  assertEquals(res.status, 410);
});

Deno.test("rejectDeletedConsumer: null when the account is live", async () => {
  const admin = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({ data: { deleted_at: null }, error: null }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;
  assertEquals(await rejectDeletedConsumer(admin, "c1"), null);
});

Deno.test("consumer-web-delete-account never wipes tickets", async () => {
  const src = await Deno.readTextFile(
    new URL("../consumer-web-delete-account/index.ts", import.meta.url),
  );
  assert(src.includes("deleteConsumerAccount"));
  assert(!src.includes("writeTicket"));
});
