"use client";

import { Phone } from "lucide-react";
import { useConsumerProfile } from "@/lib/use-consumer-profile";
import { formatPhoneDisplay } from "@/lib/utils";
import { SettingsInfoRow } from "./settings-rows";

// The login phone, in Settings › Your account (Pato, MESITA-2547: "I don't
// think that the phone number must be shown in the card. that is super
// private. remove it from there and maybe move it to settings"). Display,
// not a door: the phone is the auth identity, set at sign-in (MESITA-1657),
// so there is nothing to edit here.
export function PhoneRow() {
  // The kept profile row (MESITA-3014): the number paints with the page.
  const { data, error } = useConsumerProfile();
  const phone = data
    ? (formatPhoneDisplay(data.phone) ?? "Not set")
    : error
      ? "Not set"
      : null;

  return (
    <SettingsInfoRow
      Icon={Phone}
      tint="muted"
      label="Phone"
      value={phone ?? "…"}
    />
  );
}
