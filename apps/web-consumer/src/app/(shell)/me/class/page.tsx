import { ClassModal } from "@/components/consumer/me/ClassModal";
import { apiFetchConsumerProfile } from "@/lib/api/profile";
import {
  toGuestClass,
  toVipDetails,
  type GuestClass,
  type VipDetails,
} from "@/lib/guest-standing";
import { createServerSupabase } from "@/lib/supabase/server";
import { errMsg } from "@/lib/utils";

// /me/class — the class you are in, Regular or VIP (MESITA-2562).
// A failed read shows both classes with neither marked, never a guessed Regular.
export const dynamic = "force-dynamic";

export default async function Page() {
  let guestClass: GuestClass | null = null;
  let vip: VipDetails | null = null;
  try {
    const supabase = await createServerSupabase();
    const { consumer } = await apiFetchConsumerProfile(supabase);
    guestClass = toGuestClass(consumer.guest_class);
    vip = toVipDetails(guestClass, consumer.vip_partner, consumer.vip_until);
  } catch (err) {
    console.error(
      "class_page_profile_read_failed",
      errMsg(err, "consumer-web-get-profile failed"),
    );
  }
  return <ClassModal guestClass={guestClass} vip={vip} />;
}
