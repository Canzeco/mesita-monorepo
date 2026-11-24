"use client";

import { usePathname } from "next/navigation";
import { ProfileTab } from "@/components/place-manage/ProfileTab";
import { MONITOR_TABS, placeTabFromPathname } from "@/lib/routes";

// The profile editor stays mounted on every tab. Leaving /profile used to
// unmount it, and the section cleanup wiped the draft. Off Profile the form
// is hidden and inert so it cannot take focus.
// `staff` reaches the Google Reviews card at the foot of the editor.
export function PlaceScroll({ children, staff = false }: { children: React.ReactNode; staff?: boolean }) {
  const tab = placeTabFromPathname(usePathname());
  const onProfile = tab === "profile";
  const wide = onProfile || (tab !== null && MONITOR_TABS.includes(tab));
  // No overflow here: the window scrolls. An overflow box with no height never
  // scrolls, and the sticky save bars inside stuck to it (MESITA-4922).
  return (
    <div className="pb-8">
      <div className={onProfile ? undefined : "hidden"} inert={!onProfile}>
        <ProfileTab staff={staff} />
      </div>
      {/* Monitor is full width (Pato, 2026-11-24, MESITA-4926: "all monitor
          events, only configuration is not full width"), as Profile is. The
          Manage pages sit in Offers' centred column (MESITA-4790). */}
      <div className={wide ? undefined : "mx-auto w-full max-w-3xl"}>{children}</div>
    </div>
  );
}
