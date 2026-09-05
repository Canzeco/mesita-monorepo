// The console shell (mock era) — minimal skeleton: three entity layers
// behind one slim top bar. noindex: fake data on a real domain.
//
// HOUSE RULE for everything under (shell): data comes ONLY from
// src/lib/mock (contract: src/lib/model/types.ts). Never import
// lib/supabase or lib/api here — a test enforces it.
import type { Metadata } from "next";
import { Suspense } from "react";
import { TopNav } from "@/components/console/TopNav";

export const metadata: Metadata = {
  title: "Console",
  robots: { index: false, follow: false },
};

export default function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-background min-h-screen">
      <Suspense fallback={<div className="h-14" />}>
        <TopNav />
      </Suspense>
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
