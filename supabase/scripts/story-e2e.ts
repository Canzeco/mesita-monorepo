// deno task story-e2e — MESITA-4405's live run (the Story record), Stripe
// test mode only.
//
// Against the live project, through the deployed Edge Functions, with the
// Meta emulator: a throwaway guest with a verified PUBLIC Instagram handle
// (written by the service role, as DM verification is off) and a throwaway
// place. The money comes FIRST, then the Story:
//   1. a Story purchase is credited (as Stripe's webhook would): the paid
//      amount lands at once and a Story waits for a post → Tag the place
//      binds the story (the guest's only open Story) → the waiter reads it,
//      approve without the code is 403, approves with it → the cron's
//      {purchase_id} re-check → bonus released.
//   2. reject → post again: the waiter rejects; the Story waits for a post
//      again and the rejected story never binds back; a new post gets a new
//      QR; "Simulate the waiter" approves it; released.
//   3. deleted: approved, then "Simulate deleting it" → void deleted, the
//      money untouched.
//   4. two open Stories: a post binds to neither until the guest's screen
//      (check-story {story_id}) binds it to the Story it shows.
//   5. the deadline: a Story nobody posted for, past its deadline, turns
//      void expired at the cron's tick.
// Plus the gate (a place with no Instagram → place_no_instagram), the buy's
// one Story rule (a Story with other vouchers → 409), get-story's 404 for a
// Story that is not yours, and the Wallet's `stories` list. Purchase rows are
// opened and credited by the service role through wallet_credit_purchase
// (a throwaway place has no connected Stripe account to charge).
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

/** A Story purchase, credited as Stripe's webhook would. */
async function storyPurchase(
  admin: SupabaseClient,
  userId: string,
  placeId: string,
): Promise<{ id: string; story: string; story_id: string }> {
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
  });
  if (error) throw new Error(`purchase insert: ${error.message}`);
  const { data, error: cErr } = await admin.rpc("wallet_credit_purchase", {
    p_purchase_id: id,
    p_payment_intent: `pi_test_story_e2e_${id}`,
    p_available_at: null,
  });
  if (cErr) throw new Error(`wallet_credit_purchase: ${cErr.message}`);
  const res = data as { outcome?: string; story?: string; story_id?: string };
  if (res?.outcome !== "credited") throw new Error(`credit: ${JSON.stringify(data)}`);
  return { id, story: res.story ?? "", story_id: res.story_id ?? "" };
}

async function entryKinds(admin: SupabaseClient, id: string): Promise<string[]> {
  const { data } = await admin.from("wallet_entries").select("kind, amount_cents").eq("purchase_id", id);
  return ((data ?? []) as { kind: string; amount_cents: number }[]).map((e) => `${e.kind}:${e.amount_cents}`).sort();
}

type StoryOut = {
  story_id?: string;
  state?: string;
  void_reason?: string | null;
  review_url?: string | null;
  bonus_at?: string | null;
  approved_at?: string | null;
  deadline_at?: string;
  paid_at?: string | null;
  mention?: { id?: string } | null;
  poll?: unknown;
  emulator?: boolean;
};

