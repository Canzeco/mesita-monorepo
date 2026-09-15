import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  CONSUMER_SEXES,
  consumerCanBrowse,
  consumerCanBook,
  firstIncompleteOnboardStep,
  isConsumerSex,
  ONBOARD_STEPS,
} from "../consumer-onboarding";
import { MIN_SIGNUP_AGE } from "../utils";

// The signup gate has FOUR hand-written copies and no shared module between
// them (the packages are independent install roots, and the EF is Deno). That
// is exactly the shape that let MESITA-1806 remove sex from /onboard while the
// Passport kept printing it for a week — a `.filter(Boolean)` display made the
// hole invisible and no test failed.
//
// So this file does two things. It pins the predicate's behaviour, and it
// greps the other three copies for the field names, which is the only check
// available across a package and runtime boundary. A source-text assertion is
// blunt, but a drifting copy here costs a user a redirect loop between
// /onboard and the shell, which is worse than blunt.

const REPO = join(__dirname, "..", "..", "..", "..", "..");
const read = (p: string) => readFileSync(join(REPO, p), "utf8");

const complete = {
  first_name: "Ana",
  last_name: "Ruiz",
  birthday: "1998-03-14",
  sex: "female",
};

describe("consumerCanBrowse — the signup gate", () => {
  it("passes only when first name, birthday AND sex are all present", () => {
    expect(consumerCanBrowse(complete)).toBe(true);
  });

  // Each field gets its own case, so a predicate that silently stops checking
  // one of them fails here rather than passing on the strength of the others.
  it.each(["first_name", "birthday", "sex"] as const)(
    "fails when %s is missing",
    (field) => {
      expect(consumerCanBrowse({ ...complete, [field]: null })).toBe(false);
    },
  );

  it("does not require the last name — that is the reservation's gate", () => {
    expect(consumerCanBrowse({ ...complete, last_name: null })).toBe(true);
    expect(consumerCanBook({ ...complete, last_name: null })).toBe(false);
  });

  it("rejects a sex value the DB constraint would not store", () => {
    // `other` was a real value until 20260825003000 nulled those rows and
    // narrowed the check. A legacy row still holding it must be sent back to
    // /onboard, not waved through into a Passport that cannot print it.
    expect(consumerCanBrowse({ ...complete, sex: "other" })).toBe(false);
    expect(isConsumerSex("other")).toBe(false);
  });

  it("offers exactly the two values the check constraint allows", () => {
    const migration = read(
      "supabase/supabase/migrations/20260825003000_consumer_plan_and_metal_classes.sql",
    );
    // The constraint is the source of truth; the UI list must not drift from
    // it in either direction.
    const constraint = /consumers_sex_check[\s\S]*?check \(([\s\S]*?)\);/.exec(
      migration,
    );
    expect(constraint).not.toBeNull();
    for (const { value } of CONSUMER_SEXES) {
      expect(constraint![1]).toContain(`'${value}'`);
    }
    expect(CONSUMER_SEXES).toHaveLength(2);
  });
});

