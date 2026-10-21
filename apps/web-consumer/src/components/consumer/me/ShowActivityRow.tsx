"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import {
  apiFetchConsumerProfile,
  apiUpdateConsumerProfile,
} from "@/lib/api/profile";
import { useConsumerIdentity } from "@/lib/identity-context";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { toast } from "@/lib/toast";
import { errMsg } from "@/lib/utils";
import { SettingsLinkRow, ServerToggleRow } from "./settings-rows";

// "Show my activity" (Social v1, MESITA-2442). A server fact
// (consumers.show_activity, on by default), not a device pref: it decides
// whether this member appears in anyone's Social feed or place line. It only
// means something once Instagram is connected — nobody without a handle ever
// appears — so before that the row is the way to connect. It reads PUBLIC
// PROFILE (Pato, MESITA-2547: "check if enabling public profile or not"): on,
// your card (picture, name, hidden Instagram) and activity show in Social;
// off, you never appear. The stored key stays `show_activity`.
export function ShowActivityRow() {
  const { igConnected } = useConsumerIdentity();
  const getSupabase = useLazyBrowserSupabase();
  const [on, setOn] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!igConnected) return;
    let cancelled = false;
    apiFetchConsumerProfile(getSupabase())
      .then(({ consumer }) => {
        if (!cancelled) setOn(consumer.show_activity !== false);
      })
      .catch(() => {
        if (!cancelled) setOn(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [igConnected]);

  if (!igConnected) {
    return (
      <SettingsLinkRow
        Icon={Users}
        tint="muted"
        href={CONSUMER_ROUTES.mePages.instagram}
        label="Public profile"
        sub="Connect Instagram to appear in Social"
      />
    );
  }

  const flip = () => {
    if (on == null || pending) return;
    const next = !on;
    setOn(next);
    setPending(true);
    apiUpdateConsumerProfile(getSupabase(), { show_activity: next })
      .catch((e) => {
        setOn(!next);
        toast.error(errMsg(e, "Couldn't change that."));
      })
      .finally(() => setPending(false));
  };

  return (
    <ServerToggleRow
      Icon={Users}
      tint="instagram"
      label="Public profile"
      sub="Your card and activity in Social"
      on={on ?? true}
      disabled={on == null || pending}
      onToggle={flip}
    />
  );
}
