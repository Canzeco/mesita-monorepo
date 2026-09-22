import { describe, expect, it } from "vitest";

import {
  MRZ_LINE_LENGTH,
  buildMrz,
  completionLine,
  formatDocumentDate,
  mrzCheckDigit,
  mrzTransliterate,
  passportFields,
} from "../passport-document";

// THE MRZ IS THE ONE PART OF THE PASSPORT A MACHINE CAN FALSIFY (MESITA-1820).
//
// Consumer web is OTP-gated and has no visual QA path, so the document's
// correctness has to be a unit contract. The whole file obeys one rule:
//
//   EVERY EXPECTED STRING BELOW IS TYPED BY HAND.
//
// Not one expectation calls `mrzCheckDigit` or `buildMrz` to compute what
// `buildMrz` should return. That is the vacuous-route-tests trap — deriving
// the expectation from the function under test proves the function equals
// itself and nothing else, which hid a live 404 in this repo for months. The
// literals here were computed by an INDEPENDENT ICAO 9303 implementation and
// pasted in; if the module changes, this file must be re-derived the same way,
// never by pasting the new output back in.

const ADA = {
  code: "1234-5678",
  firstName: "José María",
  lastName: "Pérez-Gómez",
  birthday: "1996-03-14",
  sex: "female",
  nationality: "MEX",
  standing: "MEMBER",
};

describe("the MRZ is two real TD3 lines", () => {
  it("is exactly 2 lines of exactly 44 characters, for a full profile", () => {
    const lines = buildMrz(ADA);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toHaveLength(MRZ_LINE_LENGTH);
    expect(lines[1]).toHaveLength(MRZ_LINE_LENGTH);
  });

  it("prints the literal lines ICAO 9303 says it should", () => {
    // Line 1: PM (document code) + MTA (issuing state) + SURNAME<<GIVEN NAMES.
    // José María Pérez-Gómez folds to JOSE MARIA PEREZ GOMEZ: the accents are
    // stripped, the hyphen and the spaces become fillers.
    // Line 2: 1234<5678 | 0 | MEX | 960314 | 9 | F | <<<<<< | < | MEMBER… | 4 | 6
    expect(buildMrz(ADA)).toEqual([
      "PMMTAPEREZ<GOMEZ<<JOSE<MARIA<<<<<<<<<<<<<<<<",
      "1234<56780MEX9603149F<<<<<<<MEMBER<<<<<<<<46",
    ]);
  });

  it("prints the literal lines for a second, unrelated guest", () => {
    // A second hand-computed pair, because one pair can be a lucky constant.
    expect(
      buildMrz({
        code: "9999-9999",
        firstName: "Ana",
        lastName: "Lopez",
        birthday: "2001-12-31",
        sex: "male",
        nationality: "USA",
        standing: "DIAMOND",
      }),
    ).toEqual([
      "PMMTALOPEZ<<ANA<<<<<<<<<<<<<<<<<<<<<<<<<<<<<",
      "9999<99990USA0112318M<<<<<<<DIAMOND<<<<<<<58",
    ]);
  });

  it("still yields a well-formed document for a profile with nothing but a code", () => {
    // The EMPTY state of the state table: a guest who has just been assigned a
    // member number and has filled in nothing else still gets a document, not
    // a crash and not a short line.
    const lines = buildMrz({ code: "0000-0001" });
    expect(lines[0]).toHaveLength(MRZ_LINE_LENGTH);
    expect(lines[1]).toHaveLength(MRZ_LINE_LENGTH);
    expect(lines).toEqual([
      "PMMTA<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<",
      "0000<00011<<<<<<<<<0<<<<<<<<<<<<<<<<<<<<<<08",
    ]);
  });

  it("survives a profile with no code at all", () => {
    const lines = buildMrz({});
    expect(lines[0]).toHaveLength(MRZ_LINE_LENGTH);
    expect(lines[1]).toHaveLength(MRZ_LINE_LENGTH);
  });

  it("pads with `<` and NEVER with a space", () => {
    // A space in an MRZ breaks every parser and silently changes the check
    // digits. This is the assertion that catches a well-meaning `padEnd(n)`.
    for (const line of buildMrz({ code: "0000-0001" })) {
      expect(line).not.toContain(" ");
      expect(line).toMatch(/^[A-Z0-9<]+$/);
    }
    for (const line of buildMrz(ADA)) {
      expect(line).not.toContain(" ");
      expect(line).toMatch(/^[A-Z0-9<]+$/);
    }
  });

  it("truncates a very long name instead of overflowing the line", () => {
    const lines = buildMrz({
      code: "1111-2222",
      firstName: "Maria Fernanda Guadalupe Inmaculada",
      lastName: "De La Torre Y Villaseñor Del Castillo",
    });
    expect(lines[0]).toHaveLength(MRZ_LINE_LENGTH);
    expect(lines[0].startsWith("PMMTADE<LA<TORRE<Y<VILLASENOR<DEL<CAST")).toBe(
      true,
    );
  });
});

