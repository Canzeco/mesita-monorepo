import { json } from "../_shared/http.ts";
import { isSocialLevel, levelPatch, type SocialFacts, socialLevel, socialLock } from "../_shared/social-level.ts";
import {
  EMULATED_FOLLOWERS_MAX,
  isEmulatedFollowers,
  REMOVED_FIELD_APPEAR_ANONYMOUS,
} from "../_shared/consumer-doc.ts";

/** Keys a guest can never change from the app (MESITA-2553): Plan and Class
 *  are set by an operator only, through admin_set_guest_standing, and so is
 *  the reservation cap override (MESITA-2555). A body that
 *  carries one is refused loudly instead of being silently ignored. */
export const NOT_WRITABLE_FROM_APP = [
  "plan",
  "guestClass",
  "guest_class",
  "guestClassNote",
  "guest_class_note",
  "guest_class_set_at",
  "guest_class_set_by",
  "reservationCapOverride",
  "reservation_cap_override",
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

/** MESITA-4690: a body naming the retired Public profile field, with any
 *  value, gets this 400 before any other check or write; else null. */
export function removedFieldResponse(body: unknown): Response | null {
  if (typeof body !== "object" || body === null) return null;
  if (!("appear_anonymous" in body)) return null;
  return json({ ok: false, ...REMOVED_FIELD_APPEAR_ANONYMOUS }, 400);
}

export type UpdateProfileBody = {
  // full_name is not a request field: this EF joins first_name + last_name
  // to repopulate it for downstream readers.
  first_name?: string | null;
  last_name?: string | null;
  sex?: string | null;
  birthday?: string | null;
  // MESITA-4302: the year of birth, the age source since the day/month went.
  // An old client that still sends `birthday` gets its year written too.
  birth_year?: number | null;
  // Public URL of a photo the caller already uploaded to consumer-avatars
  // (MESITA-953). null/"" clears. Foreign hosts are rejected.
  avatar_url?: string | null;
  // MESITA-2585: "Use my Instagram photo" on Me › Instagram.
  use_instagram_photo?: boolean;
  // MESITA-4690: "Public profile" was removed; sending appear_anonymous with
  // any value is refused (REMOVED_FIELD_APPEAR_ANONYMOUS).
  appear_anonymous?: unknown;
  // MESITA-4659: "Show my handle on Mesita" on Me › Instagram. true shows the
  // handle to others, false hides it; null (no choice) is not writable here.
  instagram_handle_shown?: boolean;
  // MESITA-4850: the privacy level, private | public | instagram.
  social_level?: unknown;
  // MESITA-4662: the follower emulator on Me › Instagram. A number (test mode
  // only) stands in for the real count in the Class; null is Reset to real.
  instagram_followers_emulated?: number | null;
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

// "other" is back (MESITA-4854); MESITA-727 had dropped it.
const SEX_VALUES = new Set(["male", "female", "other"]);

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
      response: json({ ok: false, error: "sex must be male, female or other" }, 400),
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

export type ParseBirthYearResult =
  | { ok: true; birthYear: number | null }
  | { ok: false; response: Response };

/** Year of birth (MESITA-4302): an integer, not in the future, and the age
 *  floor by year alone: current year − birth_year >= MIN_AGE (approximate by
 *  up to a year, accepted in MESITA-4248). null/absent = nothing to write. */
export function parseBirthYear(
  raw: unknown,
  now: Date = new Date(),
): ParseBirthYearResult {
  if (raw === undefined || raw === null || raw === "") {
    return { ok: true, birthYear: null };
  }
  const year = typeof raw === "string" ? Number(raw) : raw;
  const thisYear = now.getUTCFullYear();
  if (
    typeof year !== "number" || !Number.isInteger(year) || year < 1900 ||
    year > thisYear
  ) {
    return {
      ok: false,
      response: json({ ok: false, error: "birth_year must be a past year" }, 400),
    };
  }
  if (thisYear - year < MIN_AGE) {
    return {
      ok: false,
      response: json(
        { ok: false, error: `You must be at least ${MIN_AGE} years old to use Mesita.` },
        400,
      ),
    };
  }
  return { ok: true, birthYear: year };
}

export type ParseFollowersEmulatedResult =
  | { ok: true; followersEmulated: number | null | undefined }
  | { ok: false; response: Response };

/** The follower emulator's write (MESITA-4662). Absent = nothing to write;
 *  null (Reset to real) is always allowed; a number must be an integer
 *  0..100,000,000 and is refused (403 emulator_live) unless payments run in
 *  Stripe test mode (`testMode` = !paymentsLivemode()). */
export function parseFollowersEmulated(raw: unknown, testMode: boolean): ParseFollowersEmulatedResult {
  if (raw === undefined) return { ok: true, followersEmulated: undefined };
  if (raw === null) return { ok: true, followersEmulated: null };
  if (!isEmulatedFollowers(raw)) {
    return {
      ok: false,
      response: json({
        ok: false,
        error: `instagram_followers_emulated must be a whole number from 0 to ${EMULATED_FOLLOWERS_MAX.toLocaleString("en-US")}, or null`,
      }, 400),
    };
  }
  if (!testMode) {
    return {
      ok: false,
      response: json({
        ok: false,
        code: "emulator_live",
        error: "The follower emulator works in test mode only",
      }, 403),
    };
  }
  return { ok: true, followersEmulated: raw };
}

export type SocialStanding = SocialFacts & { instagram_handle: string | null };

/** MESITA-4850: a minor (by the stored year) cannot leave Private, nor change
 *  the year that keeps them there; `birthYear` undefined = not in this write. */
export function privacyRefusal(
  body: UpdateProfileBody,
  stored: SocialStanding | null,
  birthYear: number | null | undefined,
  now: Date = new Date(),
): Response | null {
  const minor = stored != null && socialLock(stored.birth_year, now) === "minor";
  if (minor && birthYear !== undefined && birthYear !== stored.birth_year) {
    return json({
      ok: false,
      code: "birth_year_locked",
      error: "Your year of birth can't be changed here. Contact us if it's wrong.",
    }, 403);
  }
  const level = body.social_level;
  if (level !== undefined && !isSocialLevel(level)) {
    return json({ ok: false, error: "social_level must be private, public or instagram" }, 400);
  }
  const opens = (level !== undefined && level !== "private") || body.instagram_handle_shown === true;
  if (!opens) return null;
  // The year this write leaves behind decides, so a first year can open the profile.
  const lock = minor ? "minor" : socialLock(birthYear !== undefined ? birthYear : stored?.birth_year, now);
  if (lock === "minor") {
    return json({ ok: false, code: "minor_private", error: "Profiles of guests under 18 are always private." }, 403);
  }
  if (lock === "no_birth_year") {
    return json({ ok: false, code: "birth_year_needed", error: "Add your year of birth first." }, 409);
  }
  if (level === "instagram" || body.instagram_handle_shown === true) {
    if (!stored?.instagram_handle || !stored.instagram_verified_at) {
      return json({ ok: false, code: "instagram_needed", error: "Connect your Instagram first." }, 409);
    }
    // MESITA-4856: a typed username connects but never shares.
    if (!stored.instagram_proved_at) {
      return json({ ok: false, code: "instagram_proof_needed", error: "Prove this Instagram is yours first." }, 409);
    }
  }
  return null;
}

/** What the app shows of the guest's own privacy (MESITA-4850). */
export function socialFields(row: SocialFacts): { social_level: string; social_lock: string | null } {
  return { social_level: socialLevel(row), social_lock: socialLock(row.birth_year) };
}

export type ProfileFieldValues = {
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  sex: string | null;
  birthday: string | null;
  // undefined = not in this patch; a number = set (MESITA-4302).
  birthYear?: number | null;
  // undefined = not in this patch; null = clear; string = set.
  avatarUrl?: string | null;
  // undefined = not in this patch; null = Reset to real (MESITA-4662).
  followersEmulated?: number | null;
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
  if (fields.birthYear !== undefined) patch.birth_year = fields.birthYear;
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
  if (body.instagram_handle_shown !== undefined) {
    if (typeof body.instagram_handle_shown !== "boolean") {
      return {
        ok: false,
        response: json({ ok: false, error: "instagram_handle_shown must be true or false" }, 400),
      };
    }
    patch.instagram_handle_shown = body.instagram_handle_shown;
  }
  // Checked by privacyRefusal; the level's two flags move together.
  if (isSocialLevel(body.social_level)) {
    Object.assign(patch, levelPatch(body.social_level));
  }
  if (fields.followersEmulated !== undefined) {
    patch.instagram_followers_emulated = fields.followersEmulated;
  }

  if (Object.keys(patch).length === 0) {
    return {
      ok: false,
      response: json({ ok: false, error: "Nothing to update" }, 400),
    };
  }

  return { ok: true, patch };
}
