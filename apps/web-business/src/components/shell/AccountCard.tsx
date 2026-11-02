import { authSignOut } from "@/app/auth/actions";
import { Card } from "@/components/shell/Page";

// The signed-in Google account, in the place's Settings (MESITA-3120). An
// account is one person; places and accounts are the only layers.
export function AccountCard({ email }: { email: string | null }) {
  return (
    <Card className="flex flex-col gap-3">
      <div>
        <p className="font-semibold">Account</p>
        <p className="text-muted-foreground text-sm">The Google account you sign in with.</p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">{email ?? "Signed in"}</p>
        <form action={authSignOut}>
          <button type="submit" className="border-border hover:bg-muted inline-flex h-9 items-center rounded-full border px-4 text-sm font-semibold">
            Sign out
          </button>
        </form>
      </div>
    </Card>
  );
}