describe("the 7-3-1 check digit", () => {
  // Hand-computed against the ICAO 9303 Part 4 worked examples and by hand for
  // the Mesita-shaped inputs. `<` is 0, A is 10, Z is 35, weights cycle 7-3-1.
  it.each([
    ["D23145890734", "9"],
    ["3407127", "6"],
    ["1234<5678", "0"],
    ["960314", "9"],
    ["<<<<<<", "0"],
    ["", "0"],
  ])("mrzCheckDigit(%s) is %s", (input, expected) => {
    expect(mrzCheckDigit(input)).toBe(expected);
  });
});

describe("transliteration folds a real name onto A-Z", () => {
  it.each([
    ["José", "JOSE"],
    ["Peña", "PENA"],
    ["Pérez-Gómez", "PEREZ<GOMEZ"],
    ["O'Brien", "O<BRIEN"],
    ["Ünal", "UNAL"],
    ["", ""],
  ])("%s → %s", (input, expected) => {
    expect(mrzTransliterate(input)).toBe(expected);
  });
});

describe("the field grid splits guest-fillable from server-owed", () => {
  it("prints six rows in passport order", () => {
    const { fields } = passportFields(ADA);
    expect(fields.map((f) => f.id)).toEqual([
      "code",
      "surname",
      "given",
      "nationality",
      "birth",
      "sex",
    ]);
  });

  it("never counts MEMBER No. as missing, even when it is missing", () => {
    // The rule, not a per-field decision: a server-owed blank says `pending`,
    // carries no prompt and is never counted — nobody taps a blank that was
    // never theirs to fill.
    const { fields, missing } = passportFields({});
    expect(fields.find((f) => f.id === "code")?.value).toBeNull();
    expect(fields.find((f) => f.id === "code")?.owner).toBe("server");
    expect(missing.map((f) => f.id)).not.toContain("code");
    expect(missing.map((f) => f.id)).toEqual([
      "surname",
      "given",
      "nationality",
      "birth",
      "sex",
    ]);
  });

  it("counts exactly what is missing on a partial profile", () => {
    const { missing } = passportFields({
      code: "1234-5678",
      firstName: "Ana",
      nationality: "MEX",
    });
    expect(missing.map((f) => f.id)).toEqual(["surname", "birth", "sex"]);
  });

  it("has nothing to say once the profile is complete", () => {
    expect(passportFields(ADA).missing).toEqual([]);
    expect(completionLine(0)).toBeNull();
  });

  it("phrases the completion line in plain English, singular and plural", () => {
    expect(completionLine(1)).toBe("1 field left to fill");
    expect(completionLine(3)).toBe("3 fields left to fill");
  });
});

describe("the document date", () => {
  it.each([
    ["1996-03-14", "14 MAR 1996"],
    ["2001-12-31", "31 DEC 2001"],
    ["1970-01-01", "01 JAN 1970"],
  ])("%s prints as %s", (input, expected) => {
    expect(formatDocumentDate(input)).toBe(expected);
  });

  it("is null when there is no date, rather than printing Invalid Date", () => {
    expect(formatDocumentDate(null)).toBeNull();
    expect(formatDocumentDate("")).toBeNull();
    expect(formatDocumentDate("not-a-date")).toBeNull();
    expect(formatDocumentDate("1996-13-14")).toBeNull();
  });
});
