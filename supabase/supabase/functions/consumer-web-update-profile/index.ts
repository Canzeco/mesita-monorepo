// Supabase Edge Function — consumer-web-update-profile
//
// Authenticated. The consumer writes their own onboarding details (name, sex,
// birthday, avatar). Auto-creates the consumer row on first call so
// onboarding works even if the user hasn't hit /qr yet to trigger
// consumer-web-get-profile's lazy create.
//
// Self-contained: the consumer door verifies the JWT; own DB writes via the service role.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import { clean } from "../_shared/input.ts";
import { writeConsumer } from "../_shared/consumer-doc.ts";
import { runInBackground } from "../_shared/background.ts";
import { savePhotoSizes } from "../_shared/photo-sizes.ts";
import { paymentsLivemode } from "../_shared/stripe.ts";
import { accountDeletedResponse, isDeletedConsumer } from "../_shared/delete-history-free.ts";
import {
  buildProfilePatch,
  AVATAR_BUCKET,
  parseAvatarUrl,
  parseBirthday,
  parseBirthYear,
  parseFollowersEmulated,
  parseName,
  parseSex,
  type UpdateProfileBody,
  notWritableKey,
} from "./update-profile-fields.ts";

const CONSUMER_PROFILE_SELECT =
  "id, code, full_name, first_name, last_name, sex, birthday, birth_year, phone, avatar_url, use_instagram_photo, appear_anonymous, instagram_handle_shown, instagram_followers_emulated, guest_class, plan";

serveJson("consumer-web-update-profile", async (req) => {
  const ctx = await requireConsumerRequest(req);
  if (ctx instanceof Response) return ctx;
  const { env, admin, user } = ctx;
  const userId = user.id;

  const bodyRes = await readJson<UpdateProfileBody>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const body = bodyRes.body;

  const blocked = notWritableKey(body);
  if (blocked) {
    return json({
      ok: false,
      code: "field_not_writable",
      error: `${blocked} can't be changed from the app`,
    }, 400);
  }

  const firstName = clean(body.first_name, 60);
  const lastName = clean(body.last_name, 60);
  const sexRaw = clean(body.sex, 16);
  const birthdayRaw = clean(body.birthday, 32);

  // Either half may be written alone, but never blanked (see parseName).
  const nameRes = parseName(body, firstName, lastName);
  if (!nameRes.ok) return nameRes.response;

  const sexRes = parseSex(sexRaw);
  if (!sexRes.ok) return sexRes.response;
  const { sex } = sexRes;

  const birthdayRes = parseBirthday(birthdayRaw);
  if (!birthdayRes.ok) return birthdayRes.response;
  const { birthday } = birthdayRes;

  // MESITA-4302: birth_year is the age source. Sent directly by the current
  // forms; derived from `birthday` for a client that still sends the date.
  const birthYearRes = parseBirthYear(body.birth_year);
  if (!birthYearRes.ok) return birthYearRes.response;
  const birthYear = body.birth_year !== undefined
    ? birthYearRes.birthYear
    : birthday
    ? Number(birthday.slice(0, 4))
    : undefined;

  const avatarRes = parseAvatarUrl(body.avatar_url, userId, env.url);
  if (!avatarRes.ok) return avatarRes.response;
  const { avatarUrl } = avatarRes;

  // MESITA-4662: the follower emulator writes only in Stripe test mode (the
  // gate the Stories emulator used, MESITA-4426); Reset to real always works.
  const emulatedRes = parseFollowersEmulated(body.instagram_followers_emulated, !paymentsLivemode());
  if (!emulatedRes.ok) return emulatedRes.response;

  // Ensure a consumer row exists. If not, create it with a generated code so
  // the validator can scan the QR immediately after onboarding.
  // first_name/last_name ride along because full_name is derived from BOTH
  // and a caller may send only one of them (MESITA-1806).
  const existing = await admin
    .from("consumers")
    .select("id, code, deleted_at, first_name, last_name, avatar_url")
    .eq("id", userId)
    .maybeSingle();
  if (existing.error) {
    return json({ ok: false, error: `consumer_read: ${existing.error.message}` }, 500);
  }
  if (isDeletedConsumer(existing.data)) return accountDeletedResponse();
  if (!existing.data) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const codeResult = await admin.rpc("generate_consumer_code");
      if (codeResult.error) {
        return json({ ok: false, error: `code_gen: ${codeResult.error.message}` }, 500);
      }
      const inserted = await writeConsumer(admin, {
        mode: "insert",
        id: userId,
        patch: { code: codeResult.data as string },
      });
      if (inserted.ok) break;
      if (inserted.code !== "23505") {
        return json({ ok: false, error: `consumer_create: ${inserted.error}` }, 500);
      }
    }
  }

  // full_name is the MERGED join, not the join of what this request carried:
  // onboarding sends first_name alone and the reservation sheet sends
  // last_name alone, so joining only the body would blank the other half on
  // the exact write that is supposed to complete the booking name. An absent
  // half falls back to what is already stored (null on a row created above).
  const storedFirst = (existing.data?.first_name as string | null) ?? null;
  const storedLast = (existing.data?.last_name as string | null) ?? null;
  const mergedFirst = body.first_name !== undefined ? firstName : storedFirst;
  const mergedLast = body.last_name !== undefined ? lastName : storedLast;
  const fullName = [mergedFirst, mergedLast].filter(Boolean).join(" ") || null;

  const built = buildProfilePatch(body, {
    firstName,
    lastName,
    fullName,
    sex,
    birthday,
    birthYear,
    avatarUrl,
    followersEmulated: emulatedRes.followersEmulated,
  });
  if (!built.ok) return built.response;
  const patch = built.patch;

  // "Keep mine" keeps the picture (Pato, 2026-11-18, MESITA-4349): the
  // photo is a question asked before each connect and sync now, not a
  // standing switch, so a no never takes the current picture down. It took
  // an Instagram-copied picture down until then (MESITA-2585).

  const update = await writeConsumer(admin, {
    mode: "update",
    id: userId,
    patch,
    select: CONSUMER_PROFILE_SELECT,
  });
  if (!update.ok) {
    return json({ ok: false, error: `consumer_update: ${update.error}` }, 500);
  }

  // A new upload gets the three sizes screens load (MESITA-2966).
  if (typeof avatarUrl === "string" && avatarUrl !== existing.data?.avatar_url) {
    const base = env.url.replace(/\/+$/, "");
    const path = avatarUrl.slice(`${base}/storage/v1/object/public/${AVATAR_BUCKET}/`.length);
    runInBackground(savePhotoSizes(admin, env.url, AVATAR_BUCKET, path));
  }

  // The saved row replaces the app's cached profile, so it carries the
  // emulator's availability too (MESITA-4662), as get-profile does.
  return json({ ok: true, consumer: { ...update.row, emulator_available: !paymentsLivemode() } });
});
