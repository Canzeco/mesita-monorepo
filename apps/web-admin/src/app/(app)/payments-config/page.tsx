import { TicketIcon } from "@phosphor-icons/react/dist/ssr";
import { moneyLabel } from "@mesita/place-profile/lib/money";
import { PageContainer, PageHeader } from "@/components/PageContainer";
import { SectionCard } from "@/components/admin-ui/config";
import { getVoucherPrices, type VoucherPriceRow } from "./actions";

// ADMIN › PAYMENTS (Pato, 2026-11-14, MESITA-3918: "create a new page in
// Admin called Payments, there create a subsection called Vouchers ... must
// not be directly configurable but must be visible. like a table for each
// value"). Every number comes from the server's catalog (_shared/money.ts);
// nothing here writes.
export const dynamic = "force-dynamic";

const NAME: Record<string, string> = {
  voucher_welcome: "Welcome",
  voucher_200: "Small",
  voucher_1000: "Big",
  voucher_5000: "Biggest",
  voucher_story: "Story",
  voucher_vip: "VIP",
};
const ORDER = ["voucher_welcome", "voucher_200", "voucher_1000", "voucher_5000", "voucher_story", "voucher_vip"];
const WHO: Record<string, string> = {
  voucher_welcome: "One per guest per place",
  voucher_200: "As many as they like",
  voucher_1000: "As many as they like",
  voucher_5000: "As many as they like",
  voucher_story: "Guests with 1,000+ Instagram followers, one per visit",
  voucher_vip: "VIP guests, one per visit",
};

const wait = (sec: number) => (sec <= 0 ? "At once" : sec % 3600 === 0 ? `${sec / 3600} h` : `${Math.round(sec / 60)} min`);

export default async function PaymentsConfigPage() {
  const res = await getVoucherPrices();
  const rows: VoucherPriceRow[] = res.ok
    ? [...res.vouchers].sort((a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key))
    : [];
  return (
    <PageContainer>
      <PageHeader title="Payments" description="How guests pay ahead. Read-only: these numbers change only in code." />
      <div className="mt-6 sm:mt-8">
        <SectionCard
          icon={<TicketIcon className="h-5 w-5" aria-hidden />}
          title="Vouchers"
          subtitle={
            res.ok
              ? `A place sells vouchers in its own currency (${res.currencies.join(", ")}). Small starts with 1; Big is 10× Small. Mesita's fee: ${res.fee_bps / 100}% of the price.`
              : undefined
          }
        >
          {res.ok ? (
            <div className="-mx-4 overflow-x-auto sm:mx-0">
              <table className="w-full min-w-[640px] text-sm" data-admin-voucher-prices>
                <thead>
                  <tr className="text-muted-foreground border-border border-b text-left">
                    <th className="px-4 py-2 font-medium sm:pl-0">Voucher</th>
                    <th className="px-4 py-2 font-medium">Bonus</th>
                    {res.currencies.map((c) => (
                      <th key={c} className="px-4 py-2 text-right font-medium">
                        {c} · pays → gets
                      </th>
                    ))}
                    <th className="px-4 py-2 font-medium">Ready</th>
                    <th className="px-4 py-2 font-medium">Who</th>
                    <th className="px-4 py-2 font-medium sm:pr-0">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((v) => (
                    <tr key={v.key} className="border-border border-b last:border-0" data-voucher={v.key}>
                      <td className="px-4 py-3 font-semibold sm:pl-0">{NAME[v.key] ?? v.key}</td>
                      <td className="px-4 py-3 tabular-nums">+{v.bonus_bps / 100}%</td>
                      {res.currencies.map((c) => {
                        const p = v.prices[c];
                        return (
                          <td key={c} className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                            {p ? `${moneyLabel(p.price_cents, c)} → ${moneyLabel(p.credit_cents, c)}` : "—"}
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 whitespace-nowrap">{wait(v.available_after_sec)}</td>
                      <td className="text-muted-foreground px-4 py-3">{WHO[v.key] ?? ""}</td>
                      <td className="px-4 py-3 whitespace-nowrap sm:pr-0">{v.on_sale ? "On sale" : "Off sale"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-destructive text-sm" role="alert">
              Couldn&apos;t load the voucher catalog: {res.error}
            </p>
          )}
        </SectionCard>
      </div>
    </PageContainer>
  );
}
