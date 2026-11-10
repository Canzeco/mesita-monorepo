"use client";

import { useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Camera, Copy } from "lucide-react";
import {
  BirthdayPicker,
  BirthdayPickerSkeleton,
  Skeleton,
  SkeletonLine,
  Spinner,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { DefaultAvatar, SizedImage } from "@mesita/place-profile";
import { MeScreen } from "@/components/consumer/me/MeScreen";
import { ME_BUTTON_CLASS } from "@/components/consumer/me/settings-rows";
import {
  apiUpdateConsumerProfile,
  type ConsumerProfile,
} from "@/lib/api/profile";
import {
  ALLOWED_AVATAR_ACCEPT,
  uploadConsumerAvatar,
  validateAvatarFile,
} from "@/lib/avatar-upload";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { goBack as leave } from "@/lib/navigate";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { toast } from "@/lib/toast";
import { ERROR_BOX_CLASS, INPUT_CLASS } from "@/lib/ui-classes";
import { useConsumerProfile } from "@/lib/use-consumer-profile";
import { ageFromBirthday, cn, errMsg, MIN_SIGNUP_AGE } from "@/lib/utils";

// Full-page identity editor at /me/profile (MESITA-1789). Was a LocalSheet
// over Me. Writes through consumer-web-update-profile. Consumers auth with
// their phone (not email), so email isn't shown or edited here.
//
// Phone is auth identity (set at sign-in) and is not editable here — only
// first name, last name, sex and birthday. That is onboarding's set PLUS the
// last name, which the reservation flow collects rather than /onboard. The
// claim that it was "the same set onboarding collects" was true until
// MESITA-1806 dropped sex from signup and stayed in this comment for the
// whole time a profile surface was printing a field nothing asked for
// (MESITA-1829). Re-derive it here if the gate moves again.
// Both name halves are required and always sent together: the EF re-derives
// full_name from them, and that's the name reservations are booked under.
//
// Photo upload (MESITA-953) is immediate on pick: Storage → EF avatar_url
// patch. Name/sex/birthday still save via the Save button in the header;
// the back arrow is Cancel, and a successful Save pops history back to /me.
//
// ONE SCREEN, NO SCROLL (MESITA-3101, Pato: "make it smaller … not
// scrollable"). Save sits in MeScreen's right header slot, not in a row
// under the fields (it was under the tab bar on a phone); the photo and the
// member number share the first row; the names share one row; Sex is a
// two-button switch; Birthday is BirthdayPicker's compact row. The caption
// and the photo's file hint are gone (a bad file still toasts, and the hint's
// "max 2 MB" was the bucket's cap on the shrunk file, not the picker's).
//
// THE MEMBER NUMBER LIVES HERE (MESITA-2043, Pato: "we don't have
// passports"). `consumers.code` printed in exactly one place — the Passport —
// and it is the string staff and support look a guest up by, because a name
// can match several people and the number never does. It copies in place;
// null is a real state (`generate_consumer_code()` assigns on first profile
// read), so it reads "Pending" and offers nothing to copy.

// THE FORM'S FIXED WORDS, ONCE (MESITA-2701). The form and its loading
// skeleton both print them, so they wrap where each other's do (Pato,
// MESITA-2701: "the placeholders must be similar to the page you are
// loading, like the sizes").

/** The member-number card's label, over the number. */
const MEMBER_NUMBER_LABEL = "Member number";

/** Sex's two choices, in the switch's order. */
const SEX_OPTIONS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
] as const;

/** The four fields' labels. */
const FIELD_LABEL = {
  firstName: "First name",
  lastName: "Last name",
  sex: "Sex",
  birthday: "Birthday",
} as const;

/** First name, Last name and Sex: the shared input, a notch smaller. One
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

/** The 64px photo. */
const PHOTO_BOX_CLASS = "h-16 w-16 shrink-0 rounded-full";

/** The camera badge on the photo's corner: 28px, a 2px paper rim. */
const CAMERA_BADGE_BOX_CLASS =
  "border-paper absolute -right-0.5 -bottom-0.5 h-7 w-7 rounded-full border-2";

