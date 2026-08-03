// Unit tests for the reset's storage purge. The drain loop is exercised
// against a fake client — no network, no DB.
//   deno test supabase/functions/_shared/storage-purge.test.ts

import { assertEquals } from "jsr:@std/assert@1";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  groupByBucket,
  purgeStorageObjects,
  type StoragePathRow,
} from "./storage-purge.ts";

Deno.test("groupByBucket: one remove() call per bucket, order preserved", () => {
  const grouped = groupByBucket([
    { bucket_id: "place-images", name: "images/a.jpg" },
    { bucket_id: "menu-pdfs", name: "menus/x.pdf" },
    { bucket_id: "place-images", name: "images/b.jpg" },
  ]);
  assertEquals([...grouped.keys()], ["place-images", "menu-pdfs"]);
  assertEquals(grouped.get("place-images"), ["images/a.jpg", "images/b.jpg"]);
  assertEquals(grouped.get("menu-pdfs"), ["menus/x.pdf"]);
});

Deno.test("groupByBucket: skips malformed rows instead of removing ''", () => {
  const grouped = groupByBucket([
    { bucket_id: "place-images", name: "images/a.jpg" },
    { bucket_id: "", name: "images/b.jpg" },
    { bucket_id: "place-images", name: "" },
  ] as StoragePathRow[]);
  assertEquals(grouped.size, 1);
  assertEquals(grouped.get("place-images"), ["images/a.jpg"]);
});

// A fake that behaves like storage does: rpc() reports what is still there,
// remove() takes it away.
function fakeClient(objects: StoragePathRow[], opts: {
  removeFails?: boolean;
  rpcError?: string;
} = {}) {
  let live = [...objects];
  const calls = { rpc: 0, remove: 0 };
  const client = {
    rpc(_fn: string, args: { p_limit: number; p_keep_buckets: string[] }) {
      calls.rpc++;
      if (opts.rpcError) {
        return Promise.resolve({
          data: null,
          error: { message: opts.rpcError },
        });
      }
      const visible = live
        .filter((o) => !args.p_keep_buckets.includes(o.bucket_id))
        .slice(0, args.p_limit);
      return Promise.resolve({ data: visible, error: null });
    },
    storage: {
      from(bucket: string) {
        return {
          remove(paths: string[]) {
            calls.remove++;
            if (opts.removeFails) {
              return Promise.resolve({
                data: null,
                error: { message: "boom" },
              });
            }
            const gone = live.filter(
              (o) => o.bucket_id === bucket && paths.includes(o.name),
            );
            live = live.filter((o) => !gone.includes(o));
            return Promise.resolve({ data: gone, error: null });
          },
        };
      },
    },
  };
  return {
    client: client as unknown as SupabaseClient,
    calls,
    live: () => live,
  };
}

Deno.test("purgeStorageObjects: drains every bucket across batches", async () => {
  // 450 objects > the 200-per-batch page: the loop must come back for more.
  const objects: StoragePathRow[] = [
    ...Array.from({ length: 450 }, (_, i) => ({
      bucket_id: "place-images",
      name: `images/${i}.jpg`,
    })),
    { bucket_id: "menu-pdfs", name: "menus/x.pdf" },
  ];
  const { client, live } = fakeClient(objects);

  const res = await purgeStorageObjects(client);

  assertEquals(res, { purged: 451, error: null });
  assertEquals(live().length, 0);
});

Deno.test("purgeStorageObjects: an empty bucket set is a no-op, not an error", async () => {
  const { client, calls } = fakeClient([]);
  assertEquals(await purgeStorageObjects(client), { purged: 0, error: null });
  assertEquals(calls.remove, 0);
});

Deno.test("purgeStorageObjects: preserved buckets survive", async () => {
  const { client, live } = fakeClient([
    { bucket_id: "place-images", name: "images/a.jpg" },
    { bucket_id: "brand", name: "logo.svg" },
  ]);

  const res = await purgeStorageObjects(client, ["brand"]);

  assertEquals(res, { purged: 1, error: null });
  assertEquals(live(), [{ bucket_id: "brand", name: "logo.svg" }]);
});

Deno.test("purgeStorageObjects: a failing remove stalls out instead of looping", async () => {
  const { client, calls } = fakeClient(
    [{ bucket_id: "place-images", name: "images/a.jpg" }],
    { removeFails: true },
  );

  const res = await purgeStorageObjects(client);

  assertEquals(res.purged, 0);
  assertEquals(res.error, "remove(place-images): boom");
  // Two RPC pages would mean it went back for the same undeletable object.
  assertEquals(calls.rpc, 1);
});

Deno.test("purgeStorageObjects: reports a lister failure without throwing", async () => {
  const { client } = fakeClient([], { rpcError: "permission denied" });
  assertEquals(await purgeStorageObjects(client), {
    purged: 0,
    error: "list_objects: permission denied",
  });
});
