"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { cn, errMsg } from "@/lib/utils";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import {
  apiUpdateConsumerProfile,
  type ConsumerProfile,
} from "@/lib/api/profile";

// Bottom-sheet identity editor — opened from the profile hero's "Edit
// profile" button and the Settings → Account row. Writes through
// consumer-web-update-profile; email is the auth identity and stays
// read-only here.

export function EditProfileSheet({
  profile,
  email,
  onClose,
  onSaved,
}: {
  profile: ConsumerProfile;
  email: string | null;
  onClose: () => void;
  onSaved: (updated: ConsumerProfile) => void;
}) {
  const supabase = useBrowserSupabase();
  const [firstName, setFirstName] = useState(profile.first_name ?? "");
  const [lastName, setLastName] = useState(profile.last_name ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [saving, setSaving] = useState(false);

  const dirty =
    firstName.trim() !== (profile.first_name ?? "") ||
    lastName.trim() !== (profile.last_name ?? "") ||
    phone.trim() !== (profile.phone ?? "");

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
      // Preserve the fields not edited here (sex/birthday/country) so the
      // required-field EF contract stays satisfied.
      const updated = await apiUpdateConsumerProfile(supabase, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        sex: (profile.sex as "male" | "female" | "other") ?? "other",
        birthday: profile.birthday ?? "",
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
    <div className="absolute inset-0 z-50 flex items-end">
      <div
        className="bg-foreground/30 absolute inset-0 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className="bg-card shadow-elev relative z-10 w-full rounded-t-3xl p-5">
        <div className="bg-foreground/30 mx-auto mb-3 h-1 w-12 rounded-full" />

        <div className="flex items-center gap-3">
          <span className="bg-pink-gradient flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white">
            <span className="font-display text-[15px] font-bold tracking-tight">
              {initials}
            </span>
          </span>
          <div>
            <h2 className="font-display text-xl font-semibold tracking-tight">
              Edit profile
            </h2>
            <p className="text-muted-foreground text-[12px]">
              How you appear across Mesita
            </p>
          </div>
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
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
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
