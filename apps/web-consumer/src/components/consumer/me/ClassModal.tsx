"use client";

// /me/class — Class, Regular or VIP, behind Me's Class tile (MESITA-2562).
// The same body the header's Class chip opens as a sheet (ClassList), in the
// frame every Me box wears. While the class is unknown (the read failed)
// neither row claims it, and nothing assumes Regular.

import { ClassList } from "@/components/consumer/me/ClassSheet";
import { MeScreen } from "@/components/consumer/me/MeScreen";
import type { GuestClass } from "@/lib/guest-standing";

export function ClassModal({ guestClass }: { guestClass: GuestClass | null }) {
  return (
    <MeScreen title="Class">
      <ClassList guestClass={guestClass} />
    </MeScreen>
  );
}
