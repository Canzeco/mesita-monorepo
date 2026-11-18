"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Check } from "lucide-react";
import { Skeleton, Spinner } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { DefaultAvatar, SizedImage } from "@mesita/place-profile";
import { MeScreen } from "@/components/consumer/me/MeScreen";
import { ME_BUTTON_CLASS } from "@/components/consumer/me/settings-rows";
import { Panel } from "@/components/shared/Panel";
import {
  apiUpdateConsumerProfile,
  type ConsumerProfile,
} from "@/lib/api/profile";
import {
  ALLOWED_AVATAR_ACCEPT,
  uploadConsumerAvatar,
  validateAvatarFile,
} from "@/lib/avatar-upload";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { toast } from "@/lib/toast";
import { ERROR_BOX_CLASS, INPUT_CLASS } from "@/lib/ui-classes";
import { useConsumerProfile } from "@/lib/use-consumer-profile";
import { cn, errMsg, MIN_SIGNUP_AGE } from "@/lib/utils";
import {
  birthYearOf,
  birthYearOldEnough,
  birthYearOptions,
  joinName,
  nameError,
  splitFullName,
} from "@/lib/consumer-onboarding";

// Full-page identity editor at /me/profile (MESITA-1789). Was a LocalSheet
// over Me. Writes through consumer-web-update-profile. Consumers auth with
// their phone (not email), so email isn't shown or edited here.
//
// NAME, SEX, YEAR OF BIRTH (MESITA-4302, Pato: "Name. Year of birth. Fuck
// specific age. And ask sex too. keep this easier. cleaner."). One Name box
// split by splitFullName (first word = first name, the rest = last name; one
// word is refused because bookings need a last name), the Sex switch, and a
// year select. The birthday date is no longer written.
//
// Phone is auth identity (set at sign-in) and is not editable here. The
// fields are onboarding's own three (consumer-onboarding.ts ONBOARD_FIELDS).
// Both name halves are required and always sent together: the EF re-derives
// full_name from them, and that's the name reservations are booked under.
//
// Photo upload (MESITA-953) is immediate on pick: Storage → EF avatar_url
// patch. Name/sex/year save via Save; the back arrow is Cancel.
//
// PHOTO AND NAME ABOVE, FIELDS IN A BOX, SAVE IN A FOOTER BAND (MESITA-4052,
// Pato 2026-11-15: "put sections into boxes … the button module or section
// must also have a hr line dividing stuff from white land"). The 96px photo
// and the full name lead the page, centred, outside any box (decision 1C);
// name, sex and year sit in one Details box; Save is a full-width
// button in MeScreen's footer band under a hairline, never in the header
// (it sat there from MESITA-3101). Its states (decision 2C): grey and off
// until a field changes, black with a change, "Saving…" with a spinner,
// "Saved" for 2 seconds (the page stays; it popped back to Me until
// MESITA-4052), and a failed save prints its error above the button and
// keeps every edit. Name is one full-width box; Sex is a two-button switch;
// Year of birth is one native select.
//
// NO MEMBER NUMBER (MESITA-3874, Pato: "nobody gives a fuck about the
// member number. remove that"). `consumers.code` stays in the database for
// staff and support; no guest screen prints it.

// THE FORM'S FIXED WORDS, ONCE (MESITA-2701). The form and its loading
// skeleton both print them, so they wrap where each other's do (Pato,
// MESITA-2701: "the placeholders must be similar to the page you are
// loading, like the sizes").

/** Sex's two choices, in the switch's order. */
const SEX_OPTIONS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
] as const;

/** The three fields' labels. */
const FIELD_LABEL = {
  name: "Name",
  sex: "Sex",
  birthYear: "Year of birth",
} as const;

/** Name and Year of birth: the shared input, a notch smaller. One
 *  string for the fields and their loading boxes (MESITA-2701). */
const FIELD_CLASS = cn(INPUT_CLASS, "h-auto rounded-lg py-2");

