import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { PageContainer, PageHeader } from "@/components/PageContainer";
import { Button, SectionCard } from "@/components/admin-ui/config";
import { authSignOut } from "@/app/auth/actions";
import { LogOut, UserRound } from "lucide-react";

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
      <div className="mt-8">
        <SectionCard
          icon={<UserRound className="text-muted-foreground h-4 w-4" />}
          title="Session"
        >
          <dl className="mt-5 space-y-4 text-sm">
            <div>
              <dt className="text-muted-foreground type-eyebrow">Email</dt>
              <dd className="mt-1 font-medium">{user.email ?? "(no email on file)"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground type-eyebrow">User id</dt>
              <dd className="mt-1 font-mono text-xs break-all">{user.id}</dd>
            </div>
          </dl>
          <form action={authSignOut} className="mt-6">
            <Button type="submit" tone="secondary" icon={<LogOut className="h-4 w-4" />}>
              Sign out
            </Button>
          </form>
        </SectionCard>
      </div>
    </PageContainer>
  );
}
