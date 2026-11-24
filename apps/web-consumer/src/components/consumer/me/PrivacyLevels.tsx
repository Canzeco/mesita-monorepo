"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Eye, Lock, X } from "lucide-react";
import { LocalDialog } from "@/components/consumer/overlay/LocalOverlay";
import { Instagram } from "@/components/shared/instagram-icon";
import { IconChip } from "@/components/consumer/me/settings-rows";
import {
  apiUpdateConsumerProfile,
  type ConsumerProfile,
  type SocialLevel,
} from "@/lib/api/profile";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { navigateTo } from "@/lib/navigate";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { toast } from "@/lib/toast";
import { cn, errMsg } from "@/lib/utils";

// PRIVACY (MESITA-4850): Private, Public, Public + Instagram, on Me › Profile.
// It never touches browsing, Pay, Prepay or the QR. A guest under 18 is always
// Private and sees why, with no choice (Pato, 2026-11-24: "minors have their
// accounts in private automatically and cannot change that configuration").
// The server decides the level and the lock; this only draws them.

const LEVELS: { level: SocialLevel; title: string; sub: string }[] = [
  {
    level: "private",
    title: "Private",
    sub: "Other guests never see you or your activity, and you don't see theirs.",
  },
  {
    level: "public",
    title: "Public",
    sub: "Your activity shows with your first name, age and sex. No photo, no Instagram.",
  },
  {
    level: "instagram",
    title: "Public + Instagram",
    sub: "Your photo shows too, and a link to your Instagram. Your Instagram may show your full name.",
  },
];

function LevelIcon({ level }: { level: SocialLevel }) {
  const size = "h-[18px] w-[18px]";
  if (level === "instagram") return <Instagram className={size} />;
  return level === "private" ? <Lock className={size} /> : <Eye className={size} />;
}

// A ROW LIKE SEX, ITS CHOICES IN A MODAL (Pato, 2026-11-24, MESITA-4854:
// "privacy selection must be kinda like sex selection, not there floating
// below … click something and then open a modal"). It saves on the pick.
export function PrivacyLevels({
  profile,
  rowClass,
  labelClass,
  valueClass,
}: {
  profile: ConsumerProfile;
  /** The fields' own row, label and value classes. */
  rowClass: string;
  labelClass: string;
  valueClass: string;
}) {
  const supabase = useBrowserSupabase();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState<SocialLevel | null>(null);
  const level = profile.social_level;
  // An older server says nothing: draw nothing rather than a guess.
  if (!level) return null;
  const lock = profile.social_lock;
  const shown = saving ?? level;

  const pick = (next: SocialLevel) => {
    if (saving) return;
    setOpen(false);
    if (next === level) return;
    if (next === "instagram" && !profile.instagram_handle) {
      navigateTo(router, CONSUMER_ROUTES.mePages.instagram, { motion: "drill" });
      return;
    }
    setSaving(next);
    apiUpdateConsumerProfile(supabase, { social_level: next })
      .catch((e) => toast.error(errMsg(e, "Couldn't change that.")))
      .finally(() => setSaving(null));
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={cn(rowClass, "hover:bg-muted relative w-full text-left transition")}
        data-profile-privacy={shown}
      >
        <span className={labelClass}>Privacy</span>
        <span className={cn(valueClass, "flex items-center truncate pr-6")}>
          {LEVELS.find((l) => l.level === shown)?.title}
        </span>
        <ChevronDown aria-hidden className="text-muted-foreground pointer-events-none absolute right-4 h-4 w-4" />
      </button>
      <LocalDialog open={open} onClose={() => setOpen(false)} ariaLabel="Privacy" fit>
        <div className="border-border flex h-14 shrink-0 items-center justify-between border-b pr-2 pl-5">
          <h2 className="text-base font-semibold">Privacy</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="hover:bg-muted flex h-11 w-11 items-center justify-center rounded-full transition"
          >
            <X className="h-5 w-5" strokeWidth={2.25} aria-hidden />
          </button>
        </div>
        {lock ? (
          <div className="flex items-start gap-3 px-5 py-4" data-privacy-locked={lock}>
            <IconChip>
              <Lock className="h-[18px] w-[18px]" />
            </IconChip>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">Private</span>
              <span className="text-muted-foreground type-label block">
                {lock === "minor"
                  ? "Profiles of guests under 18 are always private and don't see Social. This can't be changed."
                  : "Save your year of birth to choose who sees you and to see Social."}
              </span>
            </span>
          </div>
        ) : (
          <div role="radiogroup" aria-label="Privacy" className="divide-border scrollbar-thin-dark min-h-0 divide-y overflow-y-auto">
            {LEVELS.map((l) => (
              <button
                key={l.level}
                type="button"
                role="radio"
                aria-checked={shown === l.level}
                onClick={() => pick(l.level)}
                className="hover:bg-muted flex w-full items-start gap-3 px-5 py-4 text-left transition"
                data-privacy-level={l.level}
              >
                <IconChip tint={l.level === "instagram" ? "instagram" : "muted"}>
                  <LevelIcon level={l.level} />
                </IconChip>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{l.title}</span>
                  <span className="text-muted-foreground type-label block">
                    {l.level === "instagram" && !profile.instagram_handle
                      ? `Add your Instagram first. ${l.sub}`
                      : l.sub}
                  </span>
                </span>
                <Check
                  aria-hidden
                  className={cn("mt-2 h-5 w-5 shrink-0", shown !== l.level && "invisible")}
                  strokeWidth={2.5}
                />
              </button>
            ))}
          </div>
        )}
      </LocalDialog>
    </>
  );
}
