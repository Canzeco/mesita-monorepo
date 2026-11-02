import { authSignOut } from "@/app/auth/actions";
import { Card } from "@/components/shell/Page";

export function AccountCard({ phone, email }: { phone: string | null; email: string | null }) {
  return (
    <Card className="flex flex-col gap-4">
      <div>
        <p className="font-semibold">Your account</p>
        <p className="text-muted-foreground text-sm">The same account you use as a guest on Mesita.</p>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Phone</dt>
        <dd>{phone ?? "None"}</dd>
        <dt className="text-muted-foreground">Email</dt>
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
