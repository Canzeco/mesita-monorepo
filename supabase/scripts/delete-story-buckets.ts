// One-off (MESITA-4642): empty and delete the Story storage buckets,
// story-emulator and story-media, through the Storage API (never SQL on
// storage.objects: the API removes the files themselves).
//
//   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=… \
//     deno run --allow-net --allow-env=SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY \
//     supabase/scripts/delete-story-buckets.ts
//
// Idempotent: a bucket already gone is skipped, and a run cut halfway is
// finished by the next one. Each pass lists up to PAGE files (walking the
// folders), deletes them, and repeats until the bucket lists nothing; then
// the bucket is deleted. It ends by reading both buckets back and fails
// unless neither exists. The key is never printed. Any failure prints
// `bucket path status` on stderr and exits 1.

const BUCKETS = ["story-emulator", "story-media"] as const;
const PAGE = 1000;
const DELETE_CHUNK = 100;
const MAX_PASSES = 10_000;

class StorageFailure extends Error {
  constructor(readonly bucket: string, readonly path: string, readonly status: number | string, detail: string) {
    super(detail);
  }
}

function env(name: string): string {
  const v = Deno.env.get(name)?.trim();
  if (!v) {
    console.error(`- ${name} missing`);
    Deno.exit(1);
  }
  return v;
}

const base = env("SUPABASE_URL").replace(/\/+$/, "");
const key = env("SUPABASE_SERVICE_ROLE_KEY");
const headers = { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": "application/json" };

async function call(bucket: string, path: string, method: string, url: string, body?: unknown): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${base}/storage/v1${url}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch (e) {
    throw new StorageFailure(bucket, path, "network", e instanceof Error ? e.message : String(e));
  }
  return res;
}

/** Storage answers a missing bucket with 404, or 400 and a "not found" body. */
async function isMissing(res: Response): Promise<boolean> {
  if (res.status === 404) return true;
  if (res.status !== 400) return false;
  const text = await res.clone().text();
  return /not.?found/i.test(text);
}

async function bucketExists(bucket: string): Promise<boolean> {
  const res = await call(bucket, "-", "GET", `/bucket/${encodeURIComponent(bucket)}`);
  if (res.ok) {
    await res.body?.cancel();
    return true;
  }
  if (await isMissing(res)) {
    await res.body?.cancel();
    return false;
  }
  throw new StorageFailure(bucket, "-", res.status, (await res.text()).slice(0, 200));
}

type Entry = { name: string; id: string | null };

/** Up to `cap` file paths in the bucket, walking folders (entries with no id). */
async function listFiles(bucket: string, cap: number): Promise<string[]> {
  const files: string[] = [];
  const folders = [""];
  while (folders.length > 0 && files.length < cap) {
    const prefix = folders.shift()!;
    for (let offset = 0; files.length < cap; offset += PAGE) {
      const res = await call(bucket, prefix || "/", "POST", `/object/list/${encodeURIComponent(bucket)}`, {
        prefix,
        limit: PAGE,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (!res.ok) throw new StorageFailure(bucket, prefix || "/", res.status, (await res.text()).slice(0, 200));
      const page = (await res.json()) as Entry[];
      for (const e of page) {
        const path = prefix ? `${prefix}/${e.name}` : e.name;
        if (e.id === null) folders.push(path);
        else files.push(path);
      }
      if (page.length < PAGE) break;
    }
  }
  return files.slice(0, cap);
}

async function removeFiles(bucket: string, paths: string[]): Promise<void> {
  for (let i = 0; i < paths.length; i += DELETE_CHUNK) {
    const chunk = paths.slice(i, i + DELETE_CHUNK);
    const res = await call(bucket, chunk[0], "DELETE", `/object/${encodeURIComponent(bucket)}`, { prefixes: chunk });
    if (!res.ok) throw new StorageFailure(bucket, chunk[0], res.status, (await res.text()).slice(0, 200));
    const removed = (await res.json()) as unknown[];
    if (!Array.isArray(removed) || removed.length === 0) {
      throw new StorageFailure(bucket, chunk[0], res.status, "delete removed nothing");
    }
  }
}

async function dropBucket(bucket: string): Promise<void> {
  if (!(await bucketExists(bucket))) {
    console.log(`${bucket}: already gone`);
    return;
  }
  let removed = 0;
  for (let pass = 0; ; pass++) {
    if (pass >= MAX_PASSES) throw new StorageFailure(bucket, "/", "loop", `still not empty after ${MAX_PASSES} passes`);
    const files = await listFiles(bucket, PAGE);
    if (files.length === 0) break;
    await removeFiles(bucket, files);
    removed += files.length;
    console.log(`${bucket}: removed ${removed} files so far`);
  }
  const res = await call(bucket, "-", "DELETE", `/bucket/${encodeURIComponent(bucket)}`);
  if (!res.ok && !(await isMissing(res))) {
    throw new StorageFailure(bucket, "-", res.status, (await res.text()).slice(0, 200));
  }
  await res.body?.cancel();
  console.log(`${bucket}: deleted (${removed} files removed)`);
}

try {
  for (const bucket of BUCKETS) await dropBucket(bucket);
  const left: string[] = [];
  for (const bucket of BUCKETS) if (await bucketExists(bucket)) left.push(bucket);
  if (left.length > 0) {
    for (const bucket of left) console.error(`${bucket} - still_exists`);
    Deno.exit(1);
  }
  console.log(`verified: ${BUCKETS.join(" and ")} do not exist`);
} catch (e) {
  if (e instanceof StorageFailure) console.error(`${e.bucket} ${e.path} ${e.status}: ${e.message}`);
  else console.error(`- - error: ${e instanceof Error ? e.message : String(e)}`);
  Deno.exit(1);
}
