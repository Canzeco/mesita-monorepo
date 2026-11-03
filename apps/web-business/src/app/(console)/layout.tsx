import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getIdentityCached } from "@/lib/identity";
import { BusinessShell } from "@/components/shell/BusinessShell";

// The wall (MESITA-3103): a session, then one identity read for the frame.
// Each place's data is still asked of the server per place.
export const dynamic = "force-dynamic";

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const identity = await getIdentityCached();
  if (!identity.ok && identity.code === "google_only") redirect("/auth/signout?error=google_only");
  const places = identity.ok
    ? identity.data.places.filter((p) => p.state === "owner").map((p) => ({ id: p.place_id, name: p.name, photo: p.photo, role: p.role }))
    : [];
  const isSuperAdmin = identity.ok && identity.data.isSuperAdmin;

  return (
    <BusinessShell places={places} isSuperAdmin={isSuperAdmin} email={identity.ok ? identity.data.email : null}>
      {children}
    </BusinessShell>
  );
}
