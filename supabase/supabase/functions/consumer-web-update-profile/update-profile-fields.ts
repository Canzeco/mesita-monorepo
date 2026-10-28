import { json } from "../_shared/http.ts";

/** Keys a guest can never change from the app (MESITA-2553): Plan and Class
 *  are set by an operator only, through admin_set_guest_standing. A body that
 *  carries one is refused loudly instead of being silently ignored. */
export const NOT_WRITABLE_FROM_APP = [
  "plan",
  "guestClass",
  "guest_class",
  "guestClassNote",
  "guest_class_note",
  "guest_class_set_at",
  "guest_class_set_by",
  // MESITA-2556: the VIP's partner and last day, operator-set like the class.
  "vipPartnerId",
  "vip_partner_id",
  "vipUntil",
  "vip_until",
  "diamond",
] as const;

/** The first key in `body` the app may not send, or null. */
export function notWritableKey(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  for (const key of NOT_WRITABLE_FROM_APP) {
    if (key in body) return key;
  }
  return null;
}

export type UpdateProfileBody = {
  // full_name is not a request field: this EF joins first_name + last_name
  // to repopulate it for downstream readers.
  first_name?: string | null;
  last_name?: string | null;
  sex?: string | null;
  birthday?: string | null;
  // Public URL of a photo the caller already uploaded to consumer-avatars
  // (MESITA-953). null/"" clears. Foreign hosts are rejected.
  avatar_url?: string | null;
  // MESITA-2585: "Use my Instagram photo" on Me › Instagram.
  use_instagram_photo?: boolean;
  // MESITA-2590: "Public profile" off = true (no photo or handle in Social;
  // the first name still shows, MESITA-2612).
  appear_anonymous?: boolean;
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

// Each half of the name is written INDEPENDENTLY (MESITA-1806). It used to be
// all-or-nothing, because full_name is derived from first + last and a write
// carrying one half would have blanked the other — but onboarding now collects
// only the first name and the reservation sheet sends only the last, so the
// pair rule would reject both of the two writes that matter. The derivation is
// safe because index.ts merges each absent half from the stored row before
// rebuilding full_name.
//
// What survives is the rule that actually protects the booking name: a half
// that IS sent must carry a real value. Clearing your first name to "" would
// leave a consumer no place can be told to expect, so an explicit blank is
// still a 400 — as distinct from simply not sending that key, which patches
// nothing. Patches that don't touch the name at all (avatar-only,
// birthday-only) pass straight through.
export function parseName(
  body: UpdateProfileBody,
  firstName: string | null,
  lastName: string | null,
): ParseNameResult {
  const halves = [
    ["first_name", body.first_name, firstName],
    ["last_name", body.last_name, lastName],
  ] as const;
  for (const [key, sent, cleaned] of halves) {
    if (sent === undefined) continue;
    if (!cleaned) {
      return {
        ok: false,
        response: json(
          { ok: false, error: `${key} can't be blank` },
          400,
        ),
      };
    }
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
  // undefined = not in this patch; null = clear; string = set.
  avatarUrl?: string | null;
};

export type ProfilePatchResult =
  | { ok: true; patch: Record<string, unknown> }
  | { ok: false; response: Response };

// Build a patch with only the fields the caller actually sent. Avoids
// null-clobbering values they didn't intend to touch. When the client sends
// EITHER half of the name, full_name is also updated — `fields.fullName` is
// the MERGED join (index.ts fills the absent half from the stored row), so
// downstream readers (reservation agent, staff lookup) keep working.
export function buildProfilePatch(
  body: UpdateProfileBody,
  fields: ProfileFieldValues,
): ProfilePatchResult {
  const patch: Record<string, unknown> = {};
  if (body.first_name !== undefined) patch.first_name = fields.firstName;
  if (body.last_name !== undefined) patch.last_name = fields.lastName;
  if (body.first_name !== undefined || body.last_name !== undefined) {
    patch.full_name = fields.fullName;
  }
  if (body.sex !== undefined) patch.sex = fields.sex;
  if (body.birthday !== undefined) patch.birthday = fields.birthday;
  if (body.avatar_url !== undefined) patch.avatar_url = fields.avatarUrl ?? null;
  if (body.use_instagram_photo !== undefined) {
    if (typeof body.use_instagram_photo !== "boolean") {
      return {
        ok: false,
        response: json({ ok: false, error: "use_instagram_photo must be a boolean" }, 400),
      };
    }
    patch.use_instagram_photo = body.use_instagram_photo;
  }
  if (body.appear_anonymous !== undefined) {
    if (typeof body.appear_anonymous !== "boolean") {
      return {
        ok: false,
        response: json({ ok: false, error: "appear_anonymous must be a boolean" }, 400),
      };
    }
    patch.appear_anonymous = body.appear_anonymous;
  }

  if (Object.keys(patch).length === 0) {
    return {
      ok: false,
      response: json({ ok: false, error: "Nothing to update" }, 400),
    };
  }

  return { ok: true, patch };
}
