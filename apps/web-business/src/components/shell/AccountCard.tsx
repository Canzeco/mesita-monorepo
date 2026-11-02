import { authSignOut } from "@/app/auth/actions";
import { Card } from "@/components/shell/Page";

// The signed-in Google account (MESITA-3105: the Business app takes Google
// accounts only).
export function AccountCard({ email }: { email: string | null }) {
  return (
    <Card className="flex flex-col gap-4">
      <div>
        <p className="font-semibold">Your account</p>
        <p className="text-muted-foreground text-sm">The Google account you sign in with.</p>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Google</dt>
        <dd>{email ?? "None"}</dd>
      </dl>
      <form action={authSignOut}>
        <button type="submit" className="border-border hover:bg-muted inline-flex h-10 items-center rounded-full border px-4 text-sm font-semibold">
          Sign out
        </button>
      </form>
    </Card>
  );
}