describe("the three onboarding steps (MESITA-1830)", () => {
  it("asks first name, then birthday, then sex — the gate's own order", () => {
    expect(ONBOARD_STEPS.map((s) => s.key)).toEqual([
      "first_name",
      "birthday",
      "sex",
    ]);
    expect(ONBOARD_STEPS).toHaveLength(3);
  });

  it("gives every step a headline, and only the last one no reason", () => {
    for (const s of ONBOARD_STEPS) expect(s.headline.length).toBeGreaterThan(0);
    expect(ONBOARD_STEPS.filter((s) => s.dek === null)).toHaveLength(1);
    expect(ONBOARD_STEPS[ONBOARD_STEPS.length - 1].dek).toBeNull();
  });

  it("interpolates the age floor instead of printing a literal", () => {
    // The mockup this shipped from drew "13 or over" while the live floor is
    // 14. A literal on either screen is a lie the moment MIN_SIGNUP_AGE moves.
    const dek = ONBOARD_STEPS[1].dek ?? "";
    expect(dek).toContain(String(MIN_SIGNUP_AGE));
    expect(dek).not.toContain("13");
  });

  it("reopens on the first unanswered question", () => {
    expect(firstIncompleteOnboardStep({})).toBe(0);
    expect(firstIncompleteOnboardStep(null)).toBe(0);
    expect(firstIncompleteOnboardStep({ ...complete, first_name: null })).toBe(
      0,
    );
    expect(firstIncompleteOnboardStep({ ...complete, birthday: null })).toBe(1);
    expect(firstIncompleteOnboardStep({ ...complete, sex: null })).toBe(2);
  });

  it("agrees with the gate about what 'finished' means", () => {
    // If these two ever disagree the form opens on a step the gate does not
    // care about — or worse, reports done while the shell bounces the guest
    // back, which is the ping-pong /onboard exists to avoid.
    expect(firstIncompleteOnboardStep(complete)).toBe(ONBOARD_STEPS.length);
    expect(consumerCanBrowse(complete)).toBe(true);
    // A legacy sex value the DB would refuse is a GAP, not an answer.
    const legacy = { ...complete, sex: "other" };
    expect(consumerCanBrowse(legacy)).toBe(false);
    expect(firstIncompleteOnboardStep(legacy)).toBe(2);
  });
});

describe("the gate's other three copies", () => {
  // Not a behavioural test — a drift alarm. Each of these files re-implements
  // the predicate by hand and names all three fields when it is in lock-step.
  it.each([
    [
      "the Edge Function routing hint",
      "supabase/supabase/functions/consumer-web-signin-phone/index.ts",
      "onboarded:",
    ],
    [
      "mobile isOnboarded",
      "apps/mobile-consumer/src/lib/api/auth.ts",
      "export function isOnboarded",
    ],
  ])("%s checks first_name, birthday and sex", (_name, path, anchor) => {
    const source = read(path);
    const at = source.indexOf(anchor);
    expect(at, `${anchor} not found in ${path}`).toBeGreaterThan(-1);
    // Just the predicate body, so a mention in a nearby comment cannot make
    // this pass on its own.
    const body = source.slice(at, at + 400);
    for (const field of ["first_name", "birthday", "sex"]) {
      expect(body, `${path} stopped checking ${field}`).toContain(field);
    }
  });

  it("mirrors the three steps on mobile, with a back that works", () => {
    // The step list is the fifth hand-written copy of this shape (MESITA-1830)
    // and the only one outside this package. Same failure mode as the gate: a
    // mobile screen that quietly keeps asking all three at once diverges the
    // IA with nothing failing. Headlines only — the deks interpolate
    // MIN_SIGNUP_AGE, so their source text is a template literal on both
    // sides and cannot be compared this way.
    const source = read("apps/mobile-consumer/src/app/onboard.tsx");
    for (const { headline } of ONBOARD_STEPS) {
      expect(source, `mobile onboarding lost "${headline}"`).toContain(
        headline,
      );
    }
    // Android's hardware back has to step DOWN the flow, not leave it, and
    // the dots have to announce as one progress control.
    expect(source, "mobile back button no longer steps back").toContain(
      "BackHandler",
    );
    expect(source, "mobile progress dots are not announced").toContain(
      "progressbar",
    );
  });

  it("asks for sex on both onboarding screens", () => {
    for (const path of [
      "apps/web-consumer/src/app/onboard/OnboardForm.tsx",
      "apps/mobile-consumer/src/app/onboard.tsx",
    ]) {
      const source = read(path);
      // The gate requiring a field that no form collects is precisely the
      // failure this issue fixed; it must not come back.
      expect(source, `${path} does not collect sex`).toMatch(/\bsex\b/i);
      expect(source).toContain("radiogroup");
    }
  });
});
