// The console shell. Four screens over one organization at a time.
//
// The layout resolves the caller's organizations once and hands the list
// to the nav, so the switcher is populated on every screen without each
// page re-fetching it. WHICH one is active is resolved from ?org= by the
// nav (client-side) and by each page (server-side) — layouts cannot read
// searchParams, so this file deliberately does not decide it.
import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { TopNav } from "@/components/console/TopNav";
import { createServerSupabase } from "@/lib/supabase/server";
import { apiListOrganizations } from "@/lib/api/organizations";

export const metadata: Metadata = {
  title: "Console",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  // A failure here must not blank the console: the nav degrades to no
  // switcher and each page reports its own error.
  let organizations: Awaited<ReturnType<typeof apiListOrganizations>> = [];
  try {
    organizations = await apiListOrganizations(supabase);
  } catch (err) {
    console.error("[console] business-web-list-organizations:", err);
  }

  return (
    <div className="bg-background min-h-screen">
      <Suspense fallback={<div className="h-14" />}>
        <TopNav
          organizations={organizations.map((o) => ({ id: o.id, name: o.name }))}
        />
      </Suspense>
      <main className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
