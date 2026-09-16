// Mesita Terminal — the one product with no engine, no column and no switch.
//
// THE PAGE EXISTS BECAUSE THE ROW DOES (MESITA-1885). Pato put all eight
// products in the rail, and MESITA-1833 is his own law — *"make all this
// functional. not hidden shit."* — so the rail renders Terminal at full
// strength like every other row, and full strength has to open something real.
// "Here is what will live here" is a real answer; a dimmed row that does
// nothing is not. Customers' page is the same shape for the same reason.
//
// The Soon badge lives on this page, never in the rail, and there are no knobs
// on it: an unbuilt engine shows Soon, never a fake feed and never a fake
// number. The catalogue card has said exactly this — `soon`, no count, no verb
// — since MESITA-1869; this is the same sentence with an address.
//
// IT READS NOTHING. The layout above already refused an id the caller cannot
// open and already rendered the place's name (MESITA-1875), so the one fact
// this page used to fetch — the holder's name, to print it — arrives for free.
import { SoonStrip } from "@/components/console/SoonStrip";
import { SOON_STRIPS } from "@/components/console/SoonStrips";

export const dynamic = "force-dynamic";

export default function TerminalPage() {
  return (
    <>
      <p className="text-muted-foreground text-sm leading-snug">
        Card payments taken in person, on Mesita hardware. Nothing is live yet.
      </p>
      <SoonStrip {...SOON_STRIPS.terminal} />
    </>
  );
}
