"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Camera } from "lucide-react";
import { BirthdayPicker, Spinner } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { DefaultAvatar } from "@/components/consumer/DefaultAvatar";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
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
import {
  INPUT_CLASS,
  SHEET_BODY_CLASS,
  SHEET_CANCEL_BUTTON_CLASS,
  SHEET_TITLE_CLASS,
} from "@/lib/ui-classes";
import { ageFromBirthday, cn, errMsg, MIN_SIGNUP_AGE } from "@/lib/utils";

// Bottom-sheet identity editor — opened from the profile hero's "Edit
// profile" button and the Settings → Account row. Writes through
// consumer-web-update-profile. Consumers auth with their phone (not email),
// so email isn't shown or edited here.
//
// Built on LocalSheet: parent keeps it mounted and flips `open`, so the
// sheet animates both ways, the backdrop covers the whole MobileFrame card,
// and ESC closes it. Field state survives a close (draft-friendly) and the
// dirty check tracks the latest saved profile. Phone is auth identity (set at
// sign-in) and is not editable here — only first name, last name, sex and
// birthday, the same set onboarding collects. Both name halves are required
// and always sent together: the EF re-derives full_name from them, and that's
// the name reservations are booked under.
//
// Photo upload (MESITA-953) is immediate on pick: Storage → EF avatar_url
// patch → parent refresh. Name/sex/birthday still save via the Save button.

export function EditProfileSheet({
  profile,
  open,
  onClose,
  onSaved,
}: {
  profile: ConsumerProfile;
  open: boolean;
  onClose: () => void;
  onSaved: (updated: ConsumerProfile) => void;
}) {
  const supabase = useBrowserSupabase();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [firstName, setFirstName] = useState(profile.first_name ?? "");
  const [lastName, setLastName] = useState(profile.last_name ?? "");
  // Male/Female only (MESITA-727). "" = nothing stored yet, which is why the
  // select carries an empty option — a legacy profile shouldn't silently
  // acquire a sex just by opening this sheet.
  const [sex, setSex] = useState(profile.sex ?? "");
  // birthday is stored as YYYY-MM-DD; the BirthdayPicker round-trips it.
  const [birthday, setBirthday] = useState(profile.birthday ?? "");
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  // Local preview while upload runs; falls back to the saved avatar_url.
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const displayAvatarUrl = previewUrl ?? profile.avatar_url ?? null;

  const dirty =
    firstName.trim() !== (profile.first_name ?? "") ||
    lastName.trim() !== (profile.last_name ?? "") ||
    sex !== (profile.sex ?? "") ||
    birthday !== (profile.birthday ?? "");

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
      onSaved(updated);
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
    // Age gate — 13 or below is restricted (MESITA-727).
    const age = ageFromBirthday(birthday);
    if (age !== null && age < MIN_SIGNUP_AGE) {
      toast(`You must be at least ${MIN_SIGNUP_AGE} to use Mesita.`);
      return;
    }
    setSaving(true);
    try {
      // Sex is only sent once it's actually set: the EF patches the keys it
      // receives, so omitting it leaves the stored value untouched rather than
      // nulling it (and never resurrects the dropped "other" value). Country is
      // no longer collected anywhere — it's inferred from the phone's dial code.
      const updated = await apiUpdateConsumerProfile(supabase, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        ...(sex === "male" || sex === "female" ? { sex } : {}),
        birthday,
      });
      toast("Profile updated.");
      onSaved(updated);
      onClose();
    } catch (e) {
      toast(errMsg(e, "Couldn't save your profile."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <LocalSheet open={open} onClose={onClose} ariaLabel="Edit profile">
      <div className={SHEET_BODY_CLASS}>
        <h2 className={SHEET_TITLE_CLASS}>Personal details</h2>
        <p className="text-muted-foreground text-xs">
          How you appear across Mesita
        </p>

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
            {/* Story-ring around the photo, matching the profile hero. */}
            <span className="bg-pink-gradient shadow-rest flex h-20 w-20 rounded-full p-[2.5px]">
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
            <span className="border-background bg-foreground text-background shadow-rest absolute -right-0.5 -bottom-0.5 flex h-7 w-7 items-center justify-center rounded-full border-2 transition group-active:scale-95">
              <Camera className="h-3.5 w-3.5" />
            </span>
          </button>
        </div>
        <p className="text-muted-foreground type-label mt-2 text-center">
          JPG, PNG, or WEBP · max 2 MB
        </p>

        <div className="mt-5 flex flex-col gap-3">
          <SheetField
            label="First name"
            value={firstName}
            onChange={setFirstName}
            placeholder="First name"
          />
          <SheetField
            label="Last name"
            value={lastName}
            onChange={setLastName}
            placeholder="Last name"
          />
          <label className="block">
            <span className="text-muted-foreground type-label mb-1 block font-medium">
              Sex
            </span>
            <select
              value={sex}
              onChange={(e) => setSex(e.target.value)}
              className={cn(INPUT_CLASS, "h-auto rounded-lg py-2")}
            >
              <option value="">Select</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
            </select>
          </label>
          <label className="block">
            <span className="text-muted-foreground type-label mb-1 block font-medium">
              Birthday
            </span>
            <BirthdayPicker value={birthday} onChange={setBirthday} />
          </label>
        </div>

        <div className="mt-8 flex gap-2">
          <button
            type="button"
            onClick={onClose}
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
      </div>
    </LocalSheet>
  );
}

function SheetField({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: "text" | "tel";
}) {
  return (
    <label className="block">
      <span className="text-muted-foreground type-label mb-1 block font-medium">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className={cn(INPUT_CLASS, "h-auto rounded-lg py-2")}
      />
    </label>
  );
}
