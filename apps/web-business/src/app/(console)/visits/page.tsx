import type { Metadata } from "next";
import { CheckCheck } from "lucide-react";
import { PageBody, PageHeader } from "@/components/page";
import { EmptyState, List, Section, Stat, StatGrid } from "@/components/ui";
import { VisitRow, visitTabs } from "@/components/visits";
import { money, percent } from "@/lib/format";
import { visits } from "@/lib/mock";
import { WaitingList } from "./WaitingList";

export const metadata: Metadata = { title: "Visits" };

export default function VisitsLive() {
  const today = visits.filter((v) => v.day === "Today");
  const waiting = today.filter((v) => v.status === "waiting");
  const closed = today.filter((v) => v.status !== "waiting");
  const approved = closed.filter((v) => v.status === "approved");
  const sales = approved.reduce((s, v) => s + v.bill, 0);
  const given = approved.reduce((s, v) => s + v.rewards.total, 0);
  const viaPay = approved.filter((v) => v.paidWith === "Mesita Pay").length;

  return (
    <PageBody>
      <PageHeader
        title="Visits"
        sub="Today · Thursday, October 29"
        tabs={visitTabs.map((t) => (t.href === "/visits" ? { ...t, count: waiting.length } : t))}
      />
      <StatGrid>
        <Stat label="Visits today" value={String(approved.length)} />
        <Stat label="Sales" value={money(sales)} />
        <Stat label="Rewards given" value={money(given)} hint="Discounts and cashback" />
        <Stat label="Paid with Mesita Pay" value={percent((viaPay / Math.max(1, approved.length)) * 100)} />
      </StatGrid>

      <Section title={`Waiting for approval (${waiting.length})`}>
        {waiting.length ? (
          <WaitingList visits={waiting} />
        ) : (
          <EmptyState icon={CheckCheck} title="All caught up" body="When a guest opens a visit, it shows up here for staff to approve." />
        )}
      </Section>

      <Section title="Earlier today">
        <List>
          {closed.map((v) => (
            <VisitRow key={v.id} visit={v} />
          ))}
        </List>
      </Section>
    </PageBody>
  );
}
