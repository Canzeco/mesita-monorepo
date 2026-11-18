// deno task story-e2e — MESITA-4296's live run, with MESITA-4304's waiter
// step, Stripe test mode only.
//
// Against the live project, through the deployed Edge Functions, with the
// Meta emulator: a throwaway guest with a verified PUBLIC Instagram handle
// (written by the service role, as DM verification is off) and a throwaway
// place. The story comes FIRST, then the purchase:
//   1. emulate post (no purchase yet) → check-story (poll) finds it, waiting
//      for the waiter, with its QR → the waiter reads it (visit-web-get-story)
//      → approve without the waiter code is 403 → the waiter approves with
//      the code → check-story reads approved → a purchase reserving it is
//      credited → the credit claims the story → the cron's {purchase_id}
//      re-check → bonus released.
//   2. post → check → the waiter approves → purchase → claimed → emulate
//      delete → three re-checks → bonus void (unreachable), the paid credit
//      untouched.
//   3. a story too close to its 24 hours reads story_too_old; a rejected
//      story reads story_rejected; a story no waiter approved pays the money
//      and voids the bonus (not_verified).
//   6. the emulated waiter (MESITA-4307): post → check → "Simulate the
//      waiter's approval" → the check reads approved → paid and claimed.
//   4. a second live purchase cannot reserve a story already reserved.
//   5. a live purchase with a test story: the money lands, the bonus is void
//      (mention_lost).
// Plus the gate (a place with no Instagram → place_no_instagram) and the buy's
// own refusals (no story named → 400; a Story with other vouchers → 409).
// The purchase rows are opened and credited by the service role through
// wallet_credit_purchase, the function Stripe's webhook calls (a throwaway
// place has no connected Stripe account to charge).
//
// The service key is read from the Supabase CLI into this process and never
// printed. Everything it made is deleted in finally. Prints PASS/FAIL per
// step; exits 1 on any FAIL.

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
function step(name: string, ok: boolean, detail: unknown = ""): void {
  if (!ok) failures++;
  const d = detail === "" ? "" : ` ${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 400)}`;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : d}`);
}

async function call(fn: string, bearer: string, body: unknown, extra: Record<string, string> = {}, query = ""): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(`${BASE}/functions/v1/${fn}${query}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json", ...extra },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json as Record<string, unknown> };
}

/** A Story purchase reserving `mentionId`, credited as Stripe's webhook would. */
async function storyPurchase(
  admin: SupabaseClient,
  userId: string,
  placeId: string,
  mentionId: string | null,
  livemode = false,
): Promise<{ id: string; story: string }> {
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
    livemode,
    story_mention_id: mentionId,
  });
  if (error) throw new Error(`purchase insert: ${error.message}`);
  const { data, error: cErr } = await admin.rpc("wallet_credit_purchase", {
    p_purchase_id: id,
    p_payment_intent: `pi_test_story_e2e_${id}`,
    p_available_at: null,
  });
  if (cErr) throw new Error(`wallet_credit_purchase: ${cErr.message}`);
  const res = data as { outcome?: string; story?: string };
  if (res?.outcome !== "credited") throw new Error(`credit: ${JSON.stringify(data)}`);
  return { id, story: res.story ?? "" };
}

