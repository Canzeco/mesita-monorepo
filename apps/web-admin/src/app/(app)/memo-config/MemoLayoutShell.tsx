"use client";

import { usePathname } from "next/navigation";
import { PageHeader } from "@/components/PageContainer";
import { ConfigTabNav } from "@/components/ConfigTabNav";
import { MEMO_SUBROUTES } from "./nav";

// Memo Config shell — the header + the Config/Playground tab strip. Mirrors the
// Enricher / Lineup config shells; the description switches per active tab.
const SUBPAGE_DESCRIPTION: Record<string, string> = {
  "/memo-config/config":
    "Memo is Mesita's consumer AI concierge (Home Ask AI is parked; engine + Playground live via consumer-web-ask-memo / admin-web-ask-memo). Instructions are read live; models come from Models Config; greeting is mirrored into parked client constants until Ask AI unparks.",
  "/memo-config/playground":
    "Chat with Memo's reasoning agent as a real consumer, a mock persona, or a guest — pick who and where, start a session, and talk turn-by-turn. Every reply expands into Memo's full trace: the RAG-first Lineup recall, each OpenAI reasoning round, and every tool call (Lineup · Perplexity · Mesita catalog). Reads the saved persona — save Config edits first.",
  "/memo-config/data-access":
    "Memo never reads the database directly. Every Mesita read goes through the closed set of internal Edge Functions below — this is the complete list of what Memo can reach, and all of it is read-only.",
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
