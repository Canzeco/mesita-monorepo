"use client";

import { useEffect, useState } from "react";
import { Phone } from "lucide-react";
import { apiFetchConsumerProfile } from "@/lib/api/profile";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { formatPhoneDisplay } from "@/lib/utils";
import { SettingsInfoRow } from "./settings-rows";

// The login phone, in Settings › Your account (Pato, MESITA-2547: "I don't
// think that the phone number must be shown in the card. that is super
// private. remove it from there and maybe move it to settings"). Display,
// not a door: the phone is the auth identity, set at sign-in (MESITA-1657),
// so there is nothing to edit here.
export function PhoneRow() {
  const getSupabase = useLazyBrowserSupabase();
  const [phone, setPhone] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetchConsumerProfile(getSupabase())
      .then(({ consumer }) => {
        if (!cancelled)
          setPhone(formatPhoneDisplay(consumer.phone) ?? "Not set");
      })
      .catch(() => {
        if (!cancelled) setPhone("Not set");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SettingsInfoRow
      Icon={Phone}
      tint="muted"
      label="Phone"
      value={phone ?? "…"}
    />
  );
}
