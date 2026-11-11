// PAY IS ONE PAGE (Pato, 2026-11-11, MESITA-3720: "pay and wallet in the
// same subpage, i don't want two subpages (pay & wallet) only one"): the
// white header bar reads Pay, with no Pay · Wallet band under it. MESITA-3698
// had split the tab into /pay and /wallet behind that band. Since
// MESITA-3722 Pay and Wallet are two bar tabs, each with this bar under
// its own title.

/** The white header bar, held at the top of the scroller. `-mx-4` because
 *  the page pads its scroller by 1rem. */
export function PayHeader({ title = "Pay" }: { title?: string } = {}) {
  return (
    <div className="border-border sticky top-0 z-10 -mx-4 border-b" data-pay-header>
      <header className="bg-card flex min-h-[4.25rem] items-center px-4 pt-5 pb-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
      </header>
    </div>
  );
}