/** The number: the row title's 14px semibold, tabular (MESITA-2983). */
const MEMBER_NUMBER_CLASS =
  "block truncate text-sm font-semibold tracking-wide tabular-nums";

/** The 44px copy button beside the number. */
const COPY_BUTTON_BOX_CLASS = "h-11 w-11 shrink-0 rounded-xl";

/** The photo and the member-number card, side by side. */
const TOP_ROW_CLASS = "flex items-center gap-4";

/** The member-number card: one white row beside the photo. */
const MEMBER_CARD_CLASS =
  "bg-card border-border flex min-w-0 flex-1 items-center gap-1 rounded-xl border py-1 pr-1 pl-3";

/** The fields' column, 20px under the top row, 12px apart. */
const FIELDS_CLASS = "mt-5 flex flex-col gap-3";

/** First and Last name on one row. */
const NAME_ROW_CLASS = "grid grid-cols-2 gap-3";

/** Sex's switch: the field's box holding two halves. */
const SEX_SWITCH_CLASS =
  "bg-card border-border grid grid-cols-2 gap-1 rounded-lg border p-1";
const SEX_OPTION_CLASS =
  "rounded-md py-1.5 text-sm font-medium transition active:scale-[0.98]";

/** Save in the header: the Me button, sized to its word. */
const SAVE_BUTTON_CLASS = cn(ME_BUTTON_CLASS, "px-4");
const SAVE_BOX_CLASS = "h-11 w-[68px] rounded-xl";

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

/** One field's label: SheetField's, Sex's and Birthday's, and the
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

/** The member-number card beside the photo: its label over the number, the
 *  copy button on the right. The form passes the number and the button; the
 *  skeleton passes a bar on the number's line and the button's box. */
function MemberNumberCard({
  number,
  action,
}: {
  number: ReactNode;
  action: ReactNode;
}) {
  return (
    <div className={MEMBER_CARD_CLASS}>
      <div className="min-w-0 flex-1 py-1">
        <span className="text-muted-foreground type-label block">
          {MEMBER_NUMBER_LABEL}
        </span>
        {number}
      </div>
      {action}
    </div>
  );
}

/**
 * The form before the profile lands, block for block (Pato, MESITA-2701:
 * "the placeholders must be similar to the page you are loading, like the
 * sizes"; "for example in profile the current placeholders are not
 * similar").
 *
 * The fixed words are drawn as themselves — the member-number label, the
 * field labels — from the form's own components and constants, so they wrap
 * exactly as the form's do; what the read brings (photo, number, values) and
 * every control is a block at its box: Save's box in the header, the 64px
 * photo with the camera badge on its corner, the 44px copy button, the two
 * name fields as their own empty controls (FIELD_SKELETON_CLASS), Sex's
 * switch with its words hidden, BirthdayPicker's compact skeleton.
 * /me/profile/loading.tsx draws this same one.
 */
export function EditProfileSkeleton() {
  return (
    <MeScreen title="Profile" action={<Skeleton className={SAVE_BOX_CLASS} />}>
      <div className={TOP_ROW_CLASS}>
        <div className="relative">
          <Skeleton className={PHOTO_BOX_CLASS} />
          <Skeleton className={CAMERA_BADGE_BOX_CLASS} />
        </div>
        <MemberNumberCard
          number={<SkeletonLine className={MEMBER_NUMBER_CLASS} bar="w-24" />}
          action={<Skeleton className={COPY_BUTTON_BOX_CLASS} />}
        />
      </div>

      <div className={FIELDS_CLASS} aria-hidden>
        <div className={NAME_ROW_CLASS}>
          {[FIELD_LABEL.firstName, FIELD_LABEL.lastName].map((label) => (
            <div key={label} className="min-w-0">
              <FieldLabel>{label}</FieldLabel>
              <input
                disabled
                tabIndex={-1}
                aria-hidden
                className={FIELD_SKELETON_CLASS}
              />
            </div>
          ))}
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
          <FieldLabel>{FIELD_LABEL.birthday}</FieldLabel>
          <BirthdayPickerSkeleton compact />
        </div>
      </div>

      <p role="status" className="sr-only">
        Loading your details
      </p>
    </MeScreen>
  );
}

