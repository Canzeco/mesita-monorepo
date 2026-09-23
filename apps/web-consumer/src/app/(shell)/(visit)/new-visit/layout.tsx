import type { ReactNode } from "react";

// Visit › Pay's frame. It drew the QR · Wallet section row until MESITA-2050;
// Wallet is a bottom tab of its own now (/wallet), which left Pay one page and
// the row nothing to switch between. Visit's rail is drawn by
// (visit)/layout.tsx above this.
//
// Flex column, not a block — the place list asks for `min-h-0 flex-1`, and a
// block parent makes that inert.
//
// `force-dynamic` LIVES HERE, on the layout: the page reads per-guest state,
// and a layout's declaration covers everything under it.
export const dynamic = "force-dynamic";

export default function NewVisitLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {children}
    </div>
  );
}
