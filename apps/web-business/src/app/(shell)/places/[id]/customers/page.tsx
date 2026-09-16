// Customers — WHO KEEPS COMING BACK to this place.
//
// Pato, 2026-09-14, on a screenshot of the MESITA-1844 rail: *"add customers
// maybe"*, listed as `Costumers (Soon)`.
//
// THE ENGINE IS NOT BUILT, and this page says so rather than showing knobs.
// House law (SoonStrip): an unbuilt engine shows Soon, never a fake feed.
//
// THE PAGE EXISTS BECAUSE THE ROW DOES. MESITA-1833 is Pato's own law — *"make
// all this functional. not hidden shit."* — so the rail renders Customers at
// full strength like every other row, and full strength has to open something
// real. "Here is what will live here" is a real answer; a dimmed row that does
// nothing is not, and with an empty catalogue a dimmed row is the first thing
// a new operator sees. The Soon badge lives on this page, never in the rail.
//
// IT READS NOTHING. The layout above resolved the place once (MESITA-1875) and
// its heading names it, so the one read this page used to make — the holder's
// name, to print it — is gone with the holder.
import { SoonStrip } from "@/components/console/SoonStrip";
import { SOON_STRIPS } from "@/components/console/SoonStrips";

export const dynamic = "force-dynamic";

export default function CustomersPage() {
  return (
    <>
      <p className="text-muted-foreground text-sm leading-snug">
        The guests who visit and pay here. Nothing is live yet.
      </p>
      <SoonStrip {...SOON_STRIPS.customers} />
    </>
  );
}