/** A field's box before its value lands: the field's own control, empty,
 *  disabled and muted. Not a div, because its height comes from the control:
 *  touch screens draw inputs and selects at 16px (globals.css), so the field
 *  is 38px on a desktop and about 41px on a phone, and a fixed block would
 *  match only one of them. */
const FIELD_SKELETON_CLASS = cn(
  FIELD_CLASS,
  "bg-muted pointer-events-none animate-pulse border-transparent opacity-100",
);

// THE FORM'S BOXES, ONCE (MESITA-2701): each string below is the box the
// form draws and the box its skeleton pulses.

/** The 96px photo. */
const PHOTO_BOX_CLASS = "h-24 w-24 shrink-0 rounded-full";

/** The camera badge on the photo's corner: 32px, a 2px paper rim. */
const CAMERA_BADGE_BOX_CLASS =
  "border-paper absolute right-0 bottom-0 h-8 w-8 rounded-full border-2";

/** The photo and the name, centred above the box. */
const TOP_ROW_CLASS = "flex flex-col items-center gap-3";

/** The name under the photo: one 18px line. */
const NAME_CLASS = "font-display min-h-7 max-w-full truncate text-lg font-semibold tracking-tight";

/** The fields' column inside the Details box, 24px under the name. */
const FIELDS_CLASS = "flex flex-col gap-3 p-4";
const DETAILS_CLASS = "mt-4";

/** Sex's switch: the field's box holding two halves. */
const SEX_SWITCH_CLASS =
  "bg-card border-border grid grid-cols-2 gap-1 rounded-lg border p-1";
const SEX_OPTION_CLASS =
  "rounded-md py-1.5 text-sm font-medium transition active:scale-[0.98]";

/** Save in the footer band: the Me button, full width; off it is grey. */
const SAVE_BUTTON_CLASS = cn(
  ME_BUTTON_CLASS,
  "w-full disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100",
);
const SAVE_BOX_CLASS = "h-11 w-full rounded-xl";

/** How long "Saved" stays on the button. */
const SAVED_MS = 2000;

export function EditProfileSheet() {
  // The kept row (MESITA-3014): the form paints at once when the shell has
  // read the profile, and a failed read offers a retry instead of a skeleton
  // that never leaves.
  const { data: profile, error, reload } = useConsumerProfile();

  if (!profile && error) {
    return (
      <div className="px-4 pt-4">
        <p className={cn(ERROR_BOX_CLASS, "rounded-xl text-sm")}>
          Couldn&apos;t load your profile.
        </p>
        <Button className="mt-3 h-11 w-full" onClick={reload}>
          Try again
        </Button>
      </div>
    );
  }
  if (!profile) return <EditProfileSkeleton />;

  // A save writes the returned row into the store (apiUpdateConsumerProfile),
  // so every screen reading the profile, this one included, gets it.
  return <EditProfileForm profile={profile} />;
}

/** One field's label: SheetField's, Sex's and the year's, and the
 *  skeleton's. */
function FieldLabel({ children, id }: { children: string; id?: string }) {
  return (
    <span
      id={id}
      className="text-muted-foreground type-label mb-1 block font-medium"
    >
      {children}
    </span>
  );
}

/**
 * The form before the profile lands, block for block (Pato, MESITA-2701:
 * "the placeholders must be similar to the page you are loading, like the
 * sizes"; "for example in profile the current placeholders are not
 * similar").
 *
 * The fixed words are drawn as themselves — the field labels — from the form's own components and constants, so they wrap
 * exactly as the form's do; what the read brings (photo, values) and
 * every control is a block at its box: Save's box in the header, the 64px
 * photo with the camera badge on its corner, the two
 * Name field as its own empty control (FIELD_SKELETON_CLASS), Sex's
 * switch with its words hidden, the year select empty.
 * /me/profile/loading.tsx draws this same one.
 */
