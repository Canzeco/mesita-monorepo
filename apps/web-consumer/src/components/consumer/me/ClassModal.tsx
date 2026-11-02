"use client";

// /me/class — Class, Regular or VIP, behind Me's Class tile (MESITA-2562).
// The same body the header's Class chip opens as a sheet (ClassList), in the
// frame every Me box wears. Class is Soon (MESITA-3099): nothing here reads
// the guest's own class.

import { ClassList } from "@/components/consumer/me/ClassSheet";
import { MeScreen } from "@/components/consumer/me/MeScreen";

export function ClassModal() {
  return (
    <MeScreen title="Class">
      <ClassList />
    </MeScreen>
  );
}
