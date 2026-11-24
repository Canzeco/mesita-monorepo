"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { apiSetInstagram, apiUpdateConsumerProfile } from "@/lib/api/profile";
import { InstagramHandleField } from "@/components/consumer/me/InstagramHandleField";
import { Switch } from "@/components/consumer/me/settings-rows";
import { normalizeInstagramHandle } from "@/lib/instagram-handle";
import { cn, errMsg, MIN_SIGNUP_AGE } from "@/lib/utils";
import {
  birthYearOldEnough,
  birthYearOptions,
  CONSUMER_SEXES,
  isConsumerSex,
  tidyName,
  ONBOARD_FIELDS,
  ONBOARD_PAGE_DEK,
  ONBOARD_PAGE_HEADLINE,
  type ConsumerSex,
} from "@/lib/consumer-onboarding";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { safeNextPath } from "@/lib/auth-redirect";
import { Spinner } from "@/components/shared";
import {
  ERROR_BOX_CLASS,
  INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@/lib/ui-classes";

// Onboarding collects THREE things beyond the phone (already on the auth.user
// from the OTP step): name, sex and year of birth (MESITA-4302, Pato: "Name.
// Year of birth. Fuck specific age. And ask sex too. keep this easier.
// cleaner."). `consumer-onboarding.ts`
// carries why sex came back and why it is required (MESITA-1829); briefly, a
// profile surface printed it while nothing collected it. It also owns
// ONBOARD_FIELDS — the field list the gate checks and the form renders.
//
// FIRST NAME AND LAST NAME (MESITA-4312, Pato: "Yes, split it"), two fields,
// each saved as typed; MESITA-4302's one Name box split on the first space
// is gone. Both are required (MESITA-4090: the place books tables under the
// last name).
//
// ONE SCREEN (MESITA-2746): name, sex and year of birth together. A
// returning half-finished profile prefills what is already stored; one
// Continue writes whatever is still missing (usually all three at once).
//
// INSTAGRAM, ITS OWN SECTION (Pato, 2026-11-24, MESITA-4858: "put instagram as
// an extra page in the onboarding, not page but section"): after the profile
// saves, the same screen asks for an optional username, with Skip and a "Show
// my Instagram on my profile" switch, off by default. The handle is saved
// Unverified and nothing is looked up; verifying is later, in Me › Instagram.
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
  lastName: string;
  birthYear: number | null;
  sex: string;
};

/** Same pill vocabulary as Me's header chips (IdentityBar CHIP_CLASS),
 *  grown to the 44px touch floor because this one is the primary control on
 *  the screen rather than a 36px chip in a 2x2. */
const SEX_CHIP_CLASS =
  "flex h-11 flex-1 items-center justify-center rounded-full border text-sm font-semibold transition";

/** A field's label from ONBOARD_FIELDS, by key, so the order can change. */
const FIELD = (key: (typeof ONBOARD_FIELDS)[number]["key"]) =>
  ONBOARD_FIELDS.find((f) => f.key === key)?.label ?? "";

