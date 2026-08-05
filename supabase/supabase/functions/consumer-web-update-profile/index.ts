// Supabase Edge Function — consumer-web-update-profile
//
// Authenticated. The consumer writes their own onboarding details (name, sex,
// birthday, country, phone). Auto-creates the consumer row on first call so
// onboarding works even if the user hasn't hit /qr yet to trigger
// consumer-web-get-profile's lazy create.
//
// Self-contained: own JWT verification, own DB writes via the service role.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
} from "../_shared/auth.ts";
import { clean } from "../_shared/input.ts";
import {
  buildProfilePatch,
  parseBirthday,
  parseName,
  parseSex,
  type UpdateProfileBody,
} from "./update-profile-fields.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;
  const userId = authRes.user.id;

  const bodyRes = await readJson<UpdateProfileBody>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const body = bodyRes.body;

  const firstName = clean(body.first_name, 60);
  const lastName = clean(body.last_name, 60);
  // Derive full_name from first + last when either was sent. Falls
  // back to body.full_name for legacy clients that still pass it.
  const fullName =
    body.first_name !== undefined || body.last_name !== undefined
      ? [firstName, lastName].filter(Boolean).join(" ") || null
      : clean(body.full_name, 120);
  const country = clean(body.country, 64);
  const phone = clean(body.phone, 32);
  const sexRaw = clean(body.sex, 16);
  const birthdayRaw = clean(body.birthday, 32);

  // Name is written as a pair — never half of one (see parseName).
  const nameRes = parseName(body, firstName, lastName);
  if (!nameRes.ok) return nameRes.response;

  const sexRes = parseSex(sexRaw);
  if (!sexRes.ok) return sexRes.response;
  const { sex } = sexRes;

  const birthdayRes = parseBirthday(birthdayRaw);
  if (!birthdayRes.ok) return birthdayRes.response;
  const { birthday } = birthdayRes;

  const admin = adminClient(envRes.env);

  // Ensure a consumer row exists. If not, create it with a generated code so
  // the validator can scan the QR immediately after onboarding.
  const existing = await admin
    .from("consumers")
    .select("id, code")
    .eq("id", userId)
    .maybeSingle();
  if (existing.error) {
    return json({ ok: false, error: `consumer_read: ${existing.error.message}` }, 500);
  }
  if (!existing.data) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const codeResult = await admin.rpc("generate_consumer_code");
      if (codeResult.error) {
        return json({ ok: false, error: `code_gen: ${codeResult.error.message}` }, 500);
      }
      const inserted = await admin
        .from("consumers")
        .insert({ id: userId, code: codeResult.data as string })
        .select("id, code")
        .single();
      if (!inserted.error) break;
      if (inserted.error.code !== "23505") {
        return json({ ok: false, error: `consumer_create: ${inserted.error.message}` }, 500);
      }
    }
  }

  const built = buildProfilePatch(body, {
    firstName,
    lastName,
    fullName,
    sex,
    birthday,
    country,
    phone,
  });
  if (!built.ok) return built.response;
  const patch = built.patch;

  const update = await admin
    .from("consumers")
    .update(patch)
    .eq("id", userId)
    .select(
      "id, code, full_name, first_name, last_name, sex, birthday, country, phone, profile_public, profile_show_saves, profile_show_visits, profile_show_stories",
    )
    .single();
  if (update.error) {
    if (update.error.code === "23505") {
      return json(
        { ok: false, code: "phone_taken", error: "That phone is already on another account." },
        409,
      );
    }
    return json({ ok: false, error: `consumer_update: ${update.error.message}` }, 500);
  }

  return json({ ok: true, consumer: update.data });
});
