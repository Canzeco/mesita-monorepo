"use client";

// /me/class — Class, Regular or VIP, behind Me's Class tile (MESITA-2562).
// The same body the header's Class chip opens as a sheet (ClassList), in the
// frame every Me box wears. While the class is unknown (the read failed)
// neither row claims it, and nothing assumes Regular.

import {
  type ClassInstagram,
  ClassList,
} from "@/components/consumer/me/ClassSheet";
import { MeScreen } from "@/components/consumer/me/MeScreen";
import type { GuestClass, VipDetails } from "@/lib/guest-standing";

export function ClassModal({
  guestClass,
  vip = null,
  instagram = null,
}: {
  guestClass: GuestClass | null;
  vip?: VipDetails | null;
  /** For the Join with Instagram row (MESITA-3054). */
  instagram?: ClassInstagram;
}) {
  return (
    <MeScreen title="Class">
      <ClassList guestClass={guestClass} vip={vip} instagram={instagram} />
    </MeScreen>
  );
}
