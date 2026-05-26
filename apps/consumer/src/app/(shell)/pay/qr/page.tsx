import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { apiFetchConsumerProfile, apiFetchMyTickets } from "@/lib/api/tickets";
import { errMsg } from "@/lib/utils";
import { MyQrCard } from "@/components/consumer/MyQrCard";
import { ActiveTicketSection } from "@/components/consumer/ActiveTicketSection";

export const dynamic = "force-dynamic";

export default async function PayQrPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/?next=/pay/qr");

  let profile;
  try {
    profile = await apiFetchConsumerProfile(supabase);
  } catch (err) {
    return (
      <div className="px-4 py-6">
        <p className="bg-destructive/10 text-destructive rounded-xl px-3 py-2 text-sm">
          {errMsg(err, "Couldn't load your profile.")}
        </p>
      </div>
    );
  }

  // Tickets feed the 'active ticket' surface (timeline below the QR).
  // Silently degrade if the EF hiccups.
  let tickets: Awaited<ReturnType<typeof apiFetchMyTickets>> = [];
  try {
    tickets = await apiFetchMyTickets(supabase, 10);
  } catch (err) {
    console.error("[consumer/pay/qr] tickets:", err);
  }

  return (
    <div className="flex flex-col gap-4 px-4 pt-2 pb-6">
      <MyQrCard code={profile.code} />
      <ActiveTicketSection tickets={tickets} />
    </div>
  );
}
