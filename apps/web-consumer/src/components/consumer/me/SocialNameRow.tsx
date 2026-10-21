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
import { IconCircle, Switch } from "@/components/consumer/me/settings-rows";

// "SHOW MY NAME IN SOCIAL" (Pato, MESITA-2590: "a Settings switch where
// private means you appear as 'A member'"). A server fact,
// consumers.appear_anonymous (default false, so the switch is on). Off, the
// guest's activity still shows in Social, as "A member" with no name, photo
// or handle (MESITA-2580); it never disappears. Same shape as Me › Instagram's
// "Use my Instagram photo" switch (MESITA-2585).
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
      <IconCircle tint="muted">
        <UserRound className="h-[18px] w-[18px]" />
      </IconCircle>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">Show my name in Social</span>
        <span className="text-muted-foreground type-label block">
          {shown
            ? "Your name, photo and @handle show with what you like"
            : "You show as “A member”"}
        </span>
      </span>
      <Switch on={shown} />
    </button>
  );
}
