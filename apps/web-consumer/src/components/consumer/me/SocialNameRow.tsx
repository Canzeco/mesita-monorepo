"use client";

import { useEffect, useState } from "react";
import { UserRound } from "lucide-react";
import { errMsg } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import {
  apiFetchConsumerProfile,
  apiUpdateConsumerProfile,
} from "@/lib/api/profile";
import { IconChip, Switch } from "@/components/consumer/me/settings-rows";
import { PUBLIC_PROFILE_SWITCH } from "@/components/consumer/me/switch-words";

// "PUBLIC PROFILE" (Pato, MESITA-2590: "a Settings switch where private
// means you appear as 'A member'"; MESITA-2594 named it Public profile and
// asks it on Me › Instagram too). A server fact, consumers.appear_anonymous
// (default false, so the switch is on). Off, the guest's activity still shows
// in Social, by first name, with no photo or handle (MESITA-2612 retired "A
// member"); it never disappears. Private also costs something: you see others' Instagram
// only if you show yours (MESITA-2594), so a private member sees "per***".
// Same shape as Me › Instagram's "Use my Instagram photo" switch
// (MESITA-2585). Its words live in switch-words.ts, which the Settings and
// Instagram fallbacks read too (MESITA-2701).
export function SocialNameRow() {
  const supabase = useBrowserSupabase();
  const [named, setNamed] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetchConsumerProfile(supabase)
      .then(({ consumer }) => {
        if (!cancelled) setNamed(consumer.appear_anonymous !== true);
      })
      .catch(() => {
        if (!cancelled) setNamed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const flip = () => {
    if (named == null || pending) return;
    const next = !named;
    setNamed(next);
    setPending(true);
    apiUpdateConsumerProfile(supabase, { appear_anonymous: !next })
      .catch((e) => {
        setNamed(!next);
        toast.error(errMsg(e, "Couldn't change that."));
      })
      .finally(() => setPending(false));
  };

  const shown = named ?? true;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={shown}
      disabled={named == null || pending}
      onClick={flip}
      className="hover:bg-muted flex w-full items-center gap-3 px-4 py-3 text-left transition disabled:opacity-60"
      data-social-name-switch
    >
      <IconChip>
        <UserRound className="h-[18px] w-[18px]" />
      </IconChip>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">
          {PUBLIC_PROFILE_SWITCH.label}
        </span>
        <span className="text-muted-foreground type-label block">
          {shown ? PUBLIC_PROFILE_SWITCH.on : PUBLIC_PROFILE_SWITCH.off}
        </span>
      </span>
      <Switch on={shown} />
    </button>
  );
}
