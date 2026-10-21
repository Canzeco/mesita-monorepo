// Supabase Edge Function — consumer-web-update-profile
//
// Authenticated. The consumer writes their own onboarding details (name, sex,
// birthday, avatar). Auto-creates the consumer row on first call so
// onboarding works even if the user hasn't hit /qr yet to trigger
// consumer-web-get-profile's lazy create.
//
// Self-contained: own JWT verification, own DB writes via the service role.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
} from "../_shared/auth.ts";
import { clean } from "../_shared/input.ts";
import { isInstagramAvatar } from "../_shared/instagram-avatar.ts";
import { writeConsumer } from "../_shared/consumer-doc.ts";
import { accountDeletedResponse, isDeletedConsumer } from "../_shared/delete-history-free.ts";
import {
  buildProfilePatch,
  parseAvatarUrl,
  parseBirthday,
  parseName,
  parseSex,
  type UpdateProfileBody,
  notWritableKey,
} from "./update-profile-fields.ts";

const CONSUMER_PROFILE_SELECT =
  "id, code, full_name, first_name, last_name, sex, birthday, phone, avatar_url, use_instagram_photo, guest_class, plan";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;
  const userId = authRes.user.id;

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

  const avatarRes = parseAvatarUrl(body.avatar_url, userId, envRes.env.url);
  if (!avatarRes.ok) return avatarRes.response;
  const { avatarUrl } = avatarRes;

  const admin = adminClient(envRes.env);

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
    avatarUrl,
  });
  if (!built.ok) return built.response;
  const patch = built.patch;

  // Switching "Use my Instagram photo" off takes an Instagram-copied picture
  // down with it; an uploaded photo stays (MESITA-2585).
  if (
    body.use_instagram_photo === false &&
    body.avatar_url === undefined &&
    isInstagramAvatar(existing.data?.avatar_url as string | null, userId)
  ) {
    patch.avatar_url = null;
  }

  const update = await writeConsumer(admin, {
    mode: "update",
    id: userId,
    patch,
    select: CONSUMER_PROFILE_SELECT,
  });
  if (!update.ok) {
    return json({ ok: false, error: `consumer_update: ${update.error}` }, 500);
  }

  return json({ ok: true, consumer: update.row });
});
