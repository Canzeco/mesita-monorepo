"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { apiUpdateConsumerProfile } from "@/lib/api/profile";
import { ageFromBirthday, cn, errMsg, MIN_SIGNUP_AGE } from "@/lib/utils";
import {
  CONSUMER_SEXES,
  firstIncompleteOnboardStep,
  isConsumerSex,
  ONBOARD_STEPS,
  type ConsumerSex,
} from "@/lib/consumer-onboarding";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { safeNextPath } from "@/lib/auth-redirect";
import { BirthdayPicker, Spinner } from "@/components/shared";
import { OnboardStepBar } from "./OnboardStepBar";
import {
  ERROR_BOX_CLASS,
  INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@/lib/ui-classes";

// Onboarding collects THREE things beyond the phone (already on the auth.user
// from the OTP step): first name, birthday and sex. `consumer-onboarding.ts`
// carries why sex came back and why it is required (MESITA-1829); briefly, the
// Passport already printed it while nothing collected it. It also owns
// ONBOARD_STEPS — the field list and the step list are the same list.
//
// LAST NAME IS STILL NOT HERE, and that is not "not required". It is asked by
// ReservationSheet at the moment the guest can see why: the place books the
// table under their full name.
//
// ONE QUESTION PER SCREEN (MESITA-1830, design review option B). Three demands
// stacked on one screen is where people bail, and it left the guest no way to
// know how much was left. Each question now gets the whole viewport, a real
// headline, a reason, and a progress bar that answers "how much more of this".
//
// ONE ROUTE, LOCAL STEP STATE — not three route segments and not `?step=`.
// `page.tsx` is `force-dynamic` and refetches the profile through
// consumer-web-get-profile on every server render, so a URL-driven step would
// buy an Edge Function round trip per Continue and nothing else;
// `route-structure.test.tsx` also pins the route tree. The cost is that the
// browser's own Back leaves /onboard rather than stepping back — which is
// self-healing, because the shell gate bounces an incomplete profile straight
// back here and the flow reopens on the first unanswered question.
//
// EACH STEP PERSISTS AS IT IS ANSWERED. Three EF calls instead of one, and it
// is the whole reason "a half-finished flow resumes where it stopped" is true
// rather than merely looking true. No backend change was needed:
// consumer-web-update-profile patches only the keys a request carries and
// merges the absent name half from the stored row.
//
// THE BUTTON SITS AT THE BOTTOM (`mt-auto`). Option C deliberately removed
// `mt-auto` because with three questions of wildly different heights it put
// the button wherever the column happened to end. With one question per screen
// that reverses: bottom-anchored is the only position that does not MOVE
// between step 1 and step 3, so the thumb stays where it was.
//
// PRESERVED FROM THE ONE-SCREEN VERSION, all still load-bearing: the
// FormData-over-state read of the name (autofill populates the input without
// firing onChange, which used to send a null name), the roving-tabindex
// radiogroup for sex, the age check against MIN_SIGNUP_AGE, and the rule that
// nothing wears a red asterisk — every question here is required, so marking
// them all marks nothing. The disabled button states the requirement and a
// submit attempt names the specific gap.

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
  // LAZY on purpose: the client is only needed when a Continue fires, so a
  // render — including this component's unit test — never touches env vars.
  const getSupabase = useLazyBrowserSupabase();
  const [firstName, setFirstName] = useState(initial?.firstName ?? "");
  const [birthday, setBirthday] = useState(initial?.birthday ?? "");
  const [sex, setSex] = useState<ConsumerSex | "">(() =>
    isConsumerSex(initial?.sex) ? initial.sex : "",
  );
  // Resume point. Clamped to the last step because a profile that answers all
  // three never reaches this component (page.tsx redirects it), and an index
  // past the end would render nothing at all if it ever did.
  const [step, setStep] = useState(() =>
    Math.min(
      firstIncompleteOnboardStep({
        first_name: initial?.firstName,
        birthday: initial?.birthday,
        sex: initial?.sex,
      }),
      ONBOARD_STEPS.length - 1,
    ),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = ONBOARD_STEPS[step];
  const last = step === ONBOARD_STEPS.length - 1;

  // Only the CURRENT question gates the button. The others are either already
  // written or not yet asked.
  const ready =
    current.key === "first_name"
      ? Boolean(firstName.trim())
      : current.key === "birthday"
        ? Boolean(birthday)
        : isConsumerSex(sex);

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

  /** Write ONE field, then advance — or, on the last step, leave for the app.
   *  `loading` deliberately stays true through the final navigation, so the
   *  button cannot be pressed twice while the route transition runs. */
  function persist(patch: {
    first_name?: string;
    birthday?: string;
    sex?: ConsumerSex;
  }) {
    setLoading(true);
    void (async () => {
      try {
        await apiUpdateConsumerProfile(getSupabase(), patch);
        if (last) {
          router.push(safeNextPath(next) ?? CONSUMER_ROUTES.discoverDefault);
          router.refresh();
          return;
        }
        setStep((s) => s + 1);
        setLoading(false);
      } catch (err) {
        setError(errMsg(err, "Couldn't save. Try again."));
        setLoading(false);
      }
    })();
  }

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (current.key === "first_name") {
      // Read the name from the DOM (FormData) as the source of truth, not just
      // React state — browser autofill can populate the input without firing
      // onChange, which previously sent a null name and bounced back to
      // /onboard (the shell gate). DOM value wins, with state as the fallback.
      // The other two are tap-only, so they have no autofill path to miss.
      const fd = new FormData(e.currentTarget);
      const first = (
        (fd.get("first_name") as string | null) ?? firstName
      ).trim();
      if (!first) return setError("Tell us your first name.");
      setFirstName(first);
      return persist({ first_name: first });
    }

    if (current.key === "birthday") {
      if (!birthday) return setError("Add your birthday.");
      // Age gate — 13 or below is restricted (MESITA-727).
      const age = ageFromBirthday(birthday);
      if (age === null || age < MIN_SIGNUP_AGE) {
        return setError(
          `You must be at least ${MIN_SIGNUP_AGE} to use Mesita.`,
        );
      }
      return persist({ birthday });
    }

    if (!isConsumerSex(sex)) return setError("Pick one to continue.");
    return persist({ sex });
  };

  return (
    <form onSubmit={submit} className="flex flex-1 flex-col">
      <OnboardStepBar
        step={step}
        total={ONBOARD_STEPS.length}
        onBack={() => {
          setError(null);
          setStep((s) => Math.max(0, s - 1));
        }}
      />

      {/* The headline changes per step, so it lives here rather than in
          page.tsx — the question IS the heading, not a caption above one. */}
      <h1 className="font-display text-3xl leading-tight font-semibold tracking-tight">
        {current.headline}
      </h1>
      {current.dek ? (
        <p className="text-muted-foreground mt-2 text-sm">{current.dek}</p>
      ) : null}

      <div className="mt-8">
        {current.key === "first_name" ? (
          <input
            name="first_name"
            className={INPUT_CLASS}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            maxLength={60}
            autoComplete="given-name"
            aria-label={current.headline}
            required
          />
        ) : null}

        {current.key === "birthday" ? (
          <>
            <BirthdayPicker value={birthday} onChange={setBirthday} />
            {/* The reassurance sits on the field it defends, not below the
                button, which is past where anyone scanning has stopped. */}
            <p className="text-muted-foreground type-body mt-3">
              Nobody sees it. It sets the age on your Passport.
            </p>
          </>
        ) : null}

        {/* A real radiogroup, not two buttons that happen to look exclusive:
            arrows move the choice, the group is ONE tab stop (roving
            tabindex), and a screen reader announces "2 of 2" rather than
            reading two unrelated controls. `type="button"` matters — a bare
            <button> inside a form submits it (Docs › Design §D). The group
            carries an aria-label because its visible heading is now "Last
            one.", which names the step and not the question. */}
        {current.key === "sex" ? (
          <div role="radiogroup" aria-label="Sex" onKeyDown={onSexKeyDown}>
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
        ) : null}
      </div>

      {error && <p className={cn(ERROR_BOX_CLASS, "mt-5")}>{error}</p>}

      <div className="mt-auto pt-8">
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
