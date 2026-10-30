import type { Metadata } from "next";
import Link from "next/link";
import { PageBody, PageHeader } from "@/components/page";
import { List, Section } from "@/components/ui";
import { VisitRow, visitTabs } from "@/components/visits";
import { money } from "@/lib/format";
import { rewardRules, visits, type PaidWith } from "@/lib/mock";
import type { RewardId } from "@/lib/rewards";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Visit history" };

const payFilters: (PaidWith | "All")[] = ["All", "Mesita Pay", "Credits", "Other"];

function FilterChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-full border px-3 py-1.5 text-sm whitespace-nowrap transition-colors",
        active ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:bg-muted",
      )}
    >
      {children}
    </Link>
  );
}

export default async function VisitHistory({
  searchParams,
}: {
  searchParams: Promise<{ paid?: string; reward?: string }>;
}) {
  const { paid, reward } = await searchParams;
  const paidFilter = payFilters.find((p) => p === paid) ?? "All";
  const rewardFilter = rewardRules.find((r) => r.id === reward)?.id as RewardId | undefined;

  const shown = visits.filter(
    (v) =>
      v.status !== "waiting" &&
      (paidFilter === "All" || v.paidWith === paidFilter) &&
      (!rewardFilter || v.rewards.applied.some((a) => a.id === rewardFilter)),
  );
  const days = [...new Set(shown.map((v) => v.day))];
  const qs = (p: string, r?: string) => {
    const q = new URLSearchParams();
    if (p !== "All") q.set("paid", p);
    if (r) q.set("reward", r);
    const s = q.toString();
    return `/visits/history${s ? `?${s}` : ""}`;
  };

  return (
    <PageBody>
      <PageHeader title="Visits" sub="Every visit closed at your place" tabs={visitTabs} />

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0">
        {payFilters.map((p) => (
          <FilterChip key={p} href={qs(p, rewardFilter)} active={paidFilter === p}>
            {p === "All" ? "Any payment" : p}
          </FilterChip>
        ))}
      </div>
      <div className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0">
        <FilterChip href={qs(paidFilter)} active={!rewardFilter}>
          Any reward
        </FilterChip>
        {rewardRules.map((r) => (
          <FilterChip key={r.id} href={qs(paidFilter, r.id)} active={rewardFilter === r.id}>
            {r.name.replace(" Reward", "")}
          </FilterChip>
        ))}
      </div>

      {days.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">No visits match these filters.</p>
      ) : (
        days.map((day) => {
          const list = shown.filter((v) => v.day === day);
          const sales = list.filter((v) => v.status === "approved").reduce((s, v) => s + v.bill, 0);
          return (
            <Section
              key={day}
              title={day}
              className="mt-6"
              aside={<span className="tabular text-sm text-muted-foreground">{money(sales)}</span>}
            >
              <List>
                {list.map((v) => (
                  <VisitRow key={v.id} visit={v} />
                ))}
              </List>
            </Section>
          );
        })
      )}
    </PageBody>
  );
}
