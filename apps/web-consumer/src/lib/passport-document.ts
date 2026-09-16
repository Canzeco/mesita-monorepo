// THE PASSPORT IS A DOCUMENT, SO IT HAS A DATA PAGE (MESITA-1820).
//
// This module is the data page's brain and it is PURE: no React, no Next, no
// Supabase, no Tailwind. Web (`components/consumer/me/PassportModal.tsx`) and
// mobile (`apps/mobile-consumer/src/lib/passport-document.ts`, a byte-for-byte
// port) both render off it, so the two platforms cannot print different
// documents for the same guest — consumer IA cannot diverge.
//
// NOTHING NEW IS FETCHED. Every value below is already on the profile
// `consumer-web-get-profile` returns (code, first_name, last_name, sex,
// birthday, country, phone). No EF, no migration, no new column.
//
// THE MRZ IS DECORATIVE-BUT-HONEST. Two real 44-character ICAO 9303 TD3 lines
// with real 7-3-1 check digits, so a curious guest who types them into a
// public MRZ parser gets their own name back instead of gibberish. It is
// `aria-hidden` on both platforms: 44 characters of `<` read aloud is hostile
// and the field grid above already announces every fact it encodes.

/** A TD3 line is exactly this long. Both of them. */
export const MRZ_LINE_LENGTH = 44;
/** ICAO's filler. A SPACE IS NOT A FILLER — a space breaks the check digits
 *  and every parser on earth. Pinned by passport-document.test.ts. */
export const MRZ_FILLER = "<";
/** Document code. `P` = passport, `M` = Mesita. Cut from the field grid in
 *  MESITA-1820 (D3) because it printed the same two letters for every guest
 *  forever; it survives here, encoded. */
export const MRZ_DOCUMENT_CODE = "PM";
/** Issuing "state". Same story as above — `MTA` left the grid, not the doc. */
export const MRZ_ISSUING_STATE = "MTA";
/** The name field on line 1: 44 minus `PM` minus `MTA`. */
const MRZ_NAME_LENGTH = MRZ_LINE_LENGTH - 5;
/** Line 2's optional-data field, which carries the class metal. */
const MRZ_OPTIONAL_LENGTH = 14;

export type PassportDocumentInput = {
  /** `consumers.code`, canonical form `0000-0000`. */
  code?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  /** ISO `YYYY-MM-DD` as the EF returns it. */
  birthday?: string | null;
  /** `consumers.sex` — 'male' | 'female' | anything else. */
  sex?: string | null;
  /** ISO 3166-1 alpha-3, resolved by the CALLER from the phone dial code
   *  (see COUNTRIES.iso3). Passed in rather than derived here so this module
   *  stays free of the country table and of `phoneCountry`'s platform copy. */
  nationality?: string | null;
  /** The class metal the card's own band is printing — "Bronze" | "Silver" |
   *  "Gold" | "Diamond", or null when the class failed to load.
   *
   *  WHY THE LABEL AND NOT THE KEY (decision, MESITA-1820): web speaks the
   *  metals (bronze/silver/gold/diamond) and mobile still speaks the legacy
   *  keys (standard/influencer/premium/aura), and the two bridge tables do
   *  NOT agree on `premium` — web's LEGACY_CLASS_IDENTITY maps it to bronze,
   *  mobile's CLASSES labels it Gold. Encoding the key would make the MRZ
   *  contradict the band printed two centimetres above it on the same card.
   *  Encoding the label the card already renders makes that impossible. */
  classLabel?: string | null;
};

/**
 * ICAO 9303 transliteration: uppercase, diacritics folded onto their base
 * letter (JOSÉ → JOSE), and every remaining character that is not A-Z or 0-9
 * replaced by the filler. `Ñ` folds to `N`, `-` and `'` and spaces all become
 * `<`, exactly as a real machine-readable zone does.
 */
export function mrzTransliterate(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, MRZ_FILLER);
}

/** Transliterate, truncate and right-pad with the filler to exactly `length`. */
export function mrzPad(value: string | null | undefined, length: number): string {
  return mrzTransliterate(value).slice(0, length).padEnd(length, MRZ_FILLER);
}

/**
 * The ICAO 7-3-1 check digit. Digits count as themselves, A-Z as 10-35, the
 * filler as 0; weights cycle 7, 3, 1; the answer is the sum mod 10.
 */
export function mrzCheckDigit(input: string): string {
  const weights = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    let value: number;
    if (ch >= "0" && ch <= "9") value = ch.charCodeAt(0) - 48;
    else if (ch >= "A" && ch <= "Z") value = ch.charCodeAt(0) - 55;
    else value = 0;
    sum += value * weights[i % 3];
  }
  return String(sum % 10);
}

/** `YYYY-MM-DD` → `YYMMDD`, or six fillers when absent or unparseable. */
export function mrzDate(birthday: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(birthday ?? "");
  if (!m) return MRZ_FILLER.repeat(6);
  return `${m[1].slice(2)}${m[2]}${m[3]}`;
}

/** 'male' → M, 'female' → F, anything else → the filler (ICAO's "unspecified"). */
export function mrzSex(sex: string | null | undefined): string {
  const s = (sex ?? "").trim().toLowerCase();
  if (s === "male" || s === "m") return "M";
  if (s === "female" || s === "f") return "F";
  return MRZ_FILLER;
}

