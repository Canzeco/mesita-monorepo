"use client";

import { useEffect, useState } from "react";
import { Mail, Phone } from "lucide-react";
import { useConsumerProfile } from "@/lib/use-consumer-profile";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { formatPhoneDisplay } from "@/lib/utils";
import { SettingsInfoRow } from "./settings-rows";

// How the guest signs in, in Settings › Your account (Pato, MESITA-2547:
// the phone is private, so it lives here, not on the card). Display, not a
// door. The phone paints with the page from the kept profile row
// (MESITA-3014); a guest without one signed in with Google or an email code
// (MESITA-3777), so the row shows that email, read from the local session
// (no network).
type Account = { email: string; via: "Google" | "Email" } | null;

export function PhoneRow() {
  const { data, error } = useConsumerProfile();
  const supabase = useBrowserSupabase();
  const [account, setAccount] = useState<Account>(null);
  const phone = data ? formatPhoneDisplay(data.phone) : null;

  useEffect(() => {
    if (!data || phone) return;
    let live = true;
    void supabase.auth.getSession().then(({ data: s }) => {
      const user = s.session?.user;
      if (!live || !user?.email) return;
      const providers = (user.app_metadata?.providers as string[] | undefined) ?? [];
      setAccount({ email: user.email, via: providers.includes("google") ? "Google" : "Email" });
    });
    return () => {
      live = false;
    };
  }, [data, phone, supabase]);

  if (account && !phone) {
    return <SettingsInfoRow Icon={Mail} tint="muted" label={account.via} value={account.email} />;
  }
  const value = data ? (phone ?? "Not set") : error ? "Not set" : "…";
  return <SettingsInfoRow Icon={Phone} tint="muted" label="Phone" value={value} />;
}
