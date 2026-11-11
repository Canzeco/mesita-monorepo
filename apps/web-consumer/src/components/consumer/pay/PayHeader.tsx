// PAY IS ONE PAGE (Pato, 2026-11-11, MESITA-3720: "pay and wallet in the
// same subpage, i don't want two subpages (pay & wallet) only one"): the
// white header bar reads Pay, with no Pay · Wallet band under it. MESITA-3698
// had split the tab into /pay and /wallet behind that band. Its right side
// holds the Wallet button since MESITA-3726 (Pato: "Wallet va dentro de
// Pay"): the Wallet is a page pushed from here.

/** The white header bar, held at the top of the scroller. `-mx-4` because
 *  the page pads its scroller by 1rem. */
export function PayHeader({ action }: { action?: React.ReactNode } = {}) {
  return (
    <div className="border-border sticky top-0 z-10 -mx-4 border-b" data-pay-header>
      <header className="bg-card flex min-h-[4.25rem] items-center justify-between gap-3 px-4 pt-5 pb-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Pay</h1>
        {action}
      </header>
    </div>
  );
}
