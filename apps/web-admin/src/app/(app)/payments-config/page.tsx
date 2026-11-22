import Link from "next/link";
import { CaretRightIcon, CoinsIcon, GaugeIcon, TicketIcon } from "@phosphor-icons/react/dist/ssr";
import { moneyLabel } from "@mesita/place-profile/lib/money";
import {
  FOCUS_RING_CLASS,
  Notice,
  PageContainer,
  PageHeader,
  SectionCard,
  TBody,
  THead,
  Table,
  Td,
  Th,
  Tr,
} from "@/components/admin-ui";
import { getVoucherPrices, type VoucherPriceRow } from "./actions";

// ADMIN › PAYMENTS (Pato, 2026-11-14, MESITA-3918: "create a new page in
// Admin called Payments, there create a subsection called Vouchers ... must
// not be directly configurable but must be visible. like a table for each
// value"). Every number comes from the server's catalog (_shared/money.ts);
// nothing here writes.
export const dynamic = "force-dynamic";

const NAME: Record<string, string> = {
  voucher_200: "Small",
  voucher_1000: "Medium",
  voucher_5000: "Big",
  voucher_story: "Story",
  voucher_vip: "VIP",
};
const ORDER = ["voucher_200", "voucher_1000", "voucher_5000", "voucher_story", "voucher_vip"];
const WHO: Record<string, string> = {
  voucher_200: "As many as they like",
  voucher_1000: "As many as they like",
  voucher_5000: "As many as they like",
  voucher_story: "Guests with 1,000+ Instagram followers, one per visit",
  voucher_vip: "Only guests with a public Instagram over 5,000 followers, one per visit",
};

/** "MX$100", "¥1,000": whole units in the currency's own symbol. */
const whole = (amount: number, code: string) => {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: code, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${amount.toLocaleString("en-US")} ${code}`;
  }
};

const wait = (sec: number) => (sec <= 0 ? "At once" : sec % 3600 === 0 ? `${sec / 3600} h` : `${Math.round(sec / 60)} min`);

export default async function PaymentsConfigPage() {
  const res = await getVoucherPrices();
  const rows: VoucherPriceRow[] = res.ok
    ? [...res.vouchers].sort((a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key))
    : [];
  return (
    <PageContainer className="flex flex-col gap-6 sm:gap-8">
      <PageHeader title="Payments" description="How guests pay ahead. Read-only: these numbers change only in code." />
      {/* MESITA-3947: the one editable part of Payments, on its own page. */}
      <Link
        href="/payments-config/credits-limit"
        className={`group block rounded-2xl ${FOCUS_RING_CLASS}`}
        data-admin-credits-limit-link
      >
        <SectionCard
          icon={<GaugeIcon aria-hidden />}
          title="Credits Limit"
          subtitle="The most credit each place may owe its guests: a default per currency, a place's own limit, and who is close to it."
          right={<CaretRightIcon className="text-muted-foreground group-hover:text-foreground h-4 w-4" aria-hidden />}
        />
      </Link>
      <SectionCard
          icon={<TicketIcon aria-hidden />}
          title="Vouchers"
          subtitle={
            res.ok
              ? `A place sells vouchers in its own currency (${res.currencies.join(", ")}). Small starts with 1; Big is 10× Small. Mesita's fee: ${res.fee_bps / 100}% of the price.`
              : undefined
          }
        >
          {res.ok ? (
            <div className="mt-4">
              <Table className="min-w-[640px]" data-admin-voucher-prices>
                <THead>
                  <Tr>
                    <Th>Voucher</Th>
                    <Th>Bonus</Th>
                    {res.currencies.map((c) => (
                      <Th key={c} numeric>
                        {c} · pays → gets
                      </Th>
                    ))}
                    <Th>Ready</Th>
                    <Th>Who</Th>
                    <Th>Status</Th>
                  </Tr>
                </THead>
                <TBody>
                  {rows.map((v) => (
                    <Tr key={v.key} data-voucher={v.key}>
                      <Td className="font-semibold">{NAME[v.key] ?? v.key}</Td>
                      <Td className="tabular-nums">+{v.bonus_bps / 100}%</Td>
                      {res.currencies.map((c) => {
                        const p = v.prices[c];
                        return (
                          <Td key={c} numeric className="whitespace-nowrap">
                            {p ? `${moneyLabel(p.price_cents, c)} → ${moneyLabel(p.credit_cents, c)}` : "—"}
                          </Td>
                        );
                      })}
                      <Td className="whitespace-nowrap">{wait(v.available_after_sec)}</Td>
                      <Td className="text-muted-foreground">{WHO[v.key] ?? ""}</Td>
                      <Td className="whitespace-nowrap">{v.on_sale ? "On sale" : "Off sale"}</Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </div>
          ) : (
            <Notice className="mt-4">Couldn&apos;t load the voucher catalog: {res.error}</Notice>
          )}
      </SectionCard>
      {res.ok && res.currency_list.length > 0 ? (
          <SectionCard
            icon={<CoinsIcon aria-hidden />}
            title="Currencies"
            subtitle="Three countries at launch: Mexico, the United States and Canada, each in its own currency (fixed when the place signs the Loyalty Cards Agreement). Small +10% starts with 1; Big +20% is 10× Small; Welcome, Story and VIP cost the Small price."
          >
            <div className="mt-4">
              <Table className="min-w-[640px]" data-admin-voucher-currencies>
                <THead>
                  <Tr>
                    <Th>Currency</Th>
                    <Th>Country</Th>
                    <Th numeric>Small · +10%</Th>
                    <Th numeric>Big · +20%</Th>
                    <Th>Status</Th>
                  </Tr>
                </THead>
                <TBody>
                  {res.currency_list.map((c) => (
                    <Tr key={c.code} data-currency={c.code}>
                      <Td className="font-semibold">{c.code}</Td>
                      <Td className="text-muted-foreground">{c.country}</Td>
                      <Td numeric className="whitespace-nowrap">
                        {whole(c.small, c.code)} → {whole(c.small * 1.1, c.code)}
                      </Td>
                      <Td numeric className="whitespace-nowrap">
                        {whole(c.big, c.code)} → {whole(c.big * 1.2, c.code)}
                      </Td>
                      <Td className={c.selling ? "font-semibold whitespace-nowrap" : "text-muted-foreground whitespace-nowrap"}>
                        {c.selling ? "Selling" : "Not yet"}
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </div>
            {res.unsupported.length > 0 ? (
              <div className="mt-4" data-admin-unsupported>
                <p className="text-sm font-semibold">Not supported</p>
                <ul className="text-muted-foreground mt-1 flex flex-col gap-1 text-sm">
                  {res.unsupported.map((u) => (
                    <li key={u.region}>
                      <span className="text-foreground">{u.region}</span>: {u.why}
                    </li>
                  ))}
                </ul>
                <p className="text-muted-foreground mt-1 text-sm">Places there run Loyalty Cards and cash; no vouchers or cards.</p>
              </div>
            ) : null}
          </SectionCard>
      ) : null}
    </PageContainer>
  );
}