function EditProfileForm({ profile }: { profile: ConsumerProfile }) {
  const router = useRouter();
  const supabase = useBrowserSupabase();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [firstName, setFirstName] = useState(profile.first_name ?? "");
  const [lastName, setLastName] = useState(profile.last_name ?? "");
  // Male/Female only (MESITA-727). "" = nothing stored yet, which is why the
  // select carries an empty option — a legacy profile shouldn't silently
  // acquire a sex just by opening this page.
  const [sex, setSex] = useState(profile.sex ?? "");
  const [birthday, setBirthday] = useState(profile.birthday ?? "");
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const displayAvatarUrl = previewUrl ?? profile.avatar_url ?? null;

  const dirty =
    firstName.trim() !== (profile.first_name ?? "") ||
    lastName.trim() !== (profile.last_name ?? "") ||
    sex !== (profile.sex ?? "") ||
    birthday !== (profile.birthday ?? "");

  // Saved: slide away to the screen under (Me, or wherever Profile was
  // opened from), with Me as the landing for a cold open (MESITA-3644).
  function goBack() {
    leave(router, CONSUMER_ROUTES.me);
  }

  const code = profile.code ?? null;
  async function copyCode() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Member number copied");
    } catch {
      toast("Couldn't copy — select the number manually");
    }
  }

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
    if (!firstName.trim() || !lastName.trim()) {
      toast("First and last name are both required.");
      return;
    }
    const age = ageFromBirthday(birthday);
    if (age !== null && age < MIN_SIGNUP_AGE) {
      toast(`You must be at least ${MIN_SIGNUP_AGE} to use Mesita.`);
      return;
    }
    setSaving(true);
    try {
      await apiUpdateConsumerProfile(supabase, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        ...(sex === "male" || sex === "female" ? { sex } : {}),
        birthday,
      });
      toast("Profile updated.");
      goBack();
    } catch (e) {
      toast(errMsg(e, "Couldn't save your profile."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <MeScreen
      title="Profile"
      action={
        <Button
          type="button"
          size="sm"
          onClick={() => void save()}
          disabled={!dirty || saving || uploadingPhoto}
          className={SAVE_BUTTON_CLASS}
        >
          {saving && (
            <Spinner size="sm" className="border-white/40 border-t-white" />
          )}
          {saving ? "Saving…" : "Save"}
        </Button>
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
              "bg-pink-gradient shadow-rest flex p-[2.5px]",
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
                  sizes="64px"
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
              "bg-foreground text-paper shadow-rest flex items-center justify-center transition group-active:scale-95",
            )}
          >
            <Camera className="h-3.5 w-3.5" />
          </span>
        </button>

        <MemberNumberCard
          number={
            <span
              className={cn(
                MEMBER_NUMBER_CLASS,
                code ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {code ?? "Pending"}
            </span>
          }
          action={
            code ? (
              <button
                type="button"
                onClick={() => void copyCode()}
                aria-label="Copy member number"
                className={cn(
                  COPY_BUTTON_BOX_CLASS,
                  "text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center transition",
                )}
              >
                <Copy className="h-4 w-4" />
              </button>
            ) : null
          }
        />
      </div>

      <div className={FIELDS_CLASS}>
        <div className={NAME_ROW_CLASS}>
          <SheetField
            label={FIELD_LABEL.firstName}
            value={firstName}
            onChange={setFirstName}
            placeholder={FIELD_LABEL.firstName}
            autoComplete="given-name"
          />
          <SheetField
            label={FIELD_LABEL.lastName}
            value={lastName}
            onChange={setLastName}
            placeholder={FIELD_LABEL.lastName}
            autoComplete="family-name"
          />
        </div>
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
          <FieldLabel>{FIELD_LABEL.birthday}</FieldLabel>
          <BirthdayPicker value={birthday} onChange={setBirthday} compact />
        </label>
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