/**
 * The two TD3 lines, each exactly 44 characters.
 *
 * Line 1: `PM` + `MTA` + SURNAME + `<<` + GIVEN NAMES, filler-padded to 44.
 * Line 2: document number (9) + its check digit + nationality (3) + birth
 * date (6) + its check digit + sex + expiry (6) + its check digit + optional
 * data (14) + its check digit + the composite check digit.
 *
 * EXPIRY IS SIX FILLERS AND ITS CHECK DIGIT IS A FILLER TOO (decision,
 * MESITA-1820): a Mesita passport does not expire, and ICAO reserves exactly
 * this spelling for a field that carries no date. A literal `0` there would
 * read as a real check digit over a real (empty) date.
 */
export function buildMrz(input: PassportDocumentInput): [string, string] {
  const surname = mrzTransliterate(input.lastName);
  const given = mrzTransliterate(input.firstName);
  // The `<<` separator is built BEFORE the pad so truncation cuts the given
  // names, not the separator. Re-transliterating it is a no-op: the filler is
  // already the character every non-alphanumeric maps to.
  const nameField = mrzPad(
    surname || given ? `${surname}${MRZ_FILLER}${MRZ_FILLER}${given}` : "",
    MRZ_NAME_LENGTH,
  );
  const line1 = `${MRZ_DOCUMENT_CODE}${MRZ_ISSUING_STATE}${nameField}`;

  const docNumber = mrzPad(input.code, 9);
  const docCheck = mrzCheckDigit(docNumber);
  const nationality = mrzPad(input.nationality, 3);
  const birth = mrzDate(input.birthday);
  const birthCheck = mrzCheckDigit(birth);
  const sex = mrzSex(input.sex);
  const expiry = MRZ_FILLER.repeat(6);
  const expiryCheck = MRZ_FILLER;
  const optional = mrzPad(input.classLabel, MRZ_OPTIONAL_LENGTH);
  const optionalCheck = mrzCheckDigit(optional);

  const composite = mrzCheckDigit(
    `${docNumber}${docCheck}${birth}${birthCheck}${expiry}${expiryCheck}${optional}${optionalCheck}`,
  );

  const line2 =
    `${docNumber}${docCheck}${nationality}${birth}${birthCheck}${sex}` +
    `${expiry}${expiryCheck}${optional}${optionalCheck}${composite}`;

  return [line1, line2];
}

/** Who owes the field. The split is the RULE, not a per-field decision
 *  (MESITA-1820): a guest-fillable blank prints `—` and is counted; a
 *  server-owed blank prints `pending`, carries no prompt and is never counted
 *  — nobody taps a blank that was never theirs to fill. */
export type PassportFieldOwner = "guest" | "server";

export type PassportField = {
  /** Stable id for keys and tests. Never rendered. */
  id: "code" | "surname" | "given" | "nationality" | "birth" | "sex";
  /** Uppercase grid label, rendered verbatim. */
  label: string;
  /** null = missing. The renderer decides `—` vs `pending` off `owner`. */
  value: string | null;
  owner: PassportFieldOwner;
};

const MONTHS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

/** `YYYY-MM-DD` → `14 MAR 1996`, the form a data page prints. Null when the
 *  date is absent or unparseable. Deliberately NOT `toLocaleDateString`: a
 *  passport prints one spelling everywhere, and the month abbreviation has to
 *  survive a guest whose browser locale is not English. */
export function formatDocumentDate(
  birthday: string | null | undefined,
): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(birthday ?? "");
  if (!m) return null;
  const month = MONTHS[Number(m[2]) - 1];
  if (!month) return null;
  return `${m[3]} ${month} ${m[1]}`;
}

/** The face of the document: the six rows in passport order, plus the count
 *  of guest-fillable blanks the completion line reports. */
export function passportFields(input: PassportDocumentInput): {
  fields: PassportField[];
  missing: PassportField[];
} {
  const surname = input.lastName?.trim() || null;
  const given = input.firstName?.trim() || null;
  const sexValue = mrzSex(input.sex);
  const fields: PassportField[] = [
    // MEMBER No. is SERVER-OWED: `generate_consumer_code()` assigns it on the
    // first profile read. It is the only print of `consumers.code` and it is
    // never counted as missing.
    { id: "code", label: "Member No.", value: input.code || null, owner: "server" },
    { id: "surname", label: "Surname", value: surname, owner: "guest" },
    { id: "given", label: "Given names", value: given, owner: "guest" },
    {
      id: "nationality",
      label: "Nationality",
      value: input.nationality || null,
      owner: "guest",
    },
    {
      id: "birth",
      label: "Date of birth",
      value: formatDocumentDate(input.birthday),
      owner: "guest",
    },
    {
      id: "sex",
      label: "Sex",
      value: sexValue === MRZ_FILLER ? null : sexValue,
      owner: "guest",
    },
  ];
  return {
    fields,
    missing: fields.filter((f) => f.owner === "guest" && f.value === null),
  };
}

/** The completion line's copy. Null once nothing is missing — the line is
 *  conditional and SELF-DELETING, which is why it is not the permanent third
 *  door MESITA-1801 banned.
 *
 *  IT IS TEXT, NOT A LINK (decision, MESITA-1820). The issue asked for a
 *  "Complete" link to Me › Profile beside the count. `passport-axes.test.ts`
 *  pins this file's href list to exactly ["class", "instagram"] and bans the
 *  string `CONSUMER_ROUTES.mePages.profile` outright, and those two guards are
 *  MESITA-1801's law, not this issue's to spend. The count alone still tells
 *  the guest what is missing; Me › Profile is one tap away via Back. */
export function completionLine(missingCount: number): string | null {
  if (missingCount <= 0) return null;
  return missingCount === 1
    ? "1 field left to fill"
    : `${missingCount} fields left to fill`;
}
