import { Screen } from "@/components/consumer/nav/Screen";
import { Panel } from "@/components/shared/Panel";
import { Skeleton } from "@/components/shared/Skeleton";
import { RowsSkeleton } from "@/components/consumer/wallet/WalletLists";

// /wallet/send's frame (MESITA-4096): the header in place and the list in
// bones. NO WORDS IN THE BODY (MESITA-4332, Pato: "the loading must be
// placeholder with no words"): a bar where "Your places" goes and four bone
// rows, never the title or the Add a Loyalty Card row.
export default function Loading() {
  return (
    <Screen title="Send Gift" paper>
      <div aria-busy>
        <Panel className="mt-2">
          <div className="px-4 pt-4">
            <Skeleton className="h-5 w-28 rounded-md" />
          </div>
          <div className="mt-3 flex flex-col">
            <RowsSkeleton count={4} />
          </div>
        </Panel>
      </div>
    </Screen>
  );
}
