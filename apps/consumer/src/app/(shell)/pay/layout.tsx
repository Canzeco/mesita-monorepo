import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { apiFetchConsumerProfile } from "@/lib/api/profile";
import { errMsg } from "@/lib/utils";
import { PayClient } from "./PayClient";

export const dynamic = "force-dynamic";

// Shared Pay shell: profile fetch once for /pay, /pay/qr, /pay/tickets, /pay/balance.
export default async function PayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/?next=/pay/qr");

  let profile;
  try {
    ({ consumer: profile } = await apiFetchConsumerProfile(supabase));
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
    <>
      <PayClient
        userId={user.id}
        code={profile.code ?? ""}
        cashbackBalanceCents={profile.cashback_balance_cents}
      />
      {children}
    </>
  );
}
