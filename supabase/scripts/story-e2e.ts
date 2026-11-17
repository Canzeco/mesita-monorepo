// deno task story-e2e — MESITA-4297's live run, Stripe test mode only.
//
// Against the live project, through the deployed Edge Functions, with the
// Meta emulator: a throwaway guest with a verified Instagram handle (written
// by the service role, as DM verification is off), a throwaway place with a
// waiter code, then the new order — the waiter approves BEFORE the guest pays:
//   1. open the story check → emulate post → the waiter reads the check (the
//      story shows) → approve with the waiter code → buy → what the guest
//      paid Available at once, the check used → the cron's {purchase_id}
//      re-check → bonus released.
//   2. a new check → post → approve → emulate delete before paying (the check
//      opens again) → post → approve → buy → emulate delete after paying →
//      three re-checks → bonus void (unreachable), the paid credit untouched.
// Plus the refusals: approve without the waiter code (403), the old activate
// (409 reload). The purchase rows are opened and credited by the service role
// through wallet_credit_purchase, the function Stripe's webhook calls (a
// throwaway place has no connected Stripe account to charge, so the buy door's
// story_not_verified is covered by Deno and pgTAP, not here).
//
// Run: cd supabase && deno task story-e2e
// The keys are read from the Supabase CLI into this process and never
// printed. Everything it made is deleted in finally. Prints PASS/FAIL and the
// time per step; exits 1 on any FAIL.

import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { hashPlaceCode } from "../supabase/functions/_shared/place-code.ts";

const REF = "yjalywfzdelacdzccpgb";
const BASE = `https://${REF}.supabase.co`;
const CODE = "426442";

/** The CLI's keys. Its output can carry trailing text, so the JSON array is
 *  cut out before decoding. Never printed. */
async function cliKeys(): Promise<{ service: string; anon: string }> {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const out = await new Deno.Command("supabase", {
      args: ["projects", "api-keys", "--project-ref", REF, "-o", "json"],
      stdout: "piped",
      stderr: "null",
    }).output();
    const raw = new TextDecoder().decode(out.stdout);
    const start = raw.indexOf("[");
    const end = raw.lastIndexOf("]");
    try {
      const rows = JSON.parse(raw.slice(start, end + 1)) as { name: string; api_key: string }[];
      const service = rows.find((r) => r.name === "service_role")?.api_key;
      const anon = rows.find((r) => r.name === "anon")?.api_key;
      if (service && anon) return { service, anon };
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, attempt * 3000));
  }
  throw new Error("no keys from the Supabase CLI (is it logged in?)");
}

let failures = 0;
let last = Date.now();
function step(name: string, ok: boolean, detail: unknown = ""): void {
  if (!ok) failures++;
  const d = detail === "" ? "" : ` ${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 400)}`;
  const ms = Date.now() - last;
  last = Date.now();
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} (${ms} ms)${ok ? "" : d}`);
}

async function call(fn: string, bearer: string, body: unknown, extra: Record<string, string> = {}): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(`${BASE}/functions/v1/${fn}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json", ...extra },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json as Record<string, unknown> };
}

/** A Story buy presenting the check, credited as Stripe's webhook would. */
async function storyPurchase(admin: SupabaseClient, userId: string, placeId: string, checkId: string): Promise<{ id: string; story: string | undefined }> {
  const id = crypto.randomUUID();
  const { error } = await admin.from("wallet_purchases").insert({
    id,
    consumer_id: userId,
    place_id: placeId,
    amount_cents: 10000,
    currency: "mxn",
    status: "open",
    stripe_account_id: "acct_test_story_e2e",
    voucher: "voucher_story",
    bonus_cents: 5000,
    application_fee_cents: 0,
    stripe_checkout_session_id: `cs_test_story_e2e_${id}`,
    livemode: false,
    story_check_id: checkId,
  });
  if (error) throw new Error(`purchase insert: ${error.message}`);
  const { data, error: cErr } = await admin.rpc("wallet_credit_purchase", {
    p_purchase_id: id,
    p_payment_intent: `pi_test_story_e2e_${id}`,
    p_available_at: null,
  });
  if (cErr) throw new Error(`wallet_credit_purchase: ${cErr.message}`);
  if ((data as { outcome?: string })?.outcome !== "credited") throw new Error(`credit: ${JSON.stringify(data)}`);
  return { id, story: (data as { story?: string }).story };
}

