// MESITA-3462: staff identity on visit.mesita.ai. Money and privacy: a read
// without staff access must never list a place's payments; a token must not
// open another place, outlive 12 hours, or survive the owner changing the
// code; a wrong code must count toward the waiter's charge lock.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { hashPlaceCode } from "./place-code.ts";
import type { TryKind } from "./charge.ts";
import { checkStaffToken, listPayments, makeStaffQr, mintStaffToken, readListBody, readStaffToken, staffAccess, staffDeviceHash, type StaffPaymentRow, type StaffStore, STAFF_TOKEN_TTL_SEC } from "./staff.ts";

const PLACE = "00000000-0000-4000-8000-000000003462";
const OTHER = "00000000-0000-4000-8000-000000004462";
const KEY = "service-role-key-for-tests";
const ADDR = "addr-hmac";
const T0 = Date.parse("2026-11-09T20:00:00Z");

async function memoryStore(codes: Record<string, string>) {
  const hashes = new Map<string, string>();
  for (const [p, c] of Object.entries(codes)) hashes.set(p, await hashPlaceCode(p, c));
  const qrs = new Map<string, string>();
  const qrUsed = new Map<string, string>();
  const tries: Array<{ place_id: string; kind: TryKind; key: string; at: string }> = [];
  const rows: Array<StaffPaymentRow & { place_id: string; livemode: boolean }> = [];
  const clock = { ms: T0 };
  const store: StaffStore = {
    keys: (p) => Promise.resolve(hashes.has(p) ? { codeHash: hashes.get(p)!, staffQr: qrs.get(p) ?? null } : null),
    staffQrUsed(p, at) {
      qrUsed.set(p, at);
      return Promise.resolve();
    },
    tries: (p, kind, key, since, limit) =>
      Promise.resolve(
        tries
          .filter((t) => t.place_id === p && t.kind === kind && (!key || t.key === key) && t.at >= since)
          .map((t) => t.at)
          .sort()
          .reverse()
          .slice(0, limit),
      ),
    addTry(p, kind, key) {
      tries.push({ place_id: p, kind, key, at: new Date(clock.ms).toISOString() });
      return Promise.resolve();
    },
    payments: (p, since, livemode, limit) =>
      Promise.resolve(
        rows
          .filter((r) => r.place_id === p && r.livemode === livemode && (r.paid_at ?? "") >= since)
          .sort((a, b) => (b.paid_at ?? "").localeCompare(a.paid_at ?? ""))
          .slice(0, limit),
      ),
  };
  return { store, hashes, qrs, qrUsed, tries, rows, clock };
}

function access(store: StaffStore, body: Record<string, unknown>, nowMs = T0) {
  const parsed = readListBody(body);
  if (!parsed.ok) throw new Error(parsed.error);
  return staffAccess(store, { input: parsed.input, serviceKey: KEY, staffKey: ADDR, nowMs });
}

Deno.test("a read without staff access is refused 403 staff_only", async () => {
  const { store } = await memoryStore({ [PLACE]: "123456" });
  const none = await access(store, { place_id: PLACE });
  assert(!none.ok);
  assertEquals([none.status, none.code], [403, "staff_only"]);
  const wrong = await access(store, { place_id: PLACE, place_code: "654321" });
  assert(!wrong.ok);
  assertEquals([wrong.status, wrong.code], [403, "staff_only"]);
  const forged = await access(store, { place_id: PLACE, staff_token: `s1.${Math.floor(T0 / 1000) + 60}.${"A".repeat(43)}` });
  assert(!forged.ok);
  assertEquals(forged.code, "staff_only");
});

Deno.test("a place with no code answers place_code_required, even with a token", async () => {
  const { store } = await memoryStore({});
  const r = await access(store, { place_id: PLACE, place_code: "123456" });
  assert(!r.ok);
  assertEquals([r.status, r.code], [409, "place_code_required"]);
});

Deno.test("the right code mints a token that reads for 12 hours, at this place only", async () => {
  const { store } = await memoryStore({ [PLACE]: "123456", [OTHER]: "123456" });
  const first = await access(store, { place_id: PLACE, place_code: "12 34 56" });
  assert(first.ok && first.minted);
  const token = first.minted.token;

  const again = await access(store, { place_id: PLACE, staff_token: token }, T0 + 11 * 3600_000);
  assert(again.ok);
  assertEquals(again.minted, null);

  const late = await access(store, { place_id: PLACE, staff_token: token }, T0 + STAFF_TOKEN_TTL_SEC * 1000 + 1000);
  assert(!late.ok);
  assertEquals(late.code, "staff_only");

  // Same code at another place: the token is still bound to the first.
  const elsewhere = await access(store, { place_id: OTHER, staff_token: token });
  assert(!elsewhere.ok);
  assertEquals(elsewhere.code, "staff_only");
});

Deno.test("changing the place code revokes every staff token; removing it too", async () => {
  const s = await memoryStore({ [PLACE]: "123456" });
  const first = await access(s.store, { place_id: PLACE, place_code: "123456" });
  assert(first.ok && first.minted);
  s.hashes.set(PLACE, await hashPlaceCode(PLACE, "999999"));
  const r = await access(s.store, { place_id: PLACE, staff_token: first.minted.token });
  assert(!r.ok);
  assertEquals(r.code, "staff_only");
  assertEquals(await checkStaffToken(KEY, PLACE, first.minted.token, null, T0), false);
});

