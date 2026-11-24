"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Eye, Lock } from "lucide-react";
import { Instagram } from "@/components/shared/instagram-icon";
import { IconChip, SettingsGroup } from "@/components/consumer/me/settings-rows";
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
    sub: "Other guests never see you or your activity.",
  },
  {
    level: "public",
    title: "Public",
    sub: "Your activity shows with your approximate age and sex. No name, no photo.",
  },
  {
    level: "instagram",
    title: "Public + Instagram",
    sub: "Your first name, photo and @handle show to guests who share theirs, and you see theirs. Your Instagram may show your full name.",
  },
];

function LevelIcon({ level }: { level: SocialLevel }) {
  const size = "h-[18px] w-[18px]";
  if (level === "instagram") return <Instagram className={size} />;
  return level === "private" ? <Lock className={size} /> : <Eye className={size} />;
}

export function PrivacyLevels({ profile }: { profile: ConsumerProfile }) {
  const supabase = useBrowserSupabase();
  const router = useRouter();
  const [saving, setSaving] = useState<SocialLevel | null>(null);
  const level = profile.social_level;
  // An older server says nothing: draw nothing rather than a guess.
  if (!level) return null;

  if (profile.social_lock) {
    return (
      <SettingsGroup title="Privacy">
        <div className="flex items-start gap-3 px-4 py-3" data-privacy-locked={profile.social_lock}>
          <IconChip>
            <Lock className="h-[18px] w-[18px]" />
          </IconChip>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Private</span>
            <span className="text-muted-foreground type-label block">
              {profile.social_lock === "minor"
                ? "Profiles of guests under 18 are always private. This can't be changed."
                : "Add your year of birth above to choose who sees you."}
            </span>
          </span>
        </div>
      </SettingsGroup>
    );
  }

  const pick = (next: SocialLevel) => {
    if (saving || next === level) return;
    if (next === "instagram" && !profile.instagram_handle) {
      navigateTo(router, CONSUMER_ROUTES.mePages.instagram, { motion: "drill" });
      return;
    }
    setSaving(next);
    apiUpdateConsumerProfile(supabase, { social_level: next })
      .catch((e) => toast.error(errMsg(e, "Couldn't change that.")))
      .finally(() => setSaving(null));
  };

  const shown = saving ?? level;
  return (
    <SettingsGroup title="Privacy">
      <div role="radiogroup" aria-label="Privacy" className="divide-border/60 divide-y">
        {LEVELS.map((l) => (
          <button
            key={l.level}
            type="button"
            role="radio"
            aria-checked={shown === l.level}
            disabled={saving !== null}
            onClick={() => pick(l.level)}
            className="hover:bg-muted flex w-full items-start gap-3 px-4 py-3 text-left transition"
            data-privacy-level={l.level}
          >
            <IconChip tint={l.level === "instagram" ? "instagram" : "muted"}>
              <LevelIcon level={l.level} />
            </IconChip>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{l.title}</span>
              <span className="text-muted-foreground type-label block">
                {l.level === "instagram" && !profile.instagram_handle
                  ? `Connect your Instagram first. ${l.sub}`
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
    </SettingsGroup>
  );
}