const FIELD_LABEL_CLASS =
  "text-muted-foreground type-label mb-1 block font-semibold";

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
  const [lastName, setLastName] = useState(initial?.lastName ?? "");
  const [birthYear, setBirthYear] = useState<number | null>(
    initial?.birthYear ?? null,
  );
  const [sex, setSex] = useState<ConsumerSex | "">(() =>
    isConsumerSex(initial?.sex) ? initial.sex : "",
  );
  const [instagram, setInstagram] = useState("");
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);
  // The profile is saved: the Instagram section shows.
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const yearField = ONBOARD_FIELDS.find((f) => f.key === "birth_year");

  const ready =
    Boolean(firstName.trim()) &&
    Boolean(lastName.trim()) &&
    birthYear !== null &&
    isConsumerSex(sex);

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
    const first = tidyName(
      (fd.get("first_name") as string | null) ?? firstName,
    );
    const last = tidyName((fd.get("last_name") as string | null) ?? lastName);
    if (!first) return setError("Tell us your first name.");
    if (!last) return setError("Add your last name too.");
    if (!isConsumerSex(sex)) return setError("Pick one to continue.");
    if (birthYear === null) return setError("Pick your year of birth.");
    if (!birthYearOldEnough(birthYear)) {
      return setError(`You must be at least ${MIN_SIGNUP_AGE} to use Mesita.`);
    }
    setFirstName(first);
    setLastName(last);
    setLoading(true);
    void (async () => {
      try {
        await apiUpdateConsumerProfile(getSupabase(), {
          first_name: first,
          last_name: last,
          birth_year: birthYear,
          sex,
        });
      } catch (err) {
        setError(errMsg(err, "Couldn't save. Try again."));
        setLoading(false);
        return;
      }
      setLoading(false);
      setSaved(true);
    })();
  };

  function finish() {
    router.push(safeNextPath(next) ?? CONSUMER_ROUTES.home);
    router.refresh();
  }

  const handle = normalizeInstagramHandle(instagram);
  // Surely an adult by the year alone, the server's own line (social-level):
  // a younger guest's profile is always private, so there is no choice.
  const adult = birthYear !== null && new Date().getUTCFullYear() - birthYear >= 19;

  function saveInstagram(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!handle || loading) return;
    setError(null);
    setLoading(true);
    apiSetInstagram(getSupabase(), handle, adult && show)
      .then(finish)
      .catch((err) => {
        setError(`${errMsg(err, "Couldn't save your Instagram.")} You can skip and add it later in Me.`);
        setLoading(false);
      });
  }

  if (saved) {
    return (
      <form onSubmit={saveInstagram} className="flex flex-1 flex-col" noValidate data-onboard-instagram>
        <h1 className="text-3xl leading-tight font-semibold tracking-tight">Add your Instagram</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Optional. It&apos;s saved as Unverified; you can verify it later in Me.
        </p>
        <div className="mt-8 flex flex-col gap-4">
          <InstagramHandleField
            id="onboard-instagram"
            value={instagram}
            onChange={(v) => {
              setInstagram(v);
              setError(null);
            }}
          />
          {adult ? (
            <button
              type="button"
              role="switch"
              aria-checked={show}
              onClick={() => setShow(!show)}
              className="border-border bg-card flex w-full items-center gap-3 rounded-xl border p-4 text-left"
              data-onboard-instagram-show={show ? "on" : "off"}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">Show my Instagram on my profile</span>
                <span className="text-muted-foreground type-label block">
                  Guests see your photo and a link to your Instagram.
                </span>
              </span>
              <Switch on={show} />
            </button>
          ) : (
            <p className="text-muted-foreground type-label">
              Profiles of guests under 18 are always private, so your Instagram won&apos;t show.
            </p>
          )}
        </div>
        {error && <p className={cn(ERROR_BOX_CLASS, "mt-5")}>{error}</p>}
        <div className="mt-auto flex flex-col gap-2 pt-8">
          <button type="submit" disabled={loading || !handle} className={PRIMARY_BUTTON_CLASS}>
            {loading ? <Spinner size="sm" className="border-white/40 border-t-white" /> : "Continue"}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={finish}
            className="text-muted-foreground hover:text-foreground min-h-11 text-sm font-semibold transition disabled:opacity-60"
            data-onboard-instagram-skip
          >
            Skip
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-1 flex-col">
      <h1 className="text-3xl leading-tight font-semibold tracking-tight">
        {ONBOARD_PAGE_HEADLINE}
      </h1>
      <p className="text-muted-foreground mt-2 text-sm">{ONBOARD_PAGE_DEK}</p>

      <div className="mt-8 flex flex-col gap-6">
        <div>
          <label htmlFor="onboard-first-name" className={FIELD_LABEL_CLASS}>
            {FIELD("first_name")}
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
            placeholder="e.g. Ana"
            required
          />
        </div>

        <div>
          <label htmlFor="onboard-last-name" className={FIELD_LABEL_CLASS}>
            {FIELD("last_name")}
          </label>
          <input
            id="onboard-last-name"
            name="last_name"
            className={INPUT_CLASS}
            value={lastName}
            onChange={(e) => {
              setLastName(e.target.value);
              setError(null);
            }}
            maxLength={60}
            autoComplete="family-name"
            placeholder="e.g. García"
            required
          />
        </div>

        <div>
          <span className={FIELD_LABEL_CLASS}>{FIELD("sex")}</span>
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

        <div>
          <label htmlFor="onboard-birth-year" className={FIELD_LABEL_CLASS}>
            {FIELD("birth_year")}
          </label>
          <select
            id="onboard-birth-year"
            name="birth_year"
            className={cn(
              INPUT_CLASS,
              birthYear === null && "text-muted-foreground",
            )}
            value={birthYear ?? ""}
            onChange={(e) => {
              setBirthYear(e.target.value ? Number(e.target.value) : null);
              setError(null);
            }}
            autoComplete="bday-year"
            required
          >
            <option value="" disabled>
              Year
            </option>
            {birthYearOptions().map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          {yearField?.hint ? (
            <p className="text-muted-foreground type-body mt-3">
              Nobody sees it. It confirms you&apos;re old enough for Mesita.
            </p>
          ) : null}
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
