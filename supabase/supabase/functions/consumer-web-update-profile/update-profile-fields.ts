import { json } from "../_shared/http.ts";

export type UpdateProfileBody = {
  // Legacy single-field name. Still accepted so older clients keep
  // working. New clients send first_name + last_name; this EF joins them
  // to repopulate full_name for downstream readers.
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  sex?: string | null;
  birthday?: string | null;
  country?: string | null;
  phone?: string | null;
  // Public URL of a photo the caller already uploaded to consumer-avatars
  // (MESITA-953). null/"" clears. Foreign hosts are rejected.
  avatar_url?: string | null;
  // Profile visibility flags (MESITA-76 / MESITA-913). Sent alone or
  // alongside the identity fields; only the keys present are patched.
  privacy_public?: boolean;
  privacy_show_saves?: boolean;
  privacy_show_visits?: boolean;
  privacy_show_stories?: boolean;
};

export const AVATAR_BUCKET = "consumer-avatars";

export type ParseAvatarResult =
  | { ok: true; avatarUrl: string | null | undefined }
  | { ok: false; response: Response };

// avatar_url must be omitted, null (clear), or a public object URL under
// this caller's folder in consumer-avatars. Blocks arbitrary remote URLs.
export function parseAvatarUrl(
  raw: string | null | undefined,
  userId: string,
  supabaseUrl: string,
): ParseAvatarResult {
  if (raw === undefined) return { ok: true, avatarUrl: undefined };
  if (raw === null || raw === "") return { ok: true, avatarUrl: null };
  const trimmed = raw.trim();
  const base = supabaseUrl.replace(/\/+$/, "");
  const prefix = `${base}/storage/v1/object/public/${AVATAR_BUCKET}/${userId}/`;
  if (!trimmed.startsWith(prefix)) {
    return {
      ok: false,
      response: json(
        {
          ok: false,
          error: "avatar_url must be a Mesita avatar upload for this account",
        },
        400,
      ),
    };
  }
  // No query/hash tricks, and the remainder must stay a single object path.
  const rest = trimmed.slice(prefix.length);
  if (
    !rest ||
    rest.includes("..") ||
    rest.includes("?") ||
    rest.includes("#") ||
    rest.includes("//")
  ) {
    return {
      ok: false,
      response: json({ ok: false, error: "avatar_url path is invalid" }, 400),
    };
  }
  return { ok: true, avatarUrl: trimmed };
}

// Male/Female only — "other" was dropped from the product (MESITA-727).
const SEX_VALUES = new Set(["male", "female"]);

export type ParseNameResult =
  | { ok: true }
  | { ok: false; response: Response };

// A consumer's name is written as a pair or not at all. Reservations are
// placed with the venue under the guest's full name (host systems key on
// "last name + party size"), and full_name here is derived from first +
// last — so a write that carries one half without the other would leave a
// consumer who can't be booked. Patches that don't touch the name at all
// (visibility flags, birthday-only, legacy full_name) pass straight through.
export function parseName(
  body: UpdateProfileBody,
  firstName: string | null,
  lastName: string | null,
): ParseNameResult {
  const touchesName =
    body.first_name !== undefined || body.last_name !== undefined;
  if (!touchesName) return { ok: true };
  if (!firstName || !lastName) {
    return {
      ok: false,
      response: json(
        { ok: false, error: "first_name and last_name are both required" },
        400,
      ),
    };
  }
  return { ok: true };
}

// Minimum signup age. Pato: "13 or below restricted" → require >= 14
// (MESITA-727). Enforced here as the backstop for both web + mobile forms.
export const MIN_AGE = 14;

export type ParseSexResult =
  | { ok: true; sex: string | null }
  | { ok: false; response: Response };

export function parseSex(sexRaw: string | null): ParseSexResult {
  const sex = sexRaw && SEX_VALUES.has(sexRaw.toLowerCase()) ? sexRaw.toLowerCase() : null;
  if (sexRaw && !sex) {
    return {
      ok: false,
      response: json({ ok: false, error: "sex must be male or female" }, 400),
    };
  }
  return { ok: true, sex };
}

// Whole years between `birthday` (validated YYYY-MM-DD) and today, from
// calendar parts in UTC so the result is timezone-stable.
function ageInYears(birthday: string): number {
  const [y, m, d] = birthday.split("-").map(Number);
  const now = new Date();
  let age = now.getUTCFullYear() - y;
  const monthDelta = now.getUTCMonth() + 1 - m;
  if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < d)) age -= 1;
  return age;
}

export type ParseBirthdayResult =
  | { ok: true; birthday: string | null }
  | { ok: false; response: Response };

export function parseBirthday(birthdayRaw: string | null): ParseBirthdayResult {
  if (!birthdayRaw) return { ok: true, birthday: null };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthdayRaw)) {
    return {
      ok: false,
      response: json({ ok: false, error: "birthday must be YYYY-MM-DD" }, 400),
    };
  }
  // Sanity check: must parse + not in the future.
  const parsed = new Date(`${birthdayRaw}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return {
      ok: false,
      response: json({ ok: false, error: "birthday is not a real date" }, 400),
    };
  }
  if (parsed.getTime() > Date.now()) {
    return {
      ok: false,
      response: json({ ok: false, error: "birthday can't be in the future" }, 400),
    };
  }
  // Age gate — anyone 13 or below is restricted (MESITA-727).
  if (ageInYears(birthdayRaw) < MIN_AGE) {
    return {
      ok: false,
      response: json(
        { ok: false, error: `You must be at least ${MIN_AGE} years old to use Mesita.` },
        400,
      ),
    };
  }
  return { ok: true, birthday: birthdayRaw };
}

export type ProfileFieldValues = {
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  sex: string | null;
  birthday: string | null;
  country: string | null;
  phone: string | null;
  // undefined = not in this patch; null = clear; string = set.
  avatarUrl?: string | null;
};

export type ProfilePatchResult =
  | { ok: true; patch: Record<string, unknown> }
  | { ok: false; response: Response };

// Build a patch with only the fields the caller actually sent. Avoids
// null-clobbering values they didn't intend to touch. When the client
// sends the name pair, full_name is also updated to the joined version so
// downstream readers (reservation agent, staff lookup) keep working.
export function buildProfilePatch(
  body: UpdateProfileBody,
  fields: ProfileFieldValues,
): ProfilePatchResult {
  const patch: Record<string, unknown> = {};
  if (body.first_name !== undefined) patch.first_name = fields.firstName;
  if (body.last_name !== undefined) patch.last_name = fields.lastName;
  if (
    body.first_name !== undefined ||
    body.last_name !== undefined ||
    body.full_name !== undefined
  ) {
    patch.full_name = fields.fullName;
  }
  if (body.sex !== undefined) patch.sex = fields.sex;
  if (body.birthday !== undefined) patch.birthday = fields.birthday;
  if (body.country !== undefined) patch.country = fields.country;
  if (body.phone !== undefined) patch.phone = fields.phone;
  if (body.avatar_url !== undefined) patch.avatar_url = fields.avatarUrl ?? null;
  for (const key of [
    "privacy_public",
    "privacy_show_saves",
    "privacy_show_visits",
    "privacy_show_stories",
  ] as const) {
    const value = body[key];
    if (value === undefined) continue;
    if (typeof value !== "boolean") {
      return {
        ok: false,
        response: json({ ok: false, error: `${key} must be a boolean` }, 400),
      };
    }
    patch[key] = value;
  }

  if (Object.keys(patch).length === 0) {
    return {
      ok: false,
      response: json({ ok: false, error: "Nothing to update" }, 400),
    };
  }

  return { ok: true, patch };
}
