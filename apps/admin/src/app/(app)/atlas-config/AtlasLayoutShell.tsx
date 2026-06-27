"use client";

import { PageHeader } from "@/components/PageContainer";

export function AtlasLayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageHeader
        title="Atlas Config"
        description="Controlled vocabulary and field limits used when ADEA and operators write place profiles."
      />
      <div className="mt-6 sm:mt-8">{children}</div>
    </>
  );
}
