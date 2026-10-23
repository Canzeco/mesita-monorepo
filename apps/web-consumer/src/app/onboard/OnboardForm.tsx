"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { apiUpdateConsumerProfile } from "@/lib/api/profile";
import { ageFromBirthday, cn, errMsg, MIN_SIGNUP_AGE } from "@/lib/utils";
import {
  CONSUMER_SEXES,
  isConsumerSex,
  ONBOARD_FIELDS,
  ONBOARD_PAGE_DEK,
  ONBOARD_PAGE_HEADLINE,
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
// carries why sex came back and why it is required (MESITA-1829); briefly, a
// profile surface printed it while nothing collected it. It also owns
// ONBOARD_FIELDS — the field list the gate checks and the form renders.
//
// LAST NAME IS STILL NOT HERE, and that is not "not required". It is asked by
// ReservationSheet at the moment the guest can see why: the place books the
// table under their full name.
//
// ONE SCREEN (MESITA-2746): first name, birthday and sex together. A
// returning half-finished profile prefills what is already stored; one
// Continue writes whatever is still missing (usually all three at once).
//
// PRESERVED FROM EARLIER VERSIONS, all still load-bearing: the FormData-over-
// state read of the name (autofill populates the input without firing
// onChange, which used to send a null name), the roving-tabindex radiogroup
// for sex, the age check against MIN_SIGNUP_AGE, and the rule that nothing
// wears a red asterisk — every question here is required, so marking them all
// marks nothing. The disabled button states the requirement and a submit
// attempt names the specific gap.

export type OnboardInitialValues = {
  firstName: string;
  birthday: string;
  sex: string;
};

/** Same pill vocabulary as Me's header chips (IdentityBar CHIP_CLASS),
 *  grown to the 44px touch floor because this one is the primary control on
 *  the screen rather than a 36px chip in a 2x2. */
const SEX_CHIP_CLASS =
  "flex h-11 flex-1 items-center justify-center rounded-full border text-sm font-semibold transition";

const FIELD_LABEL_CLASS =
  "text-muted-foreground type-label mb-1 block font-medium";

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
  // LAZY on purpose: the client is only needed when Continue fires, so a
  // render — including this component's unit test — never touches env vars.
  const getSupabase = useLazyBrowserSupabase();
  const [firstName, setFirstName] = useState(initial?.firstName ?? "");
  const [birthday, setBirthday] = useState(initial?.birthday ?? "");
  const [sex, setSex] = useState<ConsumerSex | "">(() =>
    isConsumerSex(initial?.sex) ? initial.sex : "",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const birthdayField = ONBOARD_FIELDS.find((f) => f.key === "birthday");

  const ready =
    Boolean(firstName.trim()) && Boolean(birthday) && isConsumerSex(sex);

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
    setError(null);
    const options =
      e.currentTarget.querySelectorAll<HTMLButtonElement>("[data-sex-option]");
    options[nextIndex]?.focus();
  }

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const fd = new FormData(e.currentTarget);
    const first = (
      (fd.get("first_name") as string | null) ?? firstName
    ).trim();
    if (!first) return setError("Tell us your first name.");
    if (!birthday) return setError("Add your birthday.");
    const age = ageFromBirthday(birthday);
    if (age === null || age < MIN_SIGNUP_AGE) {
      return setError(`You must be at least ${MIN_SIGNUP_AGE} to use Mesita.`);
    }
    if (!isConsumerSex(sex)) return setError("Pick one to continue.");

    setFirstName(first);
    setLoading(true);
    void (async () => {
      try {
        await apiUpdateConsumerProfile(getSupabase(), {
          first_name: first,
          birthday,
          sex,
        });
        router.push(safeNextPath(next) ?? CONSUMER_ROUTES.home);
        router.refresh();
      } catch (err) {
        setError(errMsg(err, "Couldn't save. Try again."));
        setLoading(false);
      }
    })();
  };

  return (
    <form onSubmit={submit} className="flex flex-1 flex-col">
      <h1
        className="font-display text-3xl leading-tight font-semibold tracking-tight"
      >
        {ONBOARD_PAGE_HEADLINE}
      </h1>
      <p className="text-muted-foreground mt-2 text-sm">{ONBOARD_PAGE_DEK}</p>

      <div className="mt-8 flex flex-col gap-6">
        <div>
          <label htmlFor="onboard-first-name" className={FIELD_LABEL_CLASS}>
            {ONBOARD_FIELDS[0].label}
          </label>
          <input
            id="onboard-first-name"
            name="first_name"
            className={INPUT_CLASS}
            value={firstName}
            onChange={(e) => {
              setFirstName(e.target.value);
              setError(null);
            }}
            maxLength={60}
            autoComplete="given-name"
            required
          />
        </div>

        <div>
          <span className={FIELD_LABEL_CLASS}>
            {ONBOARD_FIELDS[1].label}
          </span>
          <BirthdayPicker
            value={birthday}
            onChange={(v) => {
              setBirthday(v);
              setError(null);
            }}
          />
          {birthdayField?.hint ? (
            <p className="text-muted-foreground type-body mt-3">
              Nobody sees it. It confirms you&apos;re old enough for Mesita.
            </p>
          ) : null}
        </div>

        <div>
          <span className={FIELD_LABEL_CLASS}>{ONBOARD_FIELDS[2].label}</span>
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
                    tabIndex={on || (!sex && i === 0) ? 0 : -1}
                    data-sex-option
                    onClick={() => {
                      setSex(value);
                      setError(null);
                    }}
                    className={cn(
                      SEX_CHIP_CLASS,
                      on
                        ? "border-foreground bg-foreground text-paper"
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
