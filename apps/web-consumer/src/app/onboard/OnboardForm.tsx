"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { apiUpdateConsumerProfile } from "@/lib/api/profile";
import { ageFromBirthday, cn, errMsg, MIN_SIGNUP_AGE } from "@/lib/utils";
import {
  CONSUMER_SEXES,
  isConsumerSex,
  type ConsumerSex,
} from "@/lib/consumer-onboarding";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { safeNextPath } from "@/lib/auth-redirect";
import { BirthdayPicker, Spinner } from "@/components/shared";
import {
  ERROR_BOX_CLASS,
  INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@/lib/ui-classes";

// Onboarding collects THREE things beyond the phone (already on the auth.user
// from the OTP step): first name, birthday and sex. `consumer-onboarding.ts`
// carries why sex came back and why it is required (MESITA-1829); briefly, the
// Passport already printed it while nothing collected it.
//
// LAST NAME IS STILL NOT HERE, and that is not "not required". It is asked by
// ReservationSheet at the moment the guest can see why: the place books the
// table under their full name.
//
// THE SCREEN IS A DOOR, NOT A FORM (design review 2026-09-13, option C). Nine
// defects were measured on the old one; this file owns six of them:
//
//   LABELS ASK QUESTIONS.  It was `<Field label="First name">` wrapping
//     `placeholder="First name"` — the same string twice, six pixels apart.
//     The label now asks something ("What should we call you?") and the
//     placeholder is gone rather than echoing it. `Field` is not used here
//     for the same reason: its label is a muted 12px caption, which is right
//     for an edit sheet and wrong for the only three questions on a screen.
//
//   THE HINT SITS ON THE FIELD IT DEFENDS.  The birthday reassurance used to
//     render BELOW the submit button, which is past where anyone scanning has
//     stopped reading. It is the line that answers "why do you want this",
//     so it belongs against the input that raises the question.
//
//   THE BUTTON IS ANCHORED, NOT FLOATED.  `mt-auto` put it wherever the
//     column happened to end; with a third question that is mid-screen on a
//     small phone. It sits after the last question now, at a fixed rhythm.
//
// Sex is REQUIRED but deliberately does NOT wear a red asterisk while empty —
// every question here is required, so marking them all marks nothing. The
// submit button states the requirement by staying disabled, and a submit
// attempt names the specific gap.

export type OnboardInitialValues = {
  firstName: string;
  birthday: string;
  sex: string;
};

/** Same pill vocabulary as the Passport header chips (PassportBar CHIP_CLASS),
 *  grown to the 44px touch floor because this one is the primary control on
 *  the screen rather than a 36px chip in a 2x2. */
const SEX_CHIP_CLASS =
  "flex h-11 flex-1 items-center justify-center rounded-full border text-sm font-semibold transition";

export function OnboardForm({
  initial,
  // Where the guest was heading when the profile gate caught them. Null
  // for a plain sign-up, which lands on the default home tab.
  next,
}: {
  initial?: OnboardInitialValues;
  next?: string | null;
}) {
  const router = useRouter();
  const supabase = useBrowserSupabase();
  const [firstName, setFirstName] = useState(initial?.firstName ?? "");
  const [birthday, setBirthday] = useState(initial?.birthday ?? "");
  const [sex, setSex] = useState<ConsumerSex | "">(() =>
    isConsumerSex(initial?.sex) ? initial.sex : "",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = Boolean(firstName.trim() && birthday && sex);

  /** Arrow keys move between the options and select as they go, which is what
   *  the radio pattern specifies — and with two options Left and Right are the
   *  same move, so both directions just toggle. Focus follows the selection so
   *  the roving tabindex and the focus ring stay on the same control. */
  function onSexKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
    const at = CONSUMER_SEXES.findIndex((s) => s.value === sex);
    // Nothing chosen yet: the first arrow lands on an end rather than jumping
    // to the middle of nowhere.
    const nextIndex =
      at === -1
        ? step === 1
          ? 0
          : CONSUMER_SEXES.length - 1
        : (at + step + CONSUMER_SEXES.length) % CONSUMER_SEXES.length;
    setSex(CONSUMER_SEXES[nextIndex].value);
    const options =
      e.currentTarget.querySelectorAll<HTMLButtonElement>("[data-sex-option]");
    options[nextIndex]?.focus();
  }

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    // Read the name from the DOM (FormData) as the source of truth, not just
    // React state — browser autofill can populate the input without firing
    // onChange, which previously sent a null name and bounced back to
    // /onboard (the shell gate). DOM value wins, with state as the fallback.
    // The other two are tap-only, so they have no autofill path to miss.
    const fd = new FormData(e.currentTarget);
    const first = ((fd.get("first_name") as string | null) ?? firstName).trim();
    if (!first) return setError("Tell us your first name.");
    if (!birthday) return setError("Add your birthday.");
    if (!isConsumerSex(sex)) return setError("Pick one to continue.");
    // Age gate — 13 or below is restricted (MESITA-727).
    const age = ageFromBirthday(birthday);
    if (age === null || age < MIN_SIGNUP_AGE) {
      return setError(`You must be at least ${MIN_SIGNUP_AGE} to use Mesita.`);
    }

    setLoading(true);
    void (async () => {
      try {
        await apiUpdateConsumerProfile(supabase, {
          first_name: first,
          birthday,
          sex,
        });
        router.push(safeNextPath(next) ?? CONSUMER_ROUTES.discoverDefault);
        router.refresh();
      } catch (err) {
        setError(errMsg(err, "Couldn't save. Try again."));
        setLoading(false);
      }
    })();
  };

  return (
    <form onSubmit={submit} className="flex flex-1 flex-col">
      <div className="space-y-6">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold">
            What should we call you?
          </span>
          <input
            name="first_name"
            className={INPUT_CLASS}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            maxLength={60}
            autoComplete="given-name"
            required
          />
        </label>

        <div>
          <span className="mb-2 block text-sm font-semibold">
            Your birthday
          </span>
          <BirthdayPicker value={birthday} onChange={setBirthday} />
          <p className="text-muted-foreground type-label mt-2">
            Private. It checks you&apos;re {MIN_SIGNUP_AGE} or over, and sets
            the age on your Passport.
          </p>
        </div>

        {/* A real radiogroup, not two buttons that happen to look exclusive:
            arrows move the choice, the group is ONE tab stop (roving
            tabindex), and a screen reader announces "2 of 2" rather than
            reading two unrelated controls. `type="button"` matters — a bare
            <button> inside a form submits it (Docs › Design §D). */}
        <div
          role="radiogroup"
          aria-labelledby="sex-label"
          onKeyDown={onSexKeyDown}
        >
          <span id="sex-label" className="mb-2 block text-sm font-semibold">
            Sex
          </span>
          <div className="flex gap-2">
            {CONSUMER_SEXES.map(({ value, label }, i) => {
              const on = sex === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  // Roving tabindex: the checked option is the tab stop, or
                  // the first one while nothing is chosen, so Tab enters the
                  // group once and leaves it once.
                  tabIndex={on || (!sex && i === 0) ? 0 : -1}
                  data-sex-option
                  onClick={() => setSex(value)}
                  className={cn(
                    SEX_CHIP_CLASS,
                    on
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-card hover:bg-muted",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {error && <p className={cn(ERROR_BOX_CLASS, "mt-5")}>{error}</p>}

      <div className="mt-8">
        <button
          type="submit"
          disabled={loading || !ready}
          className={PRIMARY_BUTTON_CLASS}
        >
          {loading ? (
            <Spinner size="sm" className="border-white/40 border-t-white" />
          ) : (
            "Continue"
          )}
        </button>
      </div>
    </form>
  );
}
