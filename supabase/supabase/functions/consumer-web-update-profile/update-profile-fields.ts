import { json } from "../_shared/http.ts";

export type UpdateProfileBody = {
  // Legacy single-field name. Still accepted so older clients keep
  // working. New clients should send first_name + last_name; this EF
  // joins them to repopulate full_name for downstream readers.
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  sex?: string | null;
  birthday?: string | null;
  country?: string | null;
  phone?: string | null;
  // Profile visibility flags (MESITA-76). Sent alone or alongside the
  // identity fields; only the keys present are patched.
  profile_public?: boolean;
  profile_show_saves?: boolean;
  profile_show_visits?: boolean;
};

const SEX_VALUES = new Set(["male", "female", "other"]);

export type ParseSexResult =
  | { ok: true; sex: string | null }
  | { ok: false; response: Response };

export function parseSex(sexRaw: string | null): ParseSexResult {
  const sex = sexRaw && SEX_VALUES.has(sexRaw.toLowerCase()) ? sexRaw.toLowerCase() : null;
  if (sexRaw && !sex) {
    return {
      ok: false,
      response: json({ ok: false, error: "sex must be male, female, or other" }, 400),
    };
  }
  return { ok: true, sex };
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
};

export type ProfilePatchResult =
  | { ok: true; patch: Record<string, unknown> }
  | { ok: false; response: Response };

// Build a patch with only the fields the caller actually sent. Avoids
// null-clobbering values they didn't intend to touch. When the client
// sends first_name and/or last_name, full_name is also updated to
// the joined version so downstream readers keep working.
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
  for (const key of [
    "profile_public",
    "profile_show_saves",
    "profile_show_visits",
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
