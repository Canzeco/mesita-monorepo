import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { apiFetchConsumerProfile } from "@/lib/api/profile";
import { errMsg } from "@/lib/utils";
import { PayClient } from "./PayClient";

// /pay — two tabs: QR (your code + cashback balance) and Activity (your
// rewards log). The server component fetches the profile and hands it to the
// client tab shell.
//
// Top header (SimpleHeader title="Pay") is owned by the shell layout
// via TopBar — see src/components/consumer/TopBar.tsx.

export const dynamic = "force-dynamic";

export default async function PayPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/?next=/pay");

  let profile;
  try {
    profile = await apiFetchConsumerProfile(supabase);
  } catch (err) {
    return (
      <div className="flex h-full flex-col">
        <div className="px-4 py-6">
          <p className="bg-destructive/10 text-destructive rounded-xl px-3 py-2 text-sm">
            {errMsg(err, "Couldn't load your profile.")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <PayClient
      code={profile.code ?? ""}
      cashbackBalanceCents={profile.cashback_balance_cents}
    />
  );
}
