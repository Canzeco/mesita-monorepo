/**
 * How an admin surface names a consumer.
 *
 * Aura is granted by hand, so the console must accept whatever the operator
 * actually has: a uuid pasted out of the DB, the 8-digit consumer code off a
 * QR, a phone number, an Instagram handle, or just a name. This module only
 * CLASSIFIES the string — the caller runs the matching query, because only it
 * knows which client (service-role vs anon) and which ambiguity policy apply.
 *
 * Numeric input is the one genuinely ambiguous case, and the shapes settle it:
 * a consumer code is exactly 8 digits (`0000-0000`, per
 * `normalize_consumer_code_input`), while a dialable phone carries a `+` or
 * runs 9+ digits. Anything numeric that is neither is refused rather than
 * guessed at.
 */

import { normalizePhoneE164, phoneDigits } from "./phone.ts";

export type ConsumerLookup =
  /** A consumers.id uuid. */
  | { kind: "id"; value: string }
  /** A consumers.code, canonicalised to `0000-0000`. */
  | { kind: "code"; value: string }
  /** A phone in E.164 — match loosely (last 10 digits), numbers get re-typed. */
  | { kind: "phone"; value: string }
  /** An explicit `@handle` or instagram.com URL — match instagram_handle exactly. */
  | { kind: "handle"; value: string }
  /** Free text — match a name OR a bare handle; the caller decides which wins. */
  | { kind: "text"; value: string };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Digits plus the punctuation people type into phone fields. */
const NUMERICISH_RE = /^[0-9+()\-.\s]+$/;
const IG_URL_RE = /^(?:https?:\/\/)?(?:www\.)?instagram\.com\/([^/?#\s]+)/i;

/** `@Pato_` / `instagram.com/pato` → `pato`; null when it isn't a handle. */
export function normalizeInstagramHandle(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const fromUrl = s.match(IG_URL_RE);
  const bare = (fromUrl ? fromUrl[1] : s).replace(/^@+/, "").trim()
    .toLowerCase();
  return /^[a-z0-9._]{1,30}$/.test(bare) ? bare : null;
}

export function classifyConsumerLookup(raw: unknown): ConsumerLookup | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;

  if (UUID_RE.test(s)) return { kind: "id", value: s.toLowerCase() };

  if (s.startsWith("@") || IG_URL_RE.test(s)) {
    const handle = normalizeInstagramHandle(s);
    return handle ? { kind: "handle", value: handle } : null;
  }

  if (NUMERICISH_RE.test(s)) {
    const digits = phoneDigits(s);
    // A code never carries a country prefix, so a leading `+` rules it out.
    if (!s.includes("+") && digits.length === 8) {
      return {
        kind: "code",
        value: `${digits.slice(0, 4)}-${digits.slice(4)}`,
      };
    }
    const e164 = normalizePhoneE164(s);
    return e164 ? { kind: "phone", value: e164 } : null;
  }

  return { kind: "text", value: s.replace(/\s+/g, " ") };
}

/**
 * The last 10 digits of a phone — the national number, which is what
 * `phonesMatch` compares and what a suffix `ilike` can match in SQL. Shorter
 * numbers are returned whole rather than padded.
 */
export function phoneDigitsTail(e164: string): string {
  return phoneDigits(e164).slice(-10);
}

/**
 * PostgREST reads `or=(...)` as a comma-separated list, so a value carrying
 * `,` `(` `)` or `.` would split the filter apart. Strip them — a name search
 * loses nothing real, and the alternative is a malformed query.
 */
export function safeOrFilterValue(value: string): string {
  return value.replace(/[,()."\\]/g, " ").replace(/\s+/g, " ").trim();
}

/** The consumer columns every admin identity surface reads. */
export const CONSUMER_SUMMARY_COLUMNS =
  "id, code, full_name, first_name, last_name, phone, instagram_handle, instagram_followers_count, class_key, class_origin, class_granted_at, invitation_class_key, invitation_granted_at";

export type ConsumerSummary = {
  id: string;
  code: string | null;
  name: string | null;
  phone: string | null;
  instagramHandle: string | null;
  followers: number | null;
  classKey: string | null;
  classOrigin: string | null;
  grantedAt: string | null;
  /** Invitation door fact (MESITA-972) — the Aura roster keys off this. */
  invitationClassKey: string | null;
  invitationGrantedAt: string | null;
};

type ConsumerRow = Record<string, unknown>;

function str(v: unknown): string | null {
  const s = v == null ? "" : String(v).trim();
  return s.length > 0 ? s : null;
}

/** Best available display name: full_name, else the first/last pair. */
export function consumerDisplayName(row: ConsumerRow): string | null {
  const full = str(row.full_name);
  if (full) return full;
  const pair = [str(row.first_name), str(row.last_name)].filter(Boolean)
    .join(" ");
  return pair.length > 0 ? pair : null;
}

export function toConsumerSummary(row: ConsumerRow): ConsumerSummary {
  const followers = row.instagram_followers_count;
  return {
    id: String(row.id),
    code: str(row.code),
    name: consumerDisplayName(row),
    phone: str(row.phone),
    instagramHandle: str(row.instagram_handle),
    followers: typeof followers === "number" ? followers : null,
    classKey: str(row.class_key),
    classOrigin: str(row.class_origin),
    grantedAt: str(row.class_granted_at),
    invitationClassKey: str(row.invitation_class_key),
    invitationGrantedAt: str(row.invitation_granted_at),
  };
}

/** What the operator typed, echoed back in errors so the miss is legible. */
export function describeLookup(lookup: ConsumerLookup): string {
  switch (lookup.kind) {
    case "id":
      return `id ${lookup.value}`;
    case "code":
      return `code ${lookup.value}`;
    case "phone":
      return `phone ${lookup.value}`;
    case "handle":
      return `@${lookup.value}`;
    case "text":
      return `"${lookup.value}"`;
  }
}

/** A one-line label for a candidate row, used when a lookup is ambiguous. */
export function candidateLabel(row: ConsumerRow): string {
  const name = consumerDisplayName(row) ?? "Unnamed";
  const handle = str(row.instagram_handle);
  const code = str(row.code);
  const tail = [handle ? `@${handle}` : null, code].filter(Boolean).join(" · ");
  return tail ? `${name} (${tail})` : name;
}
