import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { PageContainer, PageHeader } from "@/components/PageContainer";
import { authSignOut } from "@/app/auth/actions";
import { LogOut } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  return (
    <PageContainer size="3xl">
      <PageHeader
        eyebrow="Admin"
        title="Account"
        description="Signed-in operator for this admin console."
      />
      <div className="border-border bg-card mt-8 rounded-2xl border p-6">
        <dl className="space-y-4 text-sm">
          <div>
            <dt className="text-muted-foreground type-eyebrow">
              Email
            </dt>
            <dd className="mt-1 font-medium">{user.email ?? "(no email on file)"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground type-eyebrow">
              User id
            </dt>
            <dd className="mt-1 font-mono text-xs break-all">{user.id}</dd>
          </div>
        </dl>
        <form action={authSignOut} className="mt-8">
          <button
            type="submit"
            className="border-border text-muted-foreground hover:bg-muted hover:text-foreground inline-flex h-10 items-center gap-2 rounded-full border px-5 text-sm font-semibold transition"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </form>
      </div>
    </PageContainer>
  );
}
