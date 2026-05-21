import Link from "next/link";
import { redirect } from "next/navigation";
import { SimpleHeader } from "@/components/guest/SimpleHeader";
import { createServerSupabase } from "@/lib/supabase/server";
import { apiFetchGuestProfile, apiFetchMyTickets } from "@/lib/api/tickets";
import { MyQrClient } from "./MyQrClient";

export const dynamic = "force-dynamic";

export default async function GuestQrPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/?next=/qr");

  let profile;
  try {
    profile = await apiFetchGuestProfile(supabase);
  } catch (err) {
    return (
      <div className="flex flex-1 flex-col">
        <SimpleHeader title="My QR" />
        <div className="flex-1 px-4 py-6">
          <p className="bg-destructive/10 text-destructive rounded-xl px-3 py-2 text-sm">
            {err instanceof Error ? err.message : "Couldn't load your profile."}
          </p>
        </div>
      </div>
    );
  }

  // Tickets feed the 'active ticket' surface (timeline at top of the page).
  // The recent-visits list was removed — the QR + balance carry the page on
  // their own. Silently degrade if the EF hiccups.
  let tickets: Awaited<ReturnType<typeof apiFetchMyTickets>> = [];
  try {
    tickets = await apiFetchMyTickets(supabase, 10);
  } catch (err) {
    console.error("[guest/qr] tickets:", err);
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <SimpleHeader title="My QR" />
      <div className="flex-1 overflow-y-auto">
        <MyQrClient profile={profile} tickets={tickets} />
        <p className="text-muted-foreground px-6 pt-2 pb-8 text-center text-[11px]">
          Need help?{" "}
          <Link
            href="/profile"
            className="text-foreground font-semibold hover:underline"
          >
            Account &amp; balance
          </Link>
        </p>
      </div>
    </div>
  );
}
