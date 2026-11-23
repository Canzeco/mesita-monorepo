import { Screen } from "@/components/consumer/nav/Screen";
import { RowsSkeleton } from "@/components/consumer/wallet/WalletLists";

// /wallet/send's frame (MESITA-4096): the header in place and the list in
// bones. NO WORDS IN THE BODY (MESITA-4332, Pato: "the loading must be
// placeholder with no words"): a bar where "Your places" goes and four bone
// rows, never the title or the Add a Loyalty Card row.
export default function Loading() {
  return (
    <Screen title="Send Gift" paper flush>
      {/* The banner's bar and the edge-to-edge rows (MESITA-4755, MESITA-4760), no words. */}
      <div className="bg-neutral-950 h-12 shrink-0" aria-hidden />
      <div aria-busy className="divide-border border-border flex flex-col divide-y border-b">
        <RowsSkeleton count={4} />
      </div>
    </Screen>
  );
}
