import { Screen } from "@/components/consumer/nav/Screen";
import { CARD_KEPT_LINE, CARD_SAVED_LINE } from "@/components/consumer/AddCardSheet";
import { Panel } from "@/components/shared/Panel";
import { Skeleton } from "@/components/shared/Skeleton";

// /wallet/cards/new's frame (MESITA-4092): the header in place, the form's
// panel with its line and the fields in bones, and the footer with Save card
// (MESITA-4119: the page's own shape).
export default function Loading() {
  return (
    <Screen
      title="Add a card"
      paper
      scrolls
      footer={
        <div className="flex flex-col gap-2" aria-hidden>
          <Skeleton className="h-12 w-full rounded-xl" />
          <p className="text-muted-foreground text-center text-xs">{CARD_SAVED_LINE}</p>
        </div>
      }
    >
      <div className="flex flex-col pt-4 pb-8" aria-busy>
        <Panel className="p-4">
          <p className="text-muted-foreground mb-4 text-sm">{CARD_KEPT_LINE}</p>
          <Skeleton className="h-12 w-full rounded-xl" />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Skeleton className="h-12 rounded-xl" />
            <Skeleton className="h-12 rounded-xl" />
          </div>
          <Skeleton className="mt-3 h-12 w-full rounded-xl" />
        </Panel>
      </div>
    </Screen>
  );
}
