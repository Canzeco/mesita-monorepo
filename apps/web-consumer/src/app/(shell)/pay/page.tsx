import { QrCode } from "lucide-react";

// /pay — the bar's Pay tab (Home · Search · Pay · Wallet · Me). The reward
// steps that lived here left with the discount product (MESITA-3299, Pato:
// "discounts are gone across all the app"). Paying a bill in Mesita arrives
// with MESITA-3272; until then the page says so plainly, with no Soon pill
// and no mock. The words below are the frame loading.tsx draws too.
export const PAY_TITLE = "Pay";
export const PAY_LINE = "Pay a bill from your phone, with your credit and your card.";
export const PAY_EMPTY_TITLE = "No place takes payments in Mesita yet";
export const PAY_EMPTY_LINE = "When a place turns it on, it shows here.";

export default function Page() {
  return (
    <div className="scrollbar-hide flex h-full min-h-0 flex-col overflow-y-auto px-4 pt-6 pb-8">
      <h1 className="font-display text-2xl font-semibold tracking-tight">{PAY_TITLE}</h1>
      <p className="text-muted-foreground type-body mt-1">{PAY_LINE}</p>
      <div className="border-border bg-card mt-6 flex flex-col items-center rounded-2xl border px-6 py-12 text-center">
        <span className="bg-muted text-foreground flex h-14 w-14 items-center justify-center rounded-2xl">
          <QrCode className="h-7 w-7" strokeWidth={2} aria-hidden />
        </span>
        <p className="text-foreground mt-4 font-sans text-lg font-semibold tracking-tight">{PAY_EMPTY_TITLE}</p>
        <p className="text-muted-foreground mt-1.5 max-w-[30ch] text-sm leading-relaxed">{PAY_EMPTY_LINE}</p>
      </div>
    </div>
  );
}
