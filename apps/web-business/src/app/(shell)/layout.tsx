// The console shell (mock era). Desktop sidebar / mobile sheet, org
// switcher via ?org=, MOCK badge always visible. noindex: this surface
// shows the unlaunched model with fake data and must not be indexed.
//
// HOUSE RULE for everything under (shell): data comes ONLY from
// src/lib/mock (contract: src/lib/model/types.ts). Never import
// lib/supabase or lib/api here — a test enforces it.
import type { Metadata } from "next";
import { Suspense } from "react";
import { Sidebar } from "@/components/console/Sidebar";

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
    <div className="bg-background min-h-screen md:flex">
      <Suspense fallback={<div className="hidden w-64 shrink-0 md:block" />}>
        <Sidebar />
      </Suspense>
      <main className="min-w-0 flex-1">
        <div className="mx-auto flex max-w-4xl flex-col gap-5 px-4 py-6 md:px-8 md:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
