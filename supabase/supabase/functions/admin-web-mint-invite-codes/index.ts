// Supabase Edge Function — admin-web-mint-invite-codes
//
// Naming: caller-verb-words. Caller = admin, verb = mint, words = invite codes.
//
// Mints a BATCH of bearer invite PINs (MESITA-1168). The shape follows the
// actual use: "I go to a modelling agency and tell them, take 50 codes for
// Diamond." So the unit of work is a batch with a label, not a single code —
// the label is what later answers "the agency handed out 37 of the 50".
//
// classKey takes a LEGACY class key because consumer_invite_codes.class_key
// FKs to public.classes: Diamond is 'aura', Silver is 'influencer'. The FK is
// the point — the database refuses a PIN for a class nothing can grant, so a
// 'gold' batch fails at MINT time rather than silently failing for 50 people
// at redemption time.
//
// Codes are 10 digits from crypto.getRandomValues, not Math.random. A PIN is a
// bearer credential; a predictable generator would make the whole batch
// guessable from one leaked code. Collisions retry against the UNIQUE index
// rather than being pre-checked, so two concurrent mints cannot interleave
// into a duplicate.
//
// Body: { classKey: string, count: number, batchLabel?: string,
//         note?: string, expiresAt?: string | null }
// Response: { ok: true, batchLabel, classKey, codes: string[] }
//
// Auth: caller's JWT email must be in public.super_admins.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsPreflight,
  json,
  readJson,
  rejectUnlessMethods,
} from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";

type Body = {
  classKey?: string;
  count?: number;
  batchLabel?: string;
  note?: string;
  expiresAt?: string | null;
};

/** One batch is a hand-off to one partner. 200 is well past "take 50". */
const MAX_BATCH = 200;

/** 10 digits, uniformly, from the CSPRNG. Never Math.random for a credential. */
function mintCode(): string {
  const bytes = new Uint32Array(2);
  crypto.getRandomValues(bytes);
  // Two 32-bit draws combined, then reduced mod 10^10. The bias from the
  // modulo is far below anything that matters at this alphabet size, and the
  // source is a CSPRNG rather than a seeded PRNG.
  const n = (BigInt(bytes[0]) * 4294967296n + BigInt(bytes[1])) % 10000000000n;
  return n.toString().padStart(10, "0");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const admin = adminClient(envRes.env);
  const guard = await requireSuperAdmin(admin, authRes.user);
  if (!guard.ok) return guard.response;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const body = bodyRes.body;

  const classKey = String(body.classKey ?? "").trim();
  if (!classKey) return json({ ok: false, error: "classKey is required" }, 400);

  const count = Math.trunc(Number(body.count));
  if (!Number.isFinite(count) || count < 1 || count > MAX_BATCH) {
    return json(
      { ok: false, error: `count must be between 1 and ${MAX_BATCH}` },
      400,
    );
  }

  let expiresAt: string | null = null;
  if (body.expiresAt) {
    const when = new Date(body.expiresAt);
    if (Number.isNaN(when.valueOf())) {
      return json({ ok: false, error: "expiresAt is not a date" }, 400);
    }
    if (when.getTime() < Date.now()) {
      return json({ ok: false, error: "expiresAt is already past" }, 400);
    }
    expiresAt = when.toISOString();
  }

  // Fail the WHOLE batch on an ungrantable class rather than minting PINs that
  // cannot be redeemed. The FK would catch it anyway; this just says why.
  const known = await admin
    .from("classes")
    .select("key, label")
    .eq("key", classKey)
    .maybeSingle();
  if (known.error) {
    return json({ ok: false, error: "Couldn't read classes" }, 500);
  }
  if (!known.data) {
    return json(
      { ok: false, error: `No class '${classKey}'. Nothing can grant it.` },
      400,
    );
  }

  const batchLabel = String(body.batchLabel ?? "").trim() || null;
  const note = String(body.note ?? "").trim() || null;

  const minted: string[] = [];
  let attempts = 0;
  // Retry per code against the UNIQUE index. A pre-check would race two
  // concurrent mints into the same value.
  while (minted.length < count && attempts < count * 12) {
    attempts++;
    const code = mintCode();
    const ins = await admin.from("consumer_invite_codes").insert({
      code,
      class_key: classKey,
      batch_label: batchLabel,
      note,
      expires_at: expiresAt,
      created_by: authRes.user.id,
    });
    if (!ins.error) {
      minted.push(code);
      continue;
    }
    // 23505 = unique_violation: this code already exists, draw another.
    if (ins.error.code === "23505") continue;
    console.error("mint_invite_codes_insert_failed", {
      error: ins.error.message,
      code: ins.error.code,
    });
    return json(
      { ok: false, error: "Couldn't mint the batch.", minted: minted.length },
      500,
    );
  }

  if (minted.length < count) {
    console.error("mint_invite_codes_exhausted", { wanted: count, got: minted.length });
    return json(
      { ok: false, error: "Couldn't mint the full batch.", minted: minted.length },
      500,
    );
  }

  console.info("mint_invite_codes_ok", {
    by: authRes.user.id,
    classKey,
    batchLabel,
    count: minted.length,
  });

  return json({ ok: true, batchLabel, classKey, codes: minted });
});