Deno.test("a token signed under another service key never reads", async () => {
  const { store } = await memoryStore({ [PLACE]: "123456" });
  const first = await access(store, { place_id: PLACE, place_code: "123456" });
  assert(first.ok && first.minted);
  const keys = { codeHash: await hashPlaceCode(PLACE, "123456"), staffQr: null };
  assertEquals(await checkStaffToken("another-key", PLACE, first.minted.token, keys, T0), false);
  assertEquals(await checkStaffToken(KEY, PLACE, first.minted.token, keys, T0), true);
});

Deno.test("wrong codes are staff tries: the sixth from one address answers locked, a token never writes one", async () => {
  const s = await memoryStore({ [PLACE]: "123456" });
  for (let i = 0; i < 5; i++) {
    const r = await access(s.store, { place_id: PLACE, place_code: "000000" });
    assert(!r.ok);
    assertEquals(r.code, "staff_only");
  }
  const sixth = await access(s.store, { place_id: PLACE, place_code: "123456" });
  assert(!sixth.ok);
  assertEquals([sixth.status, sixth.code], [409, "locked"]);
  assert(Number(sixth.detail?.retry_after_s) > 0);

  const before = s.tries.length;
  await access(s.store, { place_id: PLACE, staff_token: "s1.nope" });
  assertEquals(s.tries.length, before);
});

Deno.test("the list: this place, this mode, the last 12 hours, newest first, never who paid", async () => {
  const s = await memoryStore({ [PLACE]: "123456" });
  const row = (id: string, place: string, hoursAgo: number, livemode = false, seen: string | null = null) => ({
    id,
    place_id: place,
    livemode,
    amount_cents: 20000,
    tip_cents: 2000,
    currency: "mxn",
    paid_at: new Date(T0 - hoursAgo * 3600_000).toISOString(),
    ticket: "12",
    proof_seen_at: seen,
    status: "paid",
  });
  s.rows.push(row("a", PLACE, 1), row("b", PLACE, 3, false, "2026-11-09T17:05:00Z"), row("c", PLACE, 13), row("d", OTHER, 1), row("e", PLACE, 1, true));
  const list = await listPayments(s.store, { placeId: PLACE, livemode: false, nowMs: T0 });
  assertEquals(list.map((p) => p.id), ["a", "b"]);
  assertEquals(list.map((p) => p.seen), [false, true]);
  assertEquals(Object.keys(list[0]).sort(), ["amount_cents", "currency", "expired", "id", "outside", "paid_at", "refunded", "seen", "ticket", "tip_cents"]);
  // Never who paid (MESITA-3545 adds only the outside flags).
  assertEquals(list.map((p) => [p.outside, p.expired]), [[false, false], [false, false]]);
});

// ── The Staff QR (MESITA-3696) ──────────────────────────────────────────────

Deno.test("the Staff QR mints a 12-hour token at its place, stamps its use, and works on the next read", async () => {
  const s = await memoryStore({ [PLACE]: "123456" });
  const qr = makeStaffQr();
  s.qrs.set(PLACE, qr);
  const first = await access(s.store, { place_id: PLACE, staff_qr: qr });
  assert(first.ok && first.minted);
  assertEquals(s.qrUsed.get(PLACE), new Date(T0).toISOString());
  const again = await access(s.store, { place_id: PLACE, staff_token: first.minted.token }, T0 + 11 * 3600_000);
  assert(again.ok);
});

Deno.test("a Staff QR for place A gives nothing at place B", async () => {
  const s = await memoryStore({ [PLACE]: "123456", [OTHER]: "123456" });
  const qr = makeStaffQr();
  s.qrs.set(PLACE, qr);
  s.qrs.set(OTHER, makeStaffQr());
  const r = await access(s.store, { place_id: OTHER, staff_qr: qr });
  assert(!r.ok);
  assertEquals([r.status, r.code], [403, "staff_qr_off"]);
  assertEquals(s.qrUsed.has(OTHER), false);
});

Deno.test("New Staff QR ends the old QR and every token; so does a new code", async () => {
  const s = await memoryStore({ [PLACE]: "123456" });
  const old = makeStaffQr();
  s.qrs.set(PLACE, old);
  const byQr = await access(s.store, { place_id: PLACE, staff_qr: old });
  const byCode = await access(s.store, { place_id: PLACE, place_code: "123456" });
  assert(byQr.ok && byQr.minted && byCode.ok && byCode.minted);

  s.qrs.set(PLACE, makeStaffQr());
  for (const t of [byQr.minted.token, byCode.minted.token]) {
    const r = await access(s.store, { place_id: PLACE, staff_token: t });
    assert(!r.ok);
    assertEquals(r.code, "staff_only");
  }
  const oldQr = await access(s.store, { place_id: PLACE, staff_qr: old });
  assert(!oldQr.ok);
  assertEquals(oldQr.code, "staff_qr_off");

  const fresh = await access(s.store, { place_id: PLACE, staff_qr: s.qrs.get(PLACE) });
  assert(fresh.ok && fresh.minted);
  s.hashes.set(PLACE, await hashPlaceCode(PLACE, "999999"));
  const afterCode = await access(s.store, { place_id: PLACE, staff_token: fresh.minted.token });
  assert(!afterCode.ok);
});

