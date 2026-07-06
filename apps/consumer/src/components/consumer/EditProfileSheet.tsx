"use client";

import { useState } from "react";
import { Camera } from "lucide-react";
import { toast } from "@/lib/toast";
import { cn, errMsg } from "@/lib/utils";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { Spinner } from "@/components/shared/Spinner";
import {
  apiUpdateConsumerProfile,
  type ConsumerProfile,
} from "@/lib/api/profile";

// Bottom-sheet identity editor — opened from the profile hero's "Edit
// profile" button and the Settings → Account row. Writes through
// consumer-web-update-profile; email is the auth identity and stays
// read-only here.
//
// Built on LocalSheet: parent keeps it mounted and flips `open`, so the
// sheet animates both ways, the backdrop covers the whole MobileFrame card,
// and ESC closes it. Field state survives a close (draft-friendly) and the
// dirty check tracks the latest saved profile.

export function EditProfileSheet({
  profile,
  email,
  open,
  onClose,
  onSaved,
}: {
  profile: ConsumerProfile;
  email: string | null;
  open: boolean;
  onClose: () => void;
  onSaved: (updated: ConsumerProfile) => void;
}) {
  const supabase = useBrowserSupabase();
  const [firstName, setFirstName] = useState(profile.first_name ?? "");
  const [lastName, setLastName] = useState(profile.last_name ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  // birthday is stored as YYYY-MM-DD; a native date input round-trips it.
  const [birthday, setBirthday] = useState(profile.birthday ?? "");
  const [saving, setSaving] = useState(false);

  const dirty =
    firstName.trim() !== (profile.first_name ?? "") ||
    lastName.trim() !== (profile.last_name ?? "") ||
    phone.trim() !== (profile.phone ?? "") ||
    birthday !== (profile.birthday ?? "");

  const initials =
    `${firstName.trim().charAt(0)}${lastName.trim().charAt(0)}`.toUpperCase() ||
    "M";

  async function save() {
    if (!dirty || saving) return;
    if (!firstName.trim() || !lastName.trim()) {
      toast("First and last name are required.");
      return;
    }
    setSaving(true);
    try {
      // Preserve the fields not edited here (sex/country) so the
      // required-field EF contract stays satisfied.
      const updated = await apiUpdateConsumerProfile(supabase, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        sex: (profile.sex as "male" | "female" | "other") ?? "other",
        birthday: birthday || "",
        country: profile.country ?? "",
        phone: phone.trim() || undefined,
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
      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto p-5">
        <h2 className="font-display text-xl font-semibold tracking-tight">
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
            <span className="bg-pink-gradient flex h-20 w-20 items-center justify-center rounded-full text-white shadow-sm">
              <span className="font-display text-2xl font-bold tracking-tight">
                {initials}
              </span>
            </span>
            <span className="border-background bg-foreground text-background absolute -right-0.5 -bottom-0.5 flex h-7 w-7 items-center justify-center rounded-full border-2 shadow-sm transition group-active:scale-95">
              <Camera className="h-3.5 w-3.5" />
            </span>
          </button>
        </div>

        <div className="mt-5 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
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
          </div>
          <SheetField
            label="Phone"
            value={phone}
            onChange={setPhone}
            placeholder="+52 …"
            inputMode="tel"
          />
          <label className="block">
            <span className="text-muted-foreground mb-1 block text-[11px] font-medium">
              Birthday
            </span>
            <input
              type="date"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
              className="border-border bg-background focus:border-primary w-full rounded-lg border px-3 py-2 text-sm outline-none"
            />
          </label>
          <div>
            <span className="text-muted-foreground mb-1 block text-[11px] font-medium">
              Email
            </span>
            <p className="border-border bg-muted/40 text-muted-foreground rounded-lg border px-3 py-2 text-sm">
              {email ?? "—"}
            </p>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="border-border bg-card hover:bg-muted flex-1 rounded-lg border py-3 text-sm font-semibold transition"
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
        className="border-border bg-background focus:border-primary w-full rounded-lg border px-3 py-2 text-sm outline-none"
      />
    </label>
  );
}
