"use client";

import { ClassModal } from "@/components/consumer/me/ClassModal";
import { toGuestClass, toVipDetails } from "@/lib/guest-standing";
import { useConsumerProfile } from "@/lib/use-consumer-profile";
import ClassLoading from "./loading";

// The class from the kept profile row (MESITA-3014): no server read on the way
// in. A failed read shows both classes with neither marked, never a guessed
// Regular.
export function ClassFromProfile() {
  const { data, loading } = useConsumerProfile();
  if (loading) return <ClassLoading />;
  if (!data) return <ClassModal guestClass={null} vip={null} />;
  const guestClass = toGuestClass(data.guest_class);
  const vip = toVipDetails(guestClass, data.vip_partner, data.vip_until);
  return <ClassModal guestClass={guestClass} vip={vip} />;
}