Deno.test("adding a Staff QR leaves no-QR places' tokens as they were signed", async () => {
  const s = await memoryStore({ [PLACE]: "123456" });
  const first = await access(s.store, { place_id: PLACE, place_code: "123456" });
  assert(first.ok && first.minted);
  const keys = { codeHash: await hashPlaceCode(PLACE, "123456"), staffQr: null };
  assertEquals(await checkStaffToken(KEY, PLACE, first.minted.token, keys, T0), true);
});

Deno.test("a bad Staff QR is a staff try and locks like wrong codes; no QR set refuses too", async () => {
  const s = await memoryStore({ [PLACE]: "123456" });
  const none = await access(s.store, { place_id: PLACE, staff_qr: makeStaffQr() });
  assert(!none.ok);
  assertEquals(none.code, "staff_qr_off");
  s.qrs.set(PLACE, makeStaffQr());
  for (let i = 0; i < 4; i++) {
    const r = await access(s.store, { place_id: PLACE, staff_qr: makeStaffQr() });
    assert(!r.ok);
  }
  const sixth = await access(s.store, { place_id: PLACE, staff_qr: s.qrs.get(PLACE) });
  assert(!sixth.ok);
  assertEquals([sixth.status, sixth.code], [409, "locked"]);
});

Deno.test("a malformed Staff QR is no key at all", async () => {
  const s = await memoryStore({ [PLACE]: "123456" });
  const r = await access(s.store, { place_id: PLACE, staff_qr: "short" });
  assert(!r.ok);
  assertEquals(r.code, "staff_only");
  assertEquals(s.tries.length, 0);
});

// ── Where a token came from and which phone holds it (MESITA-3707) ─────────
// Auth: only a phone that scanned the Staff QR may Verify a guest's payment
// or confirm cash. The source and the device id are signed: editing either
// fails; two phones that join in the same second are two phones.

Deno.test("the Staff QR mints a qr token with its own device id; the place code mints a code token", async () => {
  const s = await memoryStore({ [PLACE]: "123456" });
  const qr = makeStaffQr();
  s.qrs.set(PLACE, qr);
  const keys = await s.store.keys(PLACE);
  const byQr = await access(s.store, { place_id: PLACE, staff_qr: qr });
  const byQr2 = await access(s.store, { place_id: PLACE, staff_qr: qr });
  const byCode = await access(s.store, { place_id: PLACE, place_code: "123456" });
  assert(byQr.ok && byQr.minted && byQr2.ok && byQr2.minted && byCode.ok && byCode.minted);
  const a = await readStaffToken(KEY, PLACE, byQr.minted.token, keys, T0);
  const b = await readStaffToken(KEY, PLACE, byQr2.minted.token, keys, T0);
  const c = await readStaffToken(KEY, PLACE, byCode.minted.token, keys, T0);
  assertEquals([a?.src, b?.src, c?.src], ["qr", "qr", "code"]);
  assert(a?.jti && b?.jti && a.jti !== b.jti, "two joins in the same second are two phones");
  assert(await staffDeviceHash(a.jti) !== await staffDeviceHash(b.jti));
});

Deno.test("editing a token's source or device id fails the check", async () => {
  const s = await memoryStore({ [PLACE]: "123456" });
  const keys = await s.store.keys(PLACE);
  const { token } = await mintStaffToken(KEY, PLACE, keys!, T0, "code");
  assert(await readStaffToken(KEY, PLACE, token, keys, T0));
  const asQr = token.replace(".code.", ".qr.");
  assertEquals(await readStaffToken(KEY, PLACE, asQr, keys, T0), null);
  const parts = token.split(".");
  parts[3] = (parts[3][0] === "A" ? "B" : "A") + parts[3].slice(1);
  assertEquals(await readStaffToken(KEY, PLACE, parts.join("."), keys, T0), null);
  assertEquals(await readStaffToken(KEY, OTHER, token, keys, T0), null);
});

Deno.test("an s2 token lasts 12 hours and dies with a new code", async () => {
  const s = await memoryStore({ [PLACE]: "123456" });
  const keys = await s.store.keys(PLACE);
  const { token } = await mintStaffToken(KEY, PLACE, keys!, T0, "qr");
  assert(await checkStaffToken(KEY, PLACE, token, keys, T0 + (STAFF_TOKEN_TTL_SEC - 60) * 1000));
  assertEquals(await checkStaffToken(KEY, PLACE, token, keys, T0 + (STAFF_TOKEN_TTL_SEC + 1) * 1000), false);
  s.hashes.set(PLACE, await hashPlaceCode(PLACE, "654321"));
  assertEquals(await checkStaffToken(KEY, PLACE, token, await s.store.keys(PLACE), T0), false);
});