export function EditProfileSkeleton() {
  return (
    <MeScreen title="Profile" footer={<Skeleton className={SAVE_BOX_CLASS} />}>
      <div className={TOP_ROW_CLASS}>
        <div className="relative">
          <Skeleton className={PHOTO_BOX_CLASS} />
          <Skeleton className={CAMERA_BADGE_BOX_CLASS} />
        </div>
        <span className={cn(NAME_CLASS, "flex items-center")}>
          <Skeleton className="h-4 w-32 rounded" />
        </span>
      </div>

      <div className={DETAILS_CLASS}>
      <Panel title="Details">
      <div className={FIELDS_CLASS} aria-hidden>
        <div>
          <FieldLabel>{FIELD_LABEL.name}</FieldLabel>
          <input
            disabled
            tabIndex={-1}
            aria-hidden
            className={FIELD_SKELETON_CLASS}
          />
        </div>
        <div>
          <FieldLabel>{FIELD_LABEL.sex}</FieldLabel>
          <div
            className={cn(
              SEX_SWITCH_CLASS,
              "bg-muted animate-pulse border-transparent",
            )}
          >
            {SEX_OPTIONS.map((option) => (
              <span
                key={option.value}
                className={cn(SEX_OPTION_CLASS, "invisible")}
              >
                {option.label}
              </span>
            ))}
          </div>
        </div>
        <div>
          <FieldLabel>{FIELD_LABEL.birthYear}</FieldLabel>
          <select
            disabled
            tabIndex={-1}
            aria-hidden
            className={FIELD_SKELETON_CLASS}
          />
        </div>
      </div>
      </Panel>
      </div>

      <p role="status" className="sr-only">
        Loading your details
      </p>
    </MeScreen>
  );
}

