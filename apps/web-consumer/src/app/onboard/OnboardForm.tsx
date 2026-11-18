"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import {
  apiLookupInstagram,
  apiUpdateConsumerProfile,
} from "@/lib/api/profile";
import { EFError } from "@/lib/api/_invoke";
import { normalizeInstagramHandle } from "@/lib/instagram-handle";
import { cn, errMsg, MIN_SIGNUP_AGE } from "@/lib/utils";
import {
  birthYearOldEnough,
  birthYearOptions,
  CONSUMER_SEXES,
  isConsumerSex,
  nameError,
  splitFullName,
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
// ONE NAME BOX (MESITA-4302). The last name is still required (MESITA-4090:
// the place books tables under it), so the box needs two words and
// splitFullName stores the first as the first name and the rest as the last.
//
// ONE SCREEN (MESITA-2746): name, sex and year of birth together. A
// returning half-finished profile prefills what is already stored; one
// Continue writes whatever is still missing (usually all three at once).
//
// INSTAGRAM, OPTIONAL (Pato, MESITA-3075: "in the onboarding ask for the
// instagram and actually kinda like scrape the site … in the future we are
// going to correct that, with verification"). A fourth field under sex: a
// typed username is connected after the profile saves, through Me ›
// Instagram's own trusted lookup (consumer-web-lookup-instagram, MESITA-3039:
// Apify reads the handle, followers and photo; nothing is proved). Optional
// (decision, reversible): a guest without Instagram, or a scrape that fails,
// is never kept out. A failed lookup keeps them here with the reason; the
// profile is already saved, so clearing the field and Continue goes on. The
// Meta DM bot (MESITA-2579) replaces this with proof.
//
// PRESERVED FROM EARLIER VERSIONS, all still load-bearing: the FormData-over-
// state read of the name (autofill populates the input without firing
// onChange, which used to send a null name), the roving-tabindex radiogroup
// for sex, the age check against MIN_SIGNUP_AGE, and the rule that nothing
// wears a red asterisk — every question here is required, so marking them all
// marks nothing. The disabled button states the requirement and a submit
// attempt names the specific gap.

export type OnboardInitialValues = {
  /** First + last joined, as the one box shows them. */
  name: string;
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
  const [name, setName] = useState(initial?.name ?? "");
  const [birthYear, setBirthYear] = useState<number | null>(
    initial?.birthYear ?? null,
  );
  const [sex, setSex] = useState<ConsumerSex | "">(() =>
    isConsumerSex(initial?.sex) ? initial.sex : "",
  );
  const [instagram, setInstagram] = useState("");
  const [loading, setLoading] = useState(false);
  // True while the Instagram lookup runs (a scrape, up to a minute).
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const yearField = ONBOARD_FIELDS.find((f) => f.key === "birth_year");

  const ready =
    Boolean(name.trim()) && birthYear !== null && isConsumerSex(sex);

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
    const typedName = ((fd.get("name") as string | null) ?? name).trim();
    const badName = nameError(typedName);
    if (badName) return setError(badName);
    const split = splitFullName(typedName);
    if (!split) return setError("Add your last name too.");
    if (!isConsumerSex(sex)) return setError("Pick one to continue.");
    if (birthYear === null) return setError("Pick your year of birth.");
    if (!birthYearOldEnough(birthYear)) {
      return setError(`You must be at least ${MIN_SIGNUP_AGE} to use Mesita.`);
    }
    const typed = instagram.trim().replace(/^@/, "");
    const handle = typed ? normalizeInstagramHandle(typed) : null;
    if (typed && !handle) {
      return setError(
        "That isn't an Instagram username. Check it, or leave it empty.",
      );
    }

    setName(typedName);
    setLoading(true);
    void (async () => {
      try {
        await apiUpdateConsumerProfile(getSupabase(), {
          first_name: split.first,
          last_name: split.last,
          birth_year: birthYear,
          sex,
        });
      } catch (err) {
        setError(errMsg(err, "Couldn't save. Try again."));
        setLoading(false);
        return;
      }
      if (handle) {
        setReading(true);
        try {
          await apiLookupInstagram(getSupabase(), handle);
        } catch (err) {
          setError(
            err instanceof EFError && err.code === "profile_not_found"
              ? `We couldn't find @${handle} on Instagram. Check the username, or leave it empty.`
              : `${errMsg(err, "Couldn't connect your Instagram.")} You can leave it empty and connect it later in Me.`,
          );
          setReading(false);
          setLoading(false);
          return;
        }
      }
      router.push(safeNextPath(next) ?? CONSUMER_ROUTES.home);
      router.refresh();
    })();
  };

  return (
    <form onSubmit={submit} className="flex flex-1 flex-col">
      <h1 className="font-display text-3xl leading-tight font-semibold tracking-tight">
        {ONBOARD_PAGE_HEADLINE}
      </h1>
      <p className="text-muted-foreground mt-2 text-sm">{ONBOARD_PAGE_DEK}</p>

      <div className="mt-8 flex flex-col gap-6">
        <div>
          <label htmlFor="onboard-name" className={FIELD_LABEL_CLASS}>
            {FIELD("name")}
          </label>
          <input
            id="onboard-name"
            name="name"
            className={INPUT_CLASS}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            maxLength={120}
            autoComplete="name"
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
            className={cn(INPUT_CLASS, birthYear === null && "text-muted-foreground")}
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

        <div>
          <label htmlFor="onboard-instagram" className={FIELD_LABEL_CLASS}>
            Instagram (optional)
          </label>
          {/* The @ is drawn, never typed (MESITA-3045); a pasted one is
              dropped. */}
          <span className="relative block">
            <span
              aria-hidden
              className="text-muted-foreground pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm"
            >
              @
            </span>
            <input
              id="onboard-instagram"
              name="instagram"
              className={cn(INPUT_CLASS, "pl-7")}
              value={instagram}
              onChange={(e) => {
                setInstagram(e.target.value.replace(/^@/, ""));
                setError(null);
              }}
              maxLength={31}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="off"
            />
          </span>
          <p className="text-muted-foreground type-body mt-3">
            Your username. We add your followers and photo from your Instagram.
          </p>
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
        <p
          aria-live="polite"
          className="text-muted-foreground type-label mt-2 min-h-5 text-center"
        >
          {reading
            ? "Reading your Instagram. This can take up to a minute."
            : ""}
        </p>
      </div>
    </form>
  );
}
