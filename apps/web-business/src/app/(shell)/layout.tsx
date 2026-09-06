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
import { SHELL_GUTTER } from "@/lib/ui-classes";
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
      {/* FLUID: no max-width (MESITA-1558). Two things depend on that and
          neither is cosmetic — a full-bleed child cancels SHELL_GUTTER with
          SHELL_BLEED and only reaches the window edge if nothing caps it, and
          the place sections only earn a third column when the width exists to
          hold one. Readability is protected per-element (FORM_COLUMN_CLASS),
          not by squeezing the whole console. */}
      <main
        className={`flex w-full flex-col gap-4 py-4 sm:py-8 ${SHELL_GUTTER}`}
      >
        {children}
      </main>
    </div>
  );
}
