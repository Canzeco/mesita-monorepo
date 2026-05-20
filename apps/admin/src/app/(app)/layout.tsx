import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import { getAdminKey } from "@/lib/admin-key";

// Layout for the admin surface. Pages are intentionally not gated —
// the operator can navigate anywhere — but every privileged action
// the pages perform attaches the admin key (from the HttpOnly cookie)
// when calling Supabase Edge Functions. Without a key set, those
// actions return 401.
//
// We surface that state inline via the banner below so the operator
// always knows whether their next click will actually do anything.
export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const hasKey = (await getAdminKey()) !== null;
  return (
    <div className="flex min-h-dvh">
      <Sidebar hasKey={hasKey} />
      <main className="flex-1 overflow-x-hidden">
        {!hasKey && (
          <div className="border-border bg-destructive/5 text-destructive flex items-center justify-between gap-3 border-b px-6 py-2.5 text-xs">
            <span>
              No admin key set — privileged actions will fail until you{" "}
              <Link href="/login" className="font-semibold underline">
                set one
              </Link>
              .
            </span>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
