import Link from "next/link";
import { BotMessageSquare, ChevronLeft } from "lucide-react";
import { HomeSoon } from "@/components/consumer/home/HomeSoon";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// ASK AI — where Search's Ask AI button lands (Pato, MESITA-2409), Soon for
// the moment (MESITA-2168). Memo stays in AskAiTab; this page does not mount
// it. Its header is a way back to Search, white like Search's own.
export default function SearchChatPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-border bg-card/95 sticky top-0 z-20 shrink-0 border-b px-2 py-2.5 backdrop-blur">
        <Link
          href={CONSUMER_ROUTES.search}
          className="border-border bg-card text-foreground hover:bg-muted inline-flex h-11 items-center gap-1 rounded-full border pr-4 pl-2.5 text-xs font-semibold transition active:scale-[0.97]"
          data-chat-back
        >
          <ChevronLeft className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
          <span>Search</span>
        </Link>
      </div>
      <HomeSoon
        icon={BotMessageSquare}
        name="Ask AI"
        description="Asking Don Memo lands here shortly — thanks for waiting."
      />
    </div>
  );
}
