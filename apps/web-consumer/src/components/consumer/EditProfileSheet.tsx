"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
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
import { DefaultAvatar } from "@mesita/place-profile";
import { MeScreen } from "@/components/consumer/me/MeScreen";
import {
  apiFetchConsumerProfile,
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
import {
  INPUT_CLASS,
  SHEET_CANCEL_BUTTON_CLASS,
} from "@/lib/ui-classes";
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
// patch. Name/sex/birthday still save via the Save button. Cancel and a
// successful Save both pop history back to /me.
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

/** The line under the title. */
const PROFILE_CAPTION = "How you appear across Mesita";

/** The line under the photo. */
const PHOTO_HINT = "JPG, PNG, or WEBP · max 2 MB";

/** The member-number card's label, over the number. */
const MEMBER_NUMBER_LABEL = "Member number";

const MEMBER_NUMBER_LINE =
  "Give this number to staff or support when they ask who you are.";

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

/** The 80px photo. */
const PHOTO_BOX_CLASS = "h-20 w-20 rounded-full";

/** The camera badge on the photo's corner: 28px, a 2px paper rim. */
const CAMERA_BADGE_BOX_CLASS =
  "border-paper absolute -right-0.5 -bottom-0.5 h-7 w-7 rounded-full border-2";

/** The number's own line: the display face, 18px tight. */
const MEMBER_NUMBER_CLASS =
  "font-display block truncate text-lg leading-tight tracking-wide tabular-nums";

/** The 44px copy button beside the number. */
const COPY_BUTTON_BOX_CLASS = "h-11 w-11 shrink-0 rounded-xl";

/** The fields' column, 20px under the card, 12px apart. */
const FIELDS_CLASS = "mt-5 flex flex-col gap-3";

/** Cancel and Save, 32px under the fields. */
const ACTIONS_CLASS = "mt-8 flex gap-2";

export function EditProfileSheet() {
  const supabase = useBrowserSupabase();
  const [profile, setProfile] = useState<ConsumerProfile | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { consumer } = await apiFetchConsumerProfile(supabase);
        if (!cancelled) setProfile(consumer);
      } catch (e) {
        if (!cancelled) toast(errMsg(e, "Couldn't load your profile."));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  if (!profile) return <EditProfileSkeleton />;

  return <EditProfileForm profile={profile} onProfileChange={setProfile} />;
}

/** One field's label: SheetField's, Sex's and Birthday's, and the
 *  skeleton's. */
function FieldLabel({ children }: { children: string }) {
  return (
    <span className="text-muted-foreground type-label mb-1 block font-medium">
      {children}
    </span>
  );
}

/** The caption under the title, the form's and the skeleton's. */
function ProfileCaption() {
  return <p className="text-muted-foreground text-xs">{PROFILE_CAPTION}</p>;
}

/** The hint under the photo, the form's and the skeleton's. */
function PhotoHint() {
  return (
    <p className="text-muted-foreground type-body mt-2 text-center">
      {PHOTO_HINT}
    </p>
  );
}

/** The member-number card: the label, the number, the line, and the copy
 *  button beside them. The form passes the number and the button; the
 *  skeleton passes a bar on the number's line and the button's box. */
function MemberNumberCard({
  number,
  action,
}: {
  number: ReactNode;
  action: ReactNode;
}) {
  return (
    <div className="border-border bg-card mt-5 flex items-center gap-3 rounded-2xl border p-4">
      <div className="min-w-0 flex-1">
        <span className="text-muted-foreground type-label block font-medium">
          {MEMBER_NUMBER_LABEL}
        </span>
        {number}
        <span className="text-muted-foreground mt-1 block text-xs leading-snug">
          {MEMBER_NUMBER_LINE}
        </span>
      </div>
      {action}
    </div>
  );
}

/**
 * The form before the profile lands, block for block (Pato, MESITA-2701:
 * "the placeholders must be similar to the page you are loading, like the
 * sizes"; "for example in profile the current placeholders are not
 * similar"). It was a photo disc 32px too low and three 44px bars where the
 * form has a member-number card, four fields and two buttons.
 *
 * The fixed words are drawn as themselves — the caption, the photo hint, the
 * member-number label and line, the field labels — from the form's own
 * components and constants, so they wrap exactly as the form's do; what the
 * read brings (photo, number, values) and every control is a block at its
 * box: the 80px photo with the camera badge on its corner, the 44px copy
 * button, the three fields as their own empty controls
 * (FIELD_SKELETON_CLASS), BirthdayPicker's own skeleton (its grid, its 52px
 * parts), Cancel (46px) and Save beside it.
 * /me/profile/loading.tsx draws this same one.
 */
export function EditProfileSkeleton() {
  return (
    <MeScreen title="Personal details">
      <ProfileCaption />

      <div className="mt-5 flex justify-center">
        <div className="relative">
          <Skeleton className={PHOTO_BOX_CLASS} />
          <Skeleton className={CAMERA_BADGE_BOX_CLASS} />
        </div>
      </div>
      <PhotoHint />

      <MemberNumberCard
        number={<SkeletonLine className={MEMBER_NUMBER_CLASS} bar="w-32" />}
        action={<Skeleton className={COPY_BUTTON_BOX_CLASS} />}
      />

      <div className={FIELDS_CLASS} aria-hidden>
        {[FIELD_LABEL.firstName, FIELD_LABEL.lastName].map((label) => (
          <div key={label}>
            <FieldLabel>{label}</FieldLabel>
            <input
              disabled
              tabIndex={-1}
              aria-hidden
              className={FIELD_SKELETON_CLASS}
            />
          </div>
        ))}
        <div>
          <FieldLabel>{FIELD_LABEL.sex}</FieldLabel>
          <select
            disabled
            tabIndex={-1}
            aria-hidden
            className={cn(FIELD_SKELETON_CLASS, "text-transparent")}
          />
        </div>
        <div>
          <FieldLabel>{FIELD_LABEL.birthday}</FieldLabel>
          <BirthdayPickerSkeleton />
        </div>
      </div>

      <div className={ACTIONS_CLASS}>
        <Skeleton className="h-11.5 flex-1" />
        <Skeleton className="h-11.5 flex-1" />
      </div>
      <p role="status" className="sr-only">
        Loading your details
      </p>
    </MeScreen>
  );
}

function EditProfileForm({
  profile,
  onProfileChange,
}: {
  profile: ConsumerProfile;
  onProfileChange: (next: ConsumerProfile) => void;
}) {
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

  function goBack() {
    router.back();
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
      const updated = await apiUpdateConsumerProfile(supabase, {
        avatar_url: publicUrl,
      });
      toast("Photo updated.");
      onProfileChange(updated);
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
      const updated = await apiUpdateConsumerProfile(supabase, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        ...(sex === "male" || sex === "female" ? { sex } : {}),
        birthday,
      });
      toast("Profile updated.");
      onProfileChange(updated);
      goBack();
    } catch (e) {
      toast(errMsg(e, "Couldn't save your profile."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <MeScreen title="Personal details">
      <ProfileCaption />

      <div className="mt-5 flex justify-center">
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
          className="group relative disabled:opacity-70"
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
                <Image
                  src={displayAvatarUrl}
                  alt="Profile photo"
                  fill
                  sizes="80px"
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
      </div>
      <PhotoHint />

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

      <div className={FIELDS_CLASS}>
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
        <label className="block">
          <FieldLabel>{FIELD_LABEL.sex}</FieldLabel>
          <select
            value={sex}
            onChange={(e) => setSex(e.target.value)}
            className={FIELD_CLASS}
          >
            <option value="">Select</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
          </select>
        </label>
        <label className="block">
          <FieldLabel>{FIELD_LABEL.birthday}</FieldLabel>
          <BirthdayPicker value={birthday} onChange={setBirthday} />
        </label>
      </div>

      <div className={ACTIONS_CLASS}>
        <button
          type="button"
          onClick={goBack}
          className={SHEET_CANCEL_BUTTON_CLASS}
        >
          Cancel
        </button>
        <Button
          type="button"
          size="sm"
          onClick={() => void save()}
          disabled={!dirty || saving || uploadingPhoto}
          className="flex-1 text-sm font-semibold"
        >
          {saving && (
            <Spinner size="sm" className="border-white/40 border-t-white" />
          )}
          {saving ? "Saving…" : "Save"}
        </Button>
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
    <label className="block">
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
