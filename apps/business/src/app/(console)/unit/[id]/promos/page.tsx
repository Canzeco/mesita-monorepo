import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { promosPath } from "@/lib/business-route-contract";
import { resolvePromosSubTab } from "@/components/business/promos/promos-subtabs";

export const dynamic = "force-dynamic";

export default async function BusinessPromosIndexPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/?next=${encodeURIComponent(promosPath(id))}`);

  const sp = await searchParams;
  if (sp.tab) {
    redirect(promosPath(id, resolvePromosSubTab(sp.tab)));
  }
  redirect(promosPath(id, "plan"));
}
