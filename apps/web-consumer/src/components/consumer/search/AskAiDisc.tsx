import Link from "next/link";
import { Sparkles } from "lucide-react";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { HEADER_DISC } from "./header-classes";

/** The Ask AI disc at the right end of both headers, Home's and Search's
 *  (MESITA-2447: "Location, Searchbar, Ask AI"). It lands on Search › Chat,
 *  Soon. One component so the two headers can't drift apart. */
export function AskAiDisc() {
  return (
    <Link
      href={CONSUMER_ROUTES.searchChat}
      aria-label="Ask AI"
      title="Ask AI"
      className={HEADER_DISC}
      data-search-ask-ai
    >
      {/* h-5: Sparkles reads smaller than the locate arrow at one size (Pato,
          MESITA-2446: "the ask AI button must be bigger"). */}
      <Sparkles className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
    </Link>
  );
}
