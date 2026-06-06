import nextDynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { apiFetchConsumerProfile } from "@/lib/api/profile";
import { errMsg } from "@/lib/utils";
import { payTabFromSegment, payTabHref } from "@/lib/pay-route";
import { PayTabLoading } from "../PayTabLoading";

const PayClient = nextDynamic(
  () => import("../PayClient").then((mod) => mod.PayClient),
  { loading: () => <PayTabLoading /> },
);

export const dynamic = "force-dynamic";

export default async function PayTabPage({
  params,
}: {
  params: Promise<{ tab: string }>;
}) {
  const { tab: tabSegment } = await params;
  const tab = payTabFromSegment(tabSegment);
  if (!tab) redirect(payTabHref("qr"));

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/?next=${encodeURIComponent(payTabHref(tab))}`);

  let profile;
  try {
    ({ consumer: profile } = await apiFetchConsumerProfile(supabase));
  } catch (err) {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col">
        <div className="px-4 py-6">
          <p className="bg-destructive/10 text-destructive rounded-xl px-3 py-2 text-sm">
            {errMsg(err, "Couldn't load your profile.")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <PayClient tab={tab} userId={user.id} code={profile.code ?? ""} />
    </div>
  );
}