async function main(): Promise<void> {
  const keys = await cliKeys();
  const admin = createClient(BASE, keys.service, { auth: { persistSession: false } });
  const stamp = crypto.randomUUID().slice(0, 8);
  const handle = `e2e_story_${stamp}`;
  const placeId = crypto.randomUUID();
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
    const getStory = async (by: { story_id?: string; purchase_id?: string }): Promise<StoryOut> =>
      ((await call("consumer-web-get-story", guestJwt, by)).body.story ?? {}) as StoryOut;
    const tokenOf = (s: StoryOut) => s.review_url?.split("/story/")[1] ?? "";
    const post = async () => (await call("consumer-web-emulate-story", guestJwt, { action: "post" })).body as {
      mention?: { id?: string; media_url?: string | null };
      bound_story_id?: string | null;
    };
    const recheck = (purchaseId: string) =>
      call("supabase-cron-recheck-stories", keys.service, { purchase_id: purchaseId }, { "X-Internal-Caller": "story-e2e" });

    const gate = await call("consumer-web-check-story", guestJwt, { place_id: placeId });
    step("gate: a place with no Instagram reads place_no_instagram", gate.status === 200 && gate.body.reason === "place_no_instagram", gate);
    const basket = await call("consumer-web-buy-voucher", guestJwt, {
      place_id: placeId, items: [{ voucher: "voucher_story", qty: 1 }, { voucher: "voucher_200", qty: 1 }],
      request_id: crypto.randomUUID(), card_pm_id: "pm_card_visa",
    });
    step("buy: a Story with other vouchers is 409 story_one_per_basket", basket.status === 409 && basket.body.code === "story_one_per_basket", basket);
    const noMention = await call("consumer-web-buy-voucher", guestJwt, {
      place_id: placeId, voucher: "voucher_story", request_id: crypto.randomUUID(), card_pm_id: "pm_card_visa",
    });
    step("buy: a Story names no story any more (no mention_id refusal)", noMention.body.field !== "mention_id", noMention);
    const nf = await call("consumer-web-get-story", guestJwt, { story_id: crypto.randomUUID() });
    step("get-story: a Story that is not yours is 404", nf.status === 404 && nf.body.code === "not_found", nf);

    // ── 1: pay → post → approve → released ──────────────────────────────────
    const p1 = await storyPurchase(admin, userId, placeId);
    step("1 the credit creates the Story, waiting for a post", p1.story === "waiting_post" && !!p1.story_id, p1);
    step("1 paid credit Available at payment, no bonus", (await entryKinds(admin, p1.id)).join() === "voucher:10000", await entryKinds(admin, p1.id));
    const s1a = await getStory({ purchase_id: p1.id });
    step(
      "1 get-story: waiting_post, deadline 12 h after payment, polling, test buttons",
      s1a.story_id === p1.story_id && s1a.state === "waiting_post" && !!s1a.poll && s1a.emulator === true &&
        Date.parse(s1a.deadline_at ?? "") - Date.parse(s1a.paid_at ?? "") === 12 * 3600 * 1000,
      s1a,
    );
    const poll1 = await call("consumer-web-check-story", guestJwt, { story_id: p1.story_id });
    step("1 the screen's poll with no story yet stays waiting_post", (poll1.body.story as StoryOut)?.state === "waiting_post", poll1);
    const post1 = await post();
    step("1 Tag the place binds the story to the only open Story", !!post1.mention?.id && post1.mention.media_url === null && post1.bound_story_id === p1.story_id, post1);
    const s1b = await getStory({ story_id: p1.story_id });
    const t1 = tokenOf(s1b);
    step(
      "1 found: the story and the waiter QR",
      s1b.state === "found" && s1b.mention?.id === post1.mention?.id && /^https:\/\/visit\.mesita\.ai\/story\/[0-9a-f]{32}$/.test(s1b.review_url ?? ""),
      s1b,
    );
    const read1 = await call("visit-web-get-story", keys.anon, { token: t1 });
    step(
      "1 the waiter's page shows the story, waiting",
      read1.status === 200 && read1.body.state === "waiting" && (read1.body.story as { status?: string })?.status === "received" &&
        read1.body.instagram_handle === handle,
      read1,
    );
    const noCode = await call("visit-web-review-story", keys.anon, { token: t1, decision: "approve" });
    step("1 approve without the waiter code is 403 staff_code_needed", noCode.status === 403 && noCode.body.code === "staff_code_needed", noCode);
    const ap1 = await review(t1, "approve");
    step("1 the waiter approves with the code", ap1.status === 200 && ap1.body.outcome === "approved", ap1);
    const again1 = await review(t1, "approve");
    step("1 a second approve answers the stored approval", again1.body.outcome === "already_approved", again1);
    const s1c = await getStory({ story_id: p1.story_id });
    step(
      "1 approved: Checking · bonus at approval + 3 h, the QR gone, no poll",
      s1c.state === "approved" && s1c.review_url === null && !s1c.poll &&
        Date.parse(s1c.bonus_at ?? "") - Date.parse(s1c.approved_at ?? "") === 3 * 3600 * 1000,
      s1c,
    );
    const cron1 = await recheck(p1.id);
    step("1 the re-check releases the bonus", cron1.status === 200 && cron1.body.released === 1, cron1);
    step("1 voucher + bonus entries", (await entryKinds(admin, p1.id)).join() === "bonus:5000,voucher:10000", await entryKinds(admin, p1.id));
    step("1 the Story reads released", (await getStory({ story_id: p1.story_id })).state === "released");

    // ── 2: reject → post again → approve → released ────────────────────────
    const p2 = await storyPurchase(admin, userId, placeId);
    const post2 = await post();
    step("2 a post binds to the new Story", post2.bound_story_id === p2.story_id, post2);
    const s2a = await getStory({ story_id: p2.story_id });
    const rj = await review(tokenOf(s2a), "reject");
    step("2 the waiter rejects it", rj.status === 200 && rj.body.outcome === "rejected", rj);
    const s2b = await getStory({ story_id: p2.story_id });
    step("2 the Story waits for a new post, no QR", s2b.state === "waiting_post" && s2b.review_url === null && s2b.mention === null, s2b);
    const poll2 = await call("consumer-web-check-story", guestJwt, { story_id: p2.story_id });
    step("2 the rejected story never binds back here", (poll2.body.story as StoryOut)?.state === "waiting_post", poll2);
    const late = await review(tokenOf(s2a), "approve");
    step("2 a rejected story cannot be approved after", late.status === 409 && late.body.code === "already_decided", late);
    const post2b = await post();
    const s2c = await getStory({ story_id: p2.story_id });
    step(
      "2 a new post binds with a new QR",
      post2b.bound_story_id === p2.story_id && s2c.state === "found" && tokenOf(s2c) !== tokenOf(s2a) && tokenOf(s2c) !== "",
      { post2b, s2c },
    );
    const ap2 = await call("consumer-web-emulate-story", guestJwt, { action: "approve", story_id: p2.story_id });
    step("2 Simulate the waiter approves it", ap2.status === 200 && ap2.body.outcome === "approved", ap2);
    const cron2 = await recheck(p2.id);
    step("2 the re-check releases the bonus", cron2.body.released === 1 && (await entryKinds(admin, p2.id)).join() === "bonus:5000,voucher:10000", cron2);

    // ── 3: approved, then deleted → void deleted ────────────────────────────
    const p3 = await storyPurchase(admin, userId, placeId);
    const post3 = await post();
    step("3 a post binds", post3.bound_story_id === p3.story_id, post3);
    await call("consumer-web-emulate-story", guestJwt, { action: "approve", story_id: p3.story_id });
    const del3 = await call("consumer-web-emulate-story", guestJwt, { action: "delete" });
    step("3 Simulate deleting it marks the approved Story's story", del3.status === 200 && del3.body.mention_id === post3.mention?.id, del3);
    const cron3 = await recheck(p3.id);
    const s3 = await getStory({ story_id: p3.story_id });
    step(
      "3 void deleted at once, the money untouched",
      cron3.body.voided === 1 && s3.state === "void" && s3.void_reason === "deleted" && (await entryKinds(admin, p3.id)).join() === "voucher:10000",
      { cron3, s3 },
    );

    // ── 4: two open Stories: the screen binds ───────────────────────────────
    const p4a = await storyPurchase(admin, userId, placeId);
    const p4b = await storyPurchase(admin, userId, placeId);
    const post4 = await post();
    step("4 with two open Stories a post binds to neither", !!post4.mention?.id && post4.bound_story_id === null, post4);
    const poll4 = await call("consumer-web-check-story", guestJwt, { story_id: p4b.story_id });
    step("4 the screen binds it to the Story it shows", (poll4.body.story as StoryOut)?.state === "found" && (poll4.body.story as StoryOut)?.mention?.id === post4.mention?.id, poll4);
    step("4 the other Story still waits", (await getStory({ story_id: p4a.story_id })).state === "waiting_post");

    // ── 5: the deadline ─────────────────────────────────────────────────────
    await admin.from("stories").update({ deadline_at: new Date(Date.now() - 60_000).toISOString() }).eq("id", p4a.story_id);
    const tick = await call("supabase-cron-recheck-stories", keys.service, {}, { "X-Internal-Caller": "story-e2e" });
    const s5 = await getStory({ story_id: p4a.story_id });
    step("5 past its deadline with no post: void expired at the tick", tick.status === 200 && s5.state === "void" && s5.void_reason === "expired", { tick: tick.body, s5 });

    const wallet = await call("consumer-web-get-wallet", guestJwt, {});
    const list = (wallet.body.stories as { story_id: string; state: string }[] | undefined) ?? [];
    step(
      "the Wallet's stories list has every Story with its state",
      list.length === 5 && list.find((r) => r.story_id === p1.story_id)?.state === "released" &&
        list.find((r) => r.story_id === p3.story_id)?.state === "void",
      list,
    );
  } catch (e) {
    step("run", false, e instanceof Error ? e.message : String(e));
  } finally {
    if (userId) {
      await admin.from("wallet_entries").delete().eq("consumer_id", userId);
      await admin.from("stories").delete().eq("consumer_id", userId);
      await admin.from("wallet_purchases").delete().eq("consumer_id", userId);
      await admin.from("story_mentions").delete().like("ig_story_id", `emu-${userId}-%`);
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
