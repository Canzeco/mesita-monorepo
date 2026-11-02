"use client";

import { usePathname } from "next/navigation";
import { ProfileTab } from "@/components/place-manage/ProfileTab";
import { placeTabFromPathname } from "@/lib/place-tabs";

// The profile editor stays mounted on every tab. Leaving /profile used to
// unmount it, and the section cleanup wiped the draft. Off Profile the form
// is hidden and inert so it cannot take focus.
export function PlaceScroll({ children }: { children: React.ReactNode }) {
  const tab = placeTabFromPathname(usePathname());
  const onProfile = tab === "profile";
  return (
    <div className="min-h-0 flex-1 overflow-y-auto pb-8">
      <div className={onProfile ? undefined : "hidden"} inert={!onProfile}>
        <ProfileTab />
      </div>
      {children}
    </div>
  );
}
