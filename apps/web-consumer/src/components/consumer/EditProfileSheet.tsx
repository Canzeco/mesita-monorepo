"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { BirthdayPicker, Spinner } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { DefaultAvatar } from "@/components/consumer/DefaultAvatar";
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
// first name, last name, sex and birthday, the same set onboarding collects.
// Both name halves are required and always sent together: the EF re-derives
// full_name from them, and that's the name reservations are booked under.
//
// Photo upload (MESITA-953) is immediate on pick: Storage → EF avatar_url
// patch. Name/sex/birthday still save via the Save button. Cancel and a
// successful Save both pop history back to /me.

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

  if (!profile) {
    return (
      <MeScreen title="Personal details">
        <p className="text-muted-foreground text-xs">
          How you appear across Mesita
        </p>
        <div className="bg-muted mx-auto mt-8 h-20 w-20 animate-pulse rounded-full" />
        <div className="mt-8 flex flex-col gap-3">
          <div className="bg-muted h-11 animate-pulse rounded-lg" />
          <div className="bg-muted h-11 animate-pulse rounded-lg" />
          <div className="bg-muted h-11 animate-pulse rounded-lg" />
        </div>
      </MeScreen>
    );
  }

  return <EditProfileForm profile={profile} onProfileChange={setProfile} />;
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
          autoComplete="given-name"
        />
        <SheetField
          label="Last name"
          value={lastName}
          onChange={setLastName}
          placeholder="Last name"
          autoComplete="family-name"
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
  inputMode,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: "text" | "tel";
  autoComplete?: string;
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
        autoComplete={autoComplete}
        className={cn(INPUT_CLASS, "h-auto rounded-lg py-2")}
      />
    </label>
  );
}
