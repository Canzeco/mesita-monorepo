"use client";

import { Crown } from "lucide-react";
import { DefaultAvatar, SizedImg } from "@mesita/place-profile";
import { instagramWithFollowers } from "@/lib/consumer-identity";
import { toGuestClass } from "@/lib/guest-standing";
import { useServerProfile } from "@/lib/identity-context";

// A QUICK PASSPORT (Pato, MESITA-3260: "part of the card, like the profile picture
// and instagram number of followers and name"): who is holding the phone, in one row
// above the QR, so staff can match the face and see the followers. The Me card is
// 200px and would push the code off a small phone. Facts only, no doors. A failed
// profile read draws nothing, never a guess.

export function GuestPassport() {
  const profile = useServerProfile();
  if (!profile) return null;
  const name = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || profile.full_name || "Mesita member";
  const instagram = profile.instagram_handle
    ? instagramWithFollowers(`@${profile.instagram_handle}`, profile.instagram_followers_count, Boolean(profile.instagram_verified_at))
    : null;
  return (
    <div className="border-border bg-card flex w-full items-center gap-3 rounded-2xl border p-3 text-left">
      <span className="bg-muted block h-12 w-12 shrink-0 overflow-hidden rounded-full">
        {profile.avatar_url ? (
          <SizedImg src={profile.avatar_url} size="thumb" alt="" className="h-full w-full object-cover" />
        ) : (
          <DefaultAvatar className="h-full w-full" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{name}</span>
        {instagram ? <span className="text-muted-foreground block truncate text-sm">{instagram}</span> : null}
      </span>
      {toGuestClass(profile.guest_class) === "vip" ? (
        <span className="bg-foreground text-paper flex h-7 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-semibold">
          <Crown className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
          VIP
        </span>
      ) : null}
    </div>
  );
}
