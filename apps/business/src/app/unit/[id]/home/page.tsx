import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ManagerHomePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/?next=/unit/${id}/home`);

  return (
    <div className="flex flex-1 items-center justify-center">
      <p className="font-display text-muted-foreground text-2xl tracking-tight">
        Soon
      </p>
    </div>
  );
}