async function purchaseRow(admin: SupabaseClient, id: string) {
  const { data } = await admin.from("wallet_purchases")
    .select("status, story_activated_at, story_recheck_at, story_bonus, story_bonus_void_reason, story_recheck_tries").eq("id", id).single();
  return data as { status: string; story_activated_at: string | null; story_recheck_at: string | null; story_bonus: string | null; story_bonus_void_reason: string | null; story_recheck_tries: number };
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
      instagram_is_private: false,
    });
    if (cErr) throw new Error(`consumer: ${cErr.message}`);
    const { data: link, error: lErr } = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (lErr) throw lErr;
    const anon = createClient(BASE, keys.anon, { auth: { persistSession: false } });
    const { data: sess, error: sErr } = await anon.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
    if (sErr || !sess.session) throw new Error(`guest session: ${sErr?.message ?? "none"}`);
    const guestJwt = sess.session.access_token;
    step("guest with a verified public handle", true);

    // ── The place (no Instagram: the gate answers first) ─────────────────────
    const { error: ppErr } = await admin.from("place_profiles").insert({ id: placeId, google_name: `Story e2e ${stamp}` });
    if (ppErr) throw new Error(`place_profiles: ${ppErr.message}`);
    const { error: pErr } = await admin.from("places").insert({
      id: placeId, slug: `story-e2e-${stamp}`, state: "active", content_state: "generating", currency: "MXN",
    });
    if (pErr) throw new Error(`places: ${pErr.message}`);

    // The waiter code, and a waiter's phone signed in with it.
    const { error: codeErr } = await admin.from("place_codes").insert({ place_id: placeId, code_hash: await hashPlaceCode(placeId, CODE) });
    if (codeErr) throw new Error(`place_codes: ${codeErr.message}`);
    const staff = await call("visit-web-list-payments", keys.anon, { place_id: placeId, place_code: CODE });
    const staffToken = staff.body.staff_token as string | undefined;
    step("the waiter code signs a waiter's phone in", !!staffToken, staff);
    const review = (token: string, decision: "approve" | "reject") =>
      call("visit-web-review-story", keys.anon, { token, decision, staff_token: staffToken, place_id: placeId });
    /** The check (poll) finds the story; its QR token; the waiter approves it. */
    const checkAndApprove = async (label: string, mentionId: string | undefined) => {
      const f = await call("consumer-web-check-story", guestJwt, { place_id: placeId }, {}, "?poll=1");
      const rv = f.body.review as { state?: string; url?: string } | undefined;
      step(`${label} check finds the story, waiting for the waiter`, f.body.found === true && (f.body.mention as { id?: string })?.id === mentionId && rv?.state === "waiting", f);
      const token = rv?.url?.split("/story/")[1] ?? "";
      const ok = await review(token, "approve");
      step(`${label} the waiter approves with the code`, ok.status === 200 && ok.body.outcome === "approved", ok);
      return token;
    };

    const gate = await call("consumer-web-check-story", guestJwt, { place_id: placeId });
    step("check: a place with no Instagram reads place_no_instagram", gate.status === 200 && gate.body.found === false && gate.body.reason === "place_no_instagram", gate);
    const poll0 = await call("consumer-web-check-story", guestJwt, { place_id: placeId }, {}, "?poll=1");
    step("check (poll): no story yet reads no_story", poll0.status === 200 && poll0.body.reason === "no_story", poll0);

    const noStory = await call("consumer-web-buy-voucher", guestJwt, {
      place_id: placeId, voucher: "voucher_story", request_id: crypto.randomUUID(), card_pm_id: "pm_card_visa",
    });
    step("buy: a Story with no story named is 400 bad_body mention_id", noStory.status === 400 && noStory.body.field === "mention_id", noStory);
    const basket = await call("consumer-web-buy-voucher", guestJwt, {
      place_id: placeId, items: [{ voucher: "voucher_story", qty: 1 }, { voucher: "voucher_200", qty: 1 }],
      request_id: crypto.randomUUID(), card_pm_id: "pm_card_visa", mention_id: crypto.randomUUID(),
    });
    step("buy: a Story with other vouchers is 409 story_one_per_basket", basket.status === 409 && basket.body.code === "story_one_per_basket", basket);

    // ── 1: post → check finds it → pay → claimed → released ─────────────────
    const post1 = await call("consumer-web-emulate-story", guestJwt, { action: "post" });
    const m1 = (post1.body.mention as { id?: string; media_url?: string | null } | undefined) ?? {};
    step("1 Tag the place records a test story, no screenshot (MESITA-4310)", post1.status === 200 && !!m1.id && m1.media_url === null, post1);
    const found1 = await call("consumer-web-check-story", guestJwt, { place_id: placeId }, {}, "?poll=1");
    const rv1 = found1.body.review as { state?: string; url?: string } | undefined;
    step(
      "1 check finds that story, waiting for the waiter, with its QR",
      found1.body.found === true && (found1.body.mention as { id?: string } | undefined)?.id === m1.id && rv1?.state === "waiting" &&
        /^https:\/\/visit\.mesita\.ai\/story\/[0-9a-f]{32}$/.test(rv1?.url ?? ""),
      found1,
    );
    const t1 = rv1?.url?.split("/story/")[1] ?? "";
    const read1 = await call("visit-web-get-story", keys.anon, { token: t1 });
    step(
      "1 the waiter's page shows the story, waiting",
      read1.status === 200 && read1.body.state === "waiting" && (read1.body.story as { id?: string; status?: string })?.id === m1.id &&
        (read1.body.story as { status?: string })?.status === "received" && read1.body.instagram_handle === handle,
      read1,
    );
    const noCode = await call("visit-web-review-story", keys.anon, { token: t1, decision: "approve" });
    step("1 approve without the waiter code is 403 staff_code_needed", noCode.status === 403 && noCode.body.code === "staff_code_needed", noCode);
    const ap1 = await review(t1, "approve");
    step("1 the waiter approves with the code", ap1.status === 200 && ap1.body.outcome === "approved", ap1);
    const again1 = await review(t1, "approve");
    step("1 a second approve answers the stored approval", again1.body.outcome === "already_approved", again1);
    const sheet1 = await call("consumer-web-check-story", guestJwt, { place_id: placeId }, {}, "?poll=1");
    step("1 the guest's check reads approved: Pay turns on", (sheet1.body.review as { state?: string })?.state === "approved", sheet1);
    const p1 = await storyPurchase(admin, userId, placeId, m1.id ?? null);
    purchases.push(p1.id);
    step("1 the credit claims the story", p1.story === "claimed", p1);
    step("1 paid credit Available at payment, no bonus", (await entryKinds(admin, p1.id)).join() === "voucher:10000", await entryKinds(admin, p1.id));
    const r1a = await purchaseRow(admin, p1.id);
    step(
      "1 the re-check is set to payment + 3 hours",
      !!r1a.story_activated_at && Date.parse(r1a.story_recheck_at ?? "") - Date.parse(r1a.story_activated_at) === 3 * 3600 * 1000,
      r1a,
    );
    const cron1 = await call("supabase-cron-recheck-stories", keys.service, { purchase_id: p1.id }, { "X-Internal-Caller": "story-e2e" });
    step("1 the re-check releases the bonus", cron1.status === 200 && cron1.body.released === 1, cron1);
    const r1 = await purchaseRow(admin, p1.id);
    step("1 bonus released, voucher + bonus entries", r1.story_bonus === "released" && (await entryKinds(admin, p1.id)).join() === "bonus:5000,voucher:10000", { r1, e: await entryKinds(admin, p1.id) });

    // ── 2: deleted → void ────────────────────────────────────────────────────
    const post2 = await call("consumer-web-emulate-story", guestJwt, { action: "post" });
    const m2 = (post2.body.mention as { id?: string } | undefined) ?? {};
    step("2 emulate post", post2.status === 200 && !!m2.id, post2);
    await checkAndApprove("2", m2.id);
    const p2 = await storyPurchase(admin, userId, placeId, m2.id ?? null);
    purchases.push(p2.id);
    step("2 claimed at the credit", p2.story === "claimed", p2);
    const del2 = await call("consumer-web-emulate-story", guestJwt, { action: "delete" });
    const { data: d2 } = await admin.from("story_mentions").select("deleted_at").eq("id", m2.id).single();
    step("2 emulate delete marks the claimed test story deleted", del2.status === 200 && del2.body.mention_id === m2.id && !!(d2 as { deleted_at: string | null } | null)?.deleted_at, { del2, d2 });
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

    // ── 3: too old ───────────────────────────────────────────────────────────
    const post3 = await call("consumer-web-emulate-story", guestJwt, { action: "post" });
    const m3 = (post3.body.mention as { id?: string } | undefined) ?? {};
    await admin.from("story_mentions").update({ mentioned_at: new Date(Date.now() - (20 * 3600 + 45 * 60) * 1000).toISOString() }).eq("id", m3.id);
    const old3 = await call("consumer-web-check-story", guestJwt, { place_id: placeId }, {}, "?poll=1");
    step("3 a story that would end before the re-check reads story_too_old", old3.body.found === false && old3.body.reason === "story_too_old", old3);

    // ── 3b: rejected; 3c: never approved ─────────────────────────────────────
    const post3b = await call("consumer-web-emulate-story", guestJwt, { action: "post" });
    const m3b = (post3b.body.mention as { id?: string } | undefined) ?? {};
    const f3b = await call("consumer-web-check-story", guestJwt, { place_id: placeId }, {}, "?poll=1");
    const t3b = (f3b.body.review as { url?: string } | undefined)?.url?.split("/story/")[1] ?? "";
    const rj = await review(t3b, "reject");
    step("3b the waiter rejects a story", (f3b.body.mention as { id?: string })?.id === m3b.id && rj.status === 200 && rj.body.outcome === "rejected", rj);
    const after3b = await call("consumer-web-check-story", guestJwt, { place_id: placeId }, {}, "?poll=1");
    step("3b the guest's check reads story_rejected", after3b.body.found === false && after3b.body.reason === "story_rejected", after3b);
    const late = await review(t3b, "approve");
    step("3b a rejected story cannot be approved after", late.status === 409 && late.body.code === "already_decided", late);
    const p3c = await storyPurchase(admin, userId, placeId, m3b.id ?? null);
    purchases.push(p3c.id);
    step(
      "3c a story no waiter approved: money in, bonus void (not_verified)",
      p3c.story === "not_verified" && (await entryKinds(admin, p3c.id)).join() === "voucher:10000",
      p3c,
    );

    // ── 4: one live reservation per story ────────────────────────────────────
    const post4 = await call("consumer-web-emulate-story", guestJwt, { action: "post" });
    const m4 = (post4.body.mention as { id?: string } | undefined) ?? {};
    const held = crypto.randomUUID();
    const { error: h1 } = await admin.from("wallet_purchases").insert({
      id: held, consumer_id: userId, place_id: placeId, amount_cents: 10000, currency: "mxn", status: "open",
      stripe_account_id: "acct_test_story_e2e", voucher: "voucher_story", bonus_cents: 5000, application_fee_cents: 0,
      livemode: false, story_mention_id: m4.id,
    });
    purchases.push(held);
    const { error: h2 } = await admin.from("wallet_purchases").insert({
      consumer_id: userId, place_id: placeId, amount_cents: 10000, currency: "mxn", status: "open",
      stripe_account_id: "acct_test_story_e2e", voucher: "voucher_story", bonus_cents: 5000, application_fee_cents: 0,
      livemode: false, story_mention_id: m4.id,
    });
    step("4 a second live purchase cannot reserve the same story", !h1 && h2?.code === "23505", { h1, h2 });

    // ── 5: livemode ──────────────────────────────────────────────────────────
    const post5 = await call("consumer-web-emulate-story", guestJwt, { action: "post" });
    const m5 = (post5.body.mention as { id?: string } | undefined) ?? {};
    const p5 = await storyPurchase(admin, userId, placeId, m5.id ?? null, true);
    purchases.push(p5.id);
    const r5 = await purchaseRow(admin, p5.id);
    step(
      "5 a live purchase with a test story: money in, bonus void (mention_lost)",
      p5.story === "mention_lost" && r5.story_bonus_void_reason === "mention_lost" && (await entryKinds(admin, p5.id)).join() === "voucher:10000",
      { p5, r5 },
    );

    // ── 6: the waiter's approval, emulated (MESITA-4307) ────────────────────
    const none6 = await call("consumer-web-emulate-story", guestJwt, { action: "approve", place_id: crypto.randomUUID() });
    step("6 emulate approve with no story checked at that place is 404 no_story", none6.status === 404 && none6.body.code === "no_story", none6);
    const post6 = await call("consumer-web-emulate-story", guestJwt, { action: "post" });
    const m6 = (post6.body.mention as { id?: string } | undefined) ?? {};
    const f6 = await call("consumer-web-check-story", guestJwt, { place_id: placeId }, {}, "?poll=1");
    step("6 check finds the simulated story, waiting", (f6.body.mention as { id?: string })?.id === m6.id && (f6.body.review as { state?: string })?.state === "waiting", f6);
    const ap6 = await call("consumer-web-emulate-story", guestJwt, { action: "approve", place_id: placeId });
    step("6 emulate approve approves it", ap6.status === 200 && ap6.body.outcome === "approved" && ap6.body.mention_id === m6.id, ap6);
    const s6 = await call("consumer-web-check-story", guestJwt, { place_id: placeId }, {}, "?poll=1");
    step("6 the guest's check reads approved", (s6.body.review as { state?: string })?.state === "approved", s6);
    const p6 = await storyPurchase(admin, userId, placeId, m6.id ?? null);
    purchases.push(p6.id);
    step("6 paid: the credit claims the emulated-approved story", p6.story === "claimed", p6);

    const wallet = await call("consumer-web-get-wallet", guestJwt, {});
    const rows = (wallet.body.waiting_stories as { purchase_id: string; state: string }[] | undefined) ?? [];
    step(
      "the Wallet lists both decided Stories with their state",
      rows.find((r) => r.purchase_id === p1.id)?.state === "released" && rows.find((r) => r.purchase_id === p2.id)?.state === "void",
      rows,
    );
  } catch (e) {
    step("run", false, e instanceof Error ? e.message : String(e));
  } finally {
    if (userId) {
      await admin.from("wallet_entries").delete().eq("consumer_id", userId);
      await admin.from("wallet_purchases").delete().eq("consumer_id", userId);
      await admin.from("story_mentions").delete().like("ig_story_id", `emu-${userId}-%`);
      const { data: objs } = await admin.storage.from("story-emulator").list(userId);
      const names = ((objs ?? []) as { name: string }[]).map((o) => `${userId}/${o.name}`);
      if (names.length > 0) await admin.storage.from("story-emulator").remove(names);
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
