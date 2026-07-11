import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { placePath } from "@/lib/business-route-contract";
import { resolvePlaceSubTab } from "@/components/business/place/place-subtabs";

export const dynamic = "force-dynamic";

export default async function BusinessPlaceIndexPage({
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
  if (!user) redirect(`/?next=${encodeURIComponent(placePath(id))}`);

  const sp = await searchParams;
  if (sp.tab) {
    redirect(placePath(id, resolvePlaceSubTab(sp.tab)));
  }
  redirect(placePath(id, "preview"));
}
