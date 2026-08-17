"use client";

import { usePathname } from "next/navigation";
import { ConfigTabNav } from "@/components/ConfigTabNav";
import { CHAT_SUBROUTES } from "./nav";

// The inner strip for Filters Config › Chat, plus the one-line description of
// whichever inner tab is active. The outer strip already says "Chat"; this says
// which part of Chat.
const SUBPAGE_DESCRIPTION: Record<string, string> = {
  "/filters-config/chat/memo":
    "Don Memo is the persona inside Home › Chat, Spanish-first. Instructions and greeting are live here (the ask-memo bootstrap reads them). The live OpenAI + Perplexity picks come from Models Config (models_config.memo); web grounding and the legacy model fields on this page are staged.",
  "/filters-config/chat/filters":
    "How the discovery filter sheet behaves on the Chat surface. Chat is a parked Home mode, so these knobs are doubly staged — and the ask itself is Memo's own axis, carried on Memo's recall call rather than the filter store.",
  "/filters-config/chat/playground":
    "Chat with Memo's reasoning agent as a real consumer, a mock persona, or a guest — pick who and where, start a session, and talk turn-by-turn. Every reply expands into Memo's full trace: the RAG-first recall, each reasoning round, and every tool call. Reads the saved persona — save Memo edits first.",
  "/filters-config/chat/data-access":
    "Memo never reads the database directly. Every Mesita read goes through the closed set of internal Edge Functions below — this is the complete list of what Memo can reach, and all of it is read-only.",
};

export function ChatTabNav() {
  const pathname = usePathname();
  const match = CHAT_SUBROUTES.find(
    (r) => pathname === r.href || pathname.startsWith(`${r.href}/`),
  );
  const description =
    (match && SUBPAGE_DESCRIPTION[match.href]) ??
    SUBPAGE_DESCRIPTION["/filters-config/chat/memo"];

  return (
    <>
      <ConfigTabNav ariaLabel="Chat surface" subroutes={CHAT_SUBROUTES} />
      <p className="text-muted-foreground mt-4 max-w-3xl text-sm leading-relaxed">
        {description}
      </p>
    </>
  );
}
