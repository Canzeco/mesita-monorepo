import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/page";
import { Avatar, Card, Chip, List, Note, Row, Section } from "@/components/ui";
import { money, signedMoney } from "@/lib/format";
import { balances, creditEntries, guestById, type CreditEntry } from "@/lib/mock";
import { creditTabs } from "./tabs";

export const metadata: Metadata = { title: "Credits" };

const sourceTone = (s: CreditEntry["source"]) =>
  s === "Prepayment" ? "brand" : s === "Cashback" ? "success" : s === "Spent" ? "dark" : "neutral";

export default function CreditsActivity() {
  const rows = balances();
  const owed = rows.reduce((s, r) => s + r.balance, 0);
  const bySource = (k: "Prepayment" | "Cashback" | "Payment") =>
    creditEntries.filter((e) => e.source === k).reduce((s, e) => s + e.amount, 0);
  const spent = -creditEntries.filter((e) => e.source === "Spent").reduce((s, e) => s + e.amount, 0);
  const sources = [
    { label: "From prepayments", value: bySource("Prepayment"), tone: "bg-primary" },
    { label: "From cashback rewards", value: bySource("Cashback"), tone: "bg-success" },
    { label: "From payments", value: bySource("Payment"), tone: "bg-muted-foreground" },
  ];
  const issued = sources.reduce((s, x) => s + x.value, 0);

  return (
    <PageBody>
      <PageHeader title="Credits" sub="Credit guests hold at your place, and spend on future visits" tabs={creditTabs} />

      <Card className="p-5">
        <div className="text-sm text-muted-foreground">You owe in future visits</div>
        <div className="tabular mt-1 font-display text-4xl font-semibold">{money(owed)}</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Held by {rows.length} guests · {money(spent)} spent this week
        </div>
        <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
          {sources.map((s) => (
            <span key={s.label} className={s.tone} style={{ width: `${(s.value / Math.max(1, issued)) * 100}%` }} />
          ))}
        </div>
        <dl className="mt-3 grid gap-2 sm:grid-cols-3">
          {sources.map((s) => (
            <div key={s.label} className="flex items-center gap-2 text-sm">
              <span className={`size-2.5 rounded-full ${s.tone}`} aria-hidden />
              <dt className="text-muted-foreground">{s.label}</dt>
              <dd className="tabular ml-auto font-medium sm:ml-0">{money(s.value)}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Section title="Activity">
        <List>
          {creditEntries.map((e) => {
            const g = guestById(e.guestId);
            return (
              <Row
                key={e.id}
                href={e.visitId ? `/visits/${e.visitId}` : undefined}
                leading={<Avatar name={g.name} vip={g.vip} />}
                title={g.name}
                sub={
                  <>
                    <Chip tone={sourceTone(e.source)}>{e.source}</Chip>
                    <span className="truncate">{`${e.day} · ${e.note}`}</span>
                  </>
                }
                right={<span className={e.amount < 0 ? "" : "text-success"}>{signedMoney(e.amount)}</span>}
              />
            );
          })}
        </List>
        <Note>Credits only spend at your place. Prepaid credit was paid for; cashback credit was earned and cannot be cashed out.</Note>
      </Section>
    </PageBody>
  );
}
