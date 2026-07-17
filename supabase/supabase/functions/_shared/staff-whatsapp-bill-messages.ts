import { formatMoneyMx } from "./ticket-bill-payload.ts";

type BillTotals = {
  subtotal: number;
  total: number;
  discountPercent: number;
  discountCents: number;
  amountDueCents: number;
};

export function consumerBillMessage(placeName: string, calc: BillTotals): string {
  return (
    `Mesita — ${placeName}\n` +
    `Bill: ${formatMoneyMx(calc.total)}\n` +
    `Discount (${calc.discountPercent}%): -${formatMoneyMx(calc.discountCents)}\n` +
    `You pay: ${formatMoneyMx(calc.amountDueCents)}\n\n` +
    `Pay at the table — the staff will close it out.`
  );
}

export function staffBillReadyMessage(placeName: string, calc: BillTotals): string {
  return (
    `Cuenta lista ✓ (${placeName})\n` +
    `Subtotal: ${formatMoneyMx(calc.subtotal)}\n` +
    `Descuento (${calc.discountPercent}%): -${formatMoneyMx(calc.discountCents)}\n` +
    `Cobra al comensal: ${formatMoneyMx(calc.amountDueCents)} (efectivo o terminal).\n\n` +
    `Cuando cobres, responde *listo* para cerrar el ticket.`
  );
}
