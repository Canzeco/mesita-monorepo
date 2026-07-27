"use client";

import { useState } from "react";
import Image from "next/image";
import { Camera } from "lucide-react";
import { toast } from "@/lib/toast";
import {
  ageFromBirthday,
  cn,
  errMsg,
  firstInitial,
  MIN_SIGNUP_AGE,
} from "@/lib/utils";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { Spinner } from "@/components/shared/Spinner";
import { BirthdayPicker } from "@/components/shared/BirthdayPicker";
import {
  INPUT_CLASS,
  SHEET_BODY_CLASS,
  SHEET_CANCEL_BUTTON_CLASS,
  SHEET_TITLE_CLASS,
} from "@/lib/ui-classes";
import {
  apiUpdateConsumerProfile,
  type ConsumerProfile,
} from "@/lib/api/profile";

// Bottom-sheet identity editor — opened from the profile hero's "Edit
// profile" button and the Settings → Account row. Writes through
// consumer-web-update-profile. Consumers auth with their phone (not email),
// so email isn't shown or edited here.
//
// Built on LocalSheet: parent keeps it mounted and flips `open`, so the
// sheet animates both ways, the backdrop covers the whole MobileFrame card,
// and ESC closes it. Field state survives a close (draft-friendly) and the
// dirty check tracks the latest saved profile. Phone is auth identity (set at
// sign-in) and is not editable here — only first name, last name and
// birthday. Both name halves are required and always sent together: the EF
// re-derives full_name from them, and that's the name reservations are
// booked under.

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
  const [firstName, setFirstName] = useState(profile.first_name ?? "");
  const [lastName, setLastName] = useState(profile.last_name ?? "");
  // birthday is stored as YYYY-MM-DD; the BirthdayPicker round-trips it.
  const [birthday, setBirthday] = useState(profile.birthday ?? "");
  const [saving, setSaving] = useState(false);

  const dirty =
    firstName.trim() !== (profile.first_name ?? "") ||
    lastName.trim() !== (profile.last_name ?? "") ||
    birthday !== (profile.birthday ?? "");

  const initials = firstInitial(firstName, "M");

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
      // Sex isn't edited here and is never re-sent — the EF patches only the
      // keys present, so omitting it leaves the stored value untouched (and
      // avoids resurrecting the dropped "other" value). Country is no longer
      // collected anywhere — it's inferred from the phone's dial code.
      const updated = await apiUpdateConsumerProfile(supabase, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        birthday: birthday || "",
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
        <h2 className={SHEET_TITLE_CLASS}>
          Personal details
        </h2>
        <p className="text-muted-foreground text-[12px]">
          How you appear across Mesita
        </p>

        {/* Tappable avatar — photo upload isn't wired to storage yet, so it
            surfaces a coming-soon toast rather than a dead control. */}
        <div className="mt-5 flex justify-center">
          <button
            type="button"
            onClick={() => toast("Photo uploads are coming soon.")}
            className="group relative"
            aria-label="Change profile photo"
          >
            <span className="bg-pink-gradient relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full text-white shadow-sm">
              {profile.avatar_url ? (
                <Image
                  src={profile.avatar_url}
                  alt="Profile photo"
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              ) : (
                <span className="font-display text-2xl font-bold tracking-tight">
                  {initials}
                </span>
              )}
            </span>
            <span className="border-background bg-foreground text-background absolute -right-0.5 -bottom-0.5 flex h-7 w-7 items-center justify-center rounded-full border-2 shadow-sm transition group-active:scale-95">
              <Camera className="h-3.5 w-3.5" />
            </span>
          </button>
        </div>

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
            <span className="text-muted-foreground mb-1 block text-[11px] font-medium">
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
          <button
            type="button"
            onClick={() => void save()}
            disabled={!dirty || saving}
            className={cn(
              "bg-pink-gradient flex flex-1 items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold text-white transition",
              (!dirty || saving) && "opacity-60",
            )}
          >
            {saving && (
              <Spinner size="sm" className="border-white/40 border-t-white" />
            )}
            {saving ? "Saving…" : "Save"}
          </button>
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
      <span className="text-muted-foreground mb-1 block text-[11px] font-medium">
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