type Check = { id: string; token: string; state: string; story_status: string; story: { id: string; media_url: string | null } | null; expires_at: string };

async function purchaseRow(admin: SupabaseClient, id: string) {
  const { data } = await admin.from("wallet_purchases")
    .select("status, story_review, story_bonus, story_bonus_void_reason, story_recheck_tries").eq("id", id).single();
  return data as { status: string; story_review: string | null; story_bonus: string | null; story_bonus_void_reason: string | null; story_recheck_tries: number };
}

async function entryKinds(admin: SupabaseClient, id: string): Promise<string[]> {
  const { data } = await admin.from("wallet_entries").select("kind, amount_cents").eq("purchase_id", id);
  return ((data ?? []) as { kind: string; amount_cents: number }[]).map((e) => `${e.kind}:${e.amount_cents}`).sort();
}

async function main(): Promise<void> {
  const keys = await cliKeys();
  const admin = createClient(BASE, keys.service, { auth: { persistSession: false } });
  const stamp = crypto.randomUUID().slice(0, 8);
  const handle = `e2e_story_${stamp}`;
  const placeId = crypto.randomUUID();
  const purchases: string[] = [];
  const allChecks: string[] = [];
  let userId: string | null = null;

  try {
    // ── The guest ────────────────────────────────────────────────────────────
    const email = `story-e2e-${stamp}@test.mesita.ai`;
    const { data: u, error: uErr } = await admin.auth.admin.createUser({ email, email_confirm: true });
    if (uErr) throw uErr;
    userId = u.user.id;
    const { error: cErr } = await admin.from("consumers").upsert({
      id: userId,
      instagram_handle: handle,
      instagram_verified_at: new Date().toISOString(),
      instagram_followers_count: 5000,
    });
    if (cErr) throw new Error(`consumer: ${cErr.message}`);
    const { data: link, error: lErr } = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (lErr) throw lErr;
    const anon = createClient(BASE, keys.anon, { auth: { persistSession: false } });
    const { data: sess, error: sErr } = await anon.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
    if (sErr || !sess.session) throw new Error(`guest session: ${sErr?.message ?? "none"}`);
    const guestJwt = sess.session.access_token;
    step("guest with a verified handle", true);

    // ── The place and its waiter code ────────────────────────────────────────
    const { error: ppErr } = await admin.from("place_profiles").insert({ id: placeId, google_name: `Story e2e ${stamp}` });
    if (ppErr) throw new Error(`place_profiles: ${ppErr.message}`);
    const { error: pErr } = await admin.from("places").insert({
      id: placeId, slug: `story-e2e-${stamp}`, state: "active", content_state: "generating", currency: "MXN",
    });
    if (pErr) throw new Error(`places: ${pErr.message}`);
    const { error: codeErr } = await admin.from("place_codes").insert({ place_id: placeId, code_hash: await hashPlaceCode(placeId, CODE) });
    if (codeErr) throw new Error(`place_codes: ${codeErr.message}`);
    const staff = await call("visit-web-list-payments", keys.anon, { place_id: placeId, place_code: CODE });
    const staffToken = staff.body.staff_token as string | undefined;
    step("waiter code signs a staff phone in", !!staffToken, staff);
    if (!staffToken) return;

    const checks: string[] = [];
    const approve = (token: string, mention: string) =>
      call("visit-web-review-story", keys.anon, { token, decision: "approve", mention_id: mention, staff_token: staffToken, place_id: placeId });
    const post = async (label: string) => {
      const r = await call("consumer-web-emulate-story", guestJwt, { action: "post", place_id: placeId });
      const m = (r.body.mention as { id?: string; media_url?: string } | undefined) ?? {};
      step(`${label} emulate post records a story`, r.status === 200 && !!m.id, r);
      return m;
    };

    // ── Run 1: approved, paid, released ──────────────────────────────────────
    const open1 = await call("consumer-web-open-story-check", guestJwt, { place_id: placeId });
    const c1 = open1.body.check as Check | undefined;
    step("1 the Story sheet opens a check, waiting for a story", open1.status === 200 && c1?.state === "open" && c1.story_status === "waiting", open1);
    if (!c1) return;
    checks.push(c1.id);
    const get1 = await call("consumer-web-get-story-check", guestJwt, { place_id: placeId });
    step("1 reading it again returns the same check", (get1.body.check as Check | undefined)?.id === c1.id, get1);

    const m1 = await post("1");
    if (m1.media_url) {
      const img = await fetch(m1.media_url, { headers: { Range: "bytes=0-0" } });
      await img.body?.cancel();
      step("1 the story's image loads", img.status === 200 || img.status === 206, img.status);
    }
    const seen = await call("consumer-web-get-story-check", guestJwt, { place_id: placeId });
    step("1 the guest's sheet reads story received", (seen.body.check as Check | undefined)?.story_status === "received", seen.body);

    const read1 = await call("visit-web-get-story", keys.anon, { token: c1.token });
    step("1 the waiter sees the story", read1.body.state === "open" && (read1.body.story as { id?: string } | null)?.id === m1.id, read1.body);

    const noCode = await call("visit-web-review-story", keys.anon, { token: c1.token, decision: "approve", mention_id: m1.id });
    step("approve without the waiter code is 403 staff_code_needed", noCode.status === 403 && noCode.body.code === "staff_code_needed", noCode);
    const old = await call("visit-web-activate-story", keys.anon, { token: c1.token });
    step("the old activate answers 409 reload", old.status === 409 && old.body.code === "reload", old);

    const ap1 = await approve(c1.token, m1.id!);
    step("1 the waiter approves (good 2 hours to pay)", ap1.status === 200 && ap1.body.outcome === "approved" && !!ap1.body.expires_at, ap1);
    const again = await approve(c1.token, m1.id!);
    step("1 a second approve answers the stored approval", again.body.outcome === "already_approved", again);
    const sheet1 = await call("consumer-web-get-story-check", guestJwt, { place_id: placeId });
    step("1 the guest's sheet reads approved", (sheet1.body.check as Check | undefined)?.state === "approved", sheet1.body);

    const p1 = await storyPurchase(admin, userId, placeId, c1.id);
    purchases.push(p1.id);
    step("1 paid: credited, bonus waiting", p1.story === "waiting", p1);
    step("1 paid credit Available at once, no bonus yet", (await entryKinds(admin, p1.id)).join() === "voucher:10000", await entryKinds(admin, p1.id));
    const { data: used } = await admin.from("story_checks").select("state, used_by_purchase").eq("id", c1.id).single();
    step("1 the check is used by the purchase", (used as { state: string; used_by_purchase: string }).used_by_purchase === p1.id, used);
    const pr1 = await admin.from("wallet_purchases").select("paid_at, story_recheck_at").eq("id", p1.id).single();
    const gap = Date.parse((pr1.data as { story_recheck_at: string }).story_recheck_at) - Date.parse((pr1.data as { paid_at: string }).paid_at);
    step("1 the bonus re-check is 3 hours after payment", Math.abs(gap - 3 * 3600_000) < 2000, pr1.data);

    const cron1 = await call("supabase-cron-recheck-stories", keys.service, { purchase_id: p1.id }, { "X-Internal-Caller": "story-e2e" });
    step("1 the re-check releases the bonus", cron1.status === 200 && cron1.body.released === 1, cron1);
    const r1 = await purchaseRow(admin, p1.id);
    step("1 bonus released, voucher + bonus entries", r1.story_bonus === "released" && (await entryKinds(admin, p1.id)).join() === "bonus:5000,voucher:10000", { r1, e: await entryKinds(admin, p1.id) });

    // ── Run 2: delete before paying reopens; delete after paying voids ───────
    const open2 = await call("consumer-web-open-story-check", guestJwt, { place_id: placeId });
    const c2 = open2.body.check as Check | undefined;
    step("2 a new check after the used one", open2.status === 200 && !!c2 && c2.id !== c1.id && c2.state === "open", open2);
    if (!c2) return;
    checks.push(c2.id);
    const m2a = await post("2");
    step("2 the waiter approves", (await approve(c2.token, m2a.id!)).body.outcome === "approved");
    const delBefore = await call("consumer-web-emulate-story", guestJwt, { action: "delete", place_id: placeId });
    const reopened = await call("consumer-web-get-story-check", guestJwt, { place_id: placeId });
    step("2 deleting the story before paying opens the check again", delBefore.status === 200 && (reopened.body.check as Check | undefined)?.state === "open", { delBefore, c: reopened.body });
    const m2 = await post("2 again");
    step("2 the waiter approves the new story", (await approve(c2.token, m2.id!)).body.outcome === "approved");
    const p2 = await storyPurchase(admin, userId, placeId, c2.id);
    purchases.push(p2.id);
    step("2 paid: credited, bonus waiting", p2.story === "waiting", p2);
    const del2 = await call("consumer-web-emulate-story", guestJwt, { action: "delete", purchase_id: p2.id });
    step("2 emulate delete after paying removes the story", del2.status === 200 && del2.body.mention_id === m2.id, del2);
    for (let i = 1; i <= 3; i++) {
      const c = await call("supabase-cron-recheck-stories", keys.service, { purchase_id: p2.id }, { "X-Internal-Caller": "story-e2e" });
      step(`2 re-check ${i} finds the story gone`, c.status === 200 && c.body.released === 0 && c.body.failed === 0, c);
    }
    const r2 = await purchaseRow(admin, p2.id);
    step(
      "2 bonus void (unreachable), paid credit untouched",
      r2.story_bonus === "void" && r2.story_bonus_void_reason === "unreachable" && (await entryKinds(admin, p2.id)).join() === "voucher:10000",
      { r2, e: await entryKinds(admin, p2.id) },
    );

    const wallet = await call("consumer-web-get-wallet", guestJwt, {});
    const rows = (wallet.body.waiting_stories as { purchase_id: string; state: string }[] | undefined) ?? [];
    step(
      "the Wallet lists both decided Stories with their state",
      rows.find((r) => r.purchase_id === p1.id)?.state === "released" && rows.find((r) => r.purchase_id === p2.id)?.state === "void",
      rows,
    );
    allChecks.push(...checks);
  } catch (e) {
    step("run", false, e instanceof Error ? e.message : String(e));
  } finally {
    if (userId) {
      const { data: cs } = await admin.from("story_checks").select("id").eq("consumer_id", userId);
      const ids = [...new Set([...allChecks, ...((cs ?? []) as { id: string }[]).map((c) => c.id)])];
      if (purchases.length > 0) await admin.from("story_mentions").delete().in("purchase_id", purchases);
      for (const id of ids) {
        await admin.from("story_mentions").delete().like("ig_story_id", `emu-${id}-%`);
        const { data: objs } = await admin.storage.from("story-emulator").list(id);
        const names = ((objs ?? []) as { name: string }[]).map((o) => `${id}/${o.name}`);
        if (names.length > 0) await admin.storage.from("story-emulator").remove(names);
      }
      // purchases ↔ checks reference each other: unlink, then delete both.
      await admin.from("wallet_purchases").update({ story_check_id: null }).eq("consumer_id", userId);
      await admin.from("story_checks").delete().eq("consumer_id", userId);
      await admin.from("wallet_entries").delete().eq("consumer_id", userId);
      await admin.from("wallet_purchases").delete().eq("consumer_id", userId);
    }
    await admin.from("place_codes").delete().eq("place_id", placeId);
    await admin.from("places").delete().eq("id", placeId);
    await admin.from("place_profiles").delete().eq("id", placeId);
    if (userId) await admin.auth.admin.deleteUser(userId);
    console.log(failures === 0 ? "\nstory-e2e: PASS" : `\nstory-e2e: FAIL (${failures})`);
  }
}

await main();
Deno.exit(failures === 0 ? 0 : 1);
