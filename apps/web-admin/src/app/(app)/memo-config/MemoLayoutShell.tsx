"use client";

import { usePathname } from "next/navigation";
import { PageHeader } from "@/components/PageContainer";
import { ConfigTabNav } from "@/components/ConfigTabNav";
import { MEMO_SUBROUTES } from "./nav";

// Memo Config shell — the header + the Config/Playground tab strip. Mirrors the
// Enricher / Lineup config shells; the description switches per active tab.
const SUBPAGE_DESCRIPTION: Record<string, string> = {
  "/memo-config/config":
    "Memo is Mesita's consumer AI concierge (the Ask AI tab on Home, powered by consumer-web-ask-memo). Tune its persona and models. Only the system prompt (instructions) is read live today; the greeting and model knobs persist ahead of the Memo model rebuild.",
  "/memo-config/playground":
    "Run one live Memo query at the current saved persona and inspect the answer, the places it surfaces, and its follow-ups. Save your Config edits first — the Playground reads the saved persona.",
};

export function MemoLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const match = MEMO_SUBROUTES.find(
    (r) => pathname === r.href || pathname.startsWith(`${r.href}/`),
  );
  const description =
    (match && SUBPAGE_DESCRIPTION[match.href]) ??
    SUBPAGE_DESCRIPTION["/memo-config/config"];

  return (
    <>
      <PageHeader
        eyebrow="Agents · Memo"
        title="Memo Config"
        description={description}
      />
      <ConfigTabNav ariaLabel="Memo Config" subroutes={MEMO_SUBROUTES} />
      <div className="mt-6 sm:mt-8">{children}</div>
    </>
  );
}