function EditProfileForm({ profile }: { profile: ConsumerProfile }) {
  const supabase = useBrowserSupabase();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const storedName = joinName(profile.first_name, profile.last_name);
  const storedYear = birthYearOf(profile);
  const [name, setName] = useState(storedName);
  // Male/Female only (MESITA-727). "" = nothing stored yet, which is why the
  // select carries an empty option — a legacy profile shouldn't silently
  // acquire a sex just by opening this page.
  const [sex, setSex] = useState(profile.sex ?? "");
  const [birthYear, setBirthYear] = useState<number | null>(storedYear);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const displayAvatarUrl = previewUrl ?? profile.avatar_url ?? null;

  const dirty =
    name.trim().replace(/\s+/g, " ") !== storedName ||
    sex !== (profile.sex ?? "") ||
    birthYear !== storedYear;

  // "Saved" reads for 2 seconds, then the button goes back to grey Save.
  useEffect(() => {
    if (!saved) return;
    const t = window.setTimeout(() => setSaved(false), SAVED_MS);
    return () => window.clearTimeout(t);
  }, [saved]);

  async function onPhotoPicked(file: File | undefined) {
    if (!file || uploadingPhoto) return;
    const validationError = validateAvatarFile(file);
    if (validationError) {
      toast(validationError);
      return;
    }

    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);
    setUploadingPhoto(true);
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error("Sign in again to change your photo.");
      }
      const publicUrl = await uploadConsumerAvatar(supabase, user.id, file);
      await apiUpdateConsumerProfile(supabase, { avatar_url: publicUrl });
      toast("Photo updated.");
      setPreviewUrl(null);
    } catch (e) {
      setPreviewUrl(null);
      toast(errMsg(e, "Couldn't upload your photo."));
    } finally {
      URL.revokeObjectURL(localPreview);
      setUploadingPhoto(false);
    }
  }

  async function save() {
    if (!dirty || saving) return;
    const badName = nameError(name);
    const split = splitFullName(name);
    if (badName || !split) {
      setSaveError(badName ?? "Add your last name too.");
      return;
    }
    if (birthYear !== null && !birthYearOldEnough(birthYear)) {
      setSaveError(`You must be at least ${MIN_SIGNUP_AGE} to use Mesita.`);
      return;
    }
    setSaveError(null);
    setSaving(true);
    try {
      await apiUpdateConsumerProfile(supabase, {
        first_name: split.first,
        last_name: split.last,
        ...(sex === "male" || sex === "female" ? { sex } : {}),
        ...(birthYear !== null ? { birth_year: birthYear } : {}),
      });
      setSaved(true);
    } catch (e) {
      setSaveError(errMsg(e, "Couldn't save your profile."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <MeScreen
      title="Profile"
      footer={
        <>
          {saveError && (
            <p role="alert" className="text-destructive mb-2 text-sm">
              {saveError}
            </p>
          )}
          <Button
            type="button"
            onClick={() => void save()}
            disabled={!dirty || saving || uploadingPhoto}
            className={SAVE_BUTTON_CLASS}
          >
            {saving && (
              <Spinner size="sm" className="border-white/40 border-t-white" />
            )}
            {saved && !dirty && <Check className="h-4 w-4" aria-hidden />}
            {saving ? "Saving…" : saved && !dirty ? "Saved" : "Save"}
          </Button>
        </>
      }
    >
      <div className={TOP_ROW_CLASS}>
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_AVATAR_ACCEPT}
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            void onPhotoPicked(file);
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingPhoto}
          className="group relative shrink-0 disabled:opacity-70"
          aria-label="Change profile photo"
        >
          <span
            className={cn(
              "bg-pink-gradient flex p-[2.5px]",
              PHOTO_BOX_CLASS,
            )}
          >
            <span className="bg-card relative flex-1 overflow-hidden rounded-full">
              {displayAvatarUrl ? (
                <SizedImage
                  src={displayAvatarUrl}
                  size="thumb"
                  alt="Profile photo"
                  fill
                  sizes="96px"
                  className="object-cover"
                  unoptimized={Boolean(previewUrl)}
                />
              ) : (
                <DefaultAvatar className="h-full w-full" />
              )}
              {uploadingPhoto && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/35">
                  <Spinner
                    size="sm"
                    className="border-white/40 border-t-white"
                  />
                </span>
              )}
            </span>
          </span>
          <span
            className={cn(
              CAMERA_BADGE_BOX_CLASS,
              "bg-foreground text-paper flex items-center justify-center transition group-active:scale-95",
            )}
          >
            <Camera className="h-4 w-4" />
          </span>
        </button>
        <p className={NAME_CLASS}>
          {name.trim() || "Your name"}
        </p>
      </div>

      <div className={DETAILS_CLASS}>
      <Panel title="Details">
      <div className={FIELDS_CLASS}>
        <SheetField
          label={FIELD_LABEL.name}
          value={name}
          onChange={setName}
          placeholder="First and last name"
          autoComplete="name"
        />
        <div>
          <FieldLabel id="profile-sex-label">{FIELD_LABEL.sex}</FieldLabel>
          {/* No option lit is a real state: a legacy profile with no sex
              stored stays that way until the guest taps one. */}
          <div
            role="radiogroup"
            aria-labelledby="profile-sex-label"
            className={SEX_SWITCH_CLASS}
          >
            {SEX_OPTIONS.map((option) => {
              const on = sex === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setSex(option.value)}
                  className={cn(
                    SEX_OPTION_CLASS,
                    on
                      ? "bg-foreground text-paper"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
        <label className="block">
          <FieldLabel>{FIELD_LABEL.birthYear}</FieldLabel>
          <select
            value={birthYear ?? ""}
            onChange={(e) =>
              setBirthYear(e.target.value ? Number(e.target.value) : null)
            }
            autoComplete="bday-year"
            className={cn(
              FIELD_CLASS,
              birthYear === null && "text-muted-foreground",
            )}
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
        </label>
      </div>
      </Panel>
      </div>
    </MeScreen>
  );
}

function SheetField({
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block min-w-0">
      <FieldLabel>{label}</FieldLabel>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={FIELD_CLASS}
      />
    </label>
  );
}
