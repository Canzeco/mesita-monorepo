import type { Metadata } from "next";
import { Instagram } from "@/components/icons/Instagram";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Star } from "lucide-react";
import { PageBody, PageHeader } from "@/components/page";
import { Avatar, Card, Chip, Line, Section } from "@/components/ui";
import { GuestChips, statusChip } from "@/components/visits";
import { money } from "@/lib/format";
import { guestById, payments, place, rewardCap, rewardRules, stories, visitById, visits } from "@/lib/mock";
import { LOYALTY_VISITS } from "@/lib/rewards";

export const metadata: Metadata = { title: "Visit" };

export function generateStaticParams() {
  return visits.map((v) => ({ id: v.id }));
}

export default async function VisitDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = visitById(id);
  if (!v) notFound();
  const g = guestById(v.guestId);
  const payment = payments.find((p) => p.visitId === v.id);
  const story = stories.find((s) => s.visitId === v.id);
  const pastHere = visits.filter((x) => x.guestId === g.id && x.id !== v.id && x.status === "approved");
  const anyCapped = v.rewards.applied.some((a) => a.capped);

  return (
    <PageBody>
      <PageHeader
        back={{ href: "/visits/history", label: "Visits" }}
        title={money(v.bill)}
        status={statusChip(v.status)}
        sub={`${v.day} · ${v.time} · ${v.party} people · ${v.id}`}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        <div className="grid gap-4">
          <Card className="p-4">
            <h2 className="mb-2 font-semibold">The bill</h2>
            <Line label="Bill" value={money(v.bill)} />
            {v.rewards.applied.map((a) => {
              const rule = rewardRules.find((r) => r.id === a.id)!;
              return (
                <Line
                  key={a.id}
                  label={
                    <span>
                      {rule.name} · {a.percent}%{a.capped ? " (capped)" : ""}
                      <span className="block text-xs text-muted-foreground">
                        {a.mode === "discount" ? "Off today's bill" : "Cashback to the guest's Credits"}
                      </span>
                    </span>
                  }
                  value={a.mode === "discount" ? `−${money(a.amount)}` : `+${money(a.amount)} credit`}
                />
              );
            })}
            {v.tip > 0 ? <Line label={`Tip · ${v.tipPercent}% of the bill before rewards`} value={money(v.tip)} /> : null}
            <Line label={`Paid with ${v.paidWith}`} value={money(v.due)} strong />
            {anyCapped ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Rewards on one visit never pass your cap of {money(rewardCap)}.
              </p>
            ) : null}
          </Card>

          {story || v.review ? (
            <Card className="p-4">
              <h2 className="mb-3 font-semibold">Proof</h2>
              {story ? (
                <div className="flex items-center gap-3">
                  <div className={`h-24 w-14 shrink-0 rounded-lg bg-linear-to-br ${story.tone}`} aria-hidden />
                  <div className="text-sm">
                    <div className="flex items-center gap-1.5 font-medium">
                      <Instagram className="size-4" aria-hidden /> Story by {g.handle}
                    </div>
                    <div className="mt-0.5 text-muted-foreground">“{story.caption}” · tagged {place.instagram}</div>
                  </div>
                </div>
              ) : null}
              {v.review ? (
                <div className="mt-3 flex gap-3 text-sm">
                  <Star className="mt-0.5 size-4 shrink-0 fill-current text-warning" aria-hidden />
                  <p>“{v.review}” · Google review</p>
                </div>
              ) : null}
            </Card>
          ) : null}

          <Card className="p-4">
            <h2 className="mb-2 font-semibold">Log</h2>
            <ol className="grid gap-2 text-sm">
              <li className="flex justify-between gap-3"><span>Guest opened the visit and entered the bill</span><span className="text-muted-foreground">{v.time}</span></li>
              {v.status !== "waiting" ? (
                <li className="flex justify-between gap-3">
                  <span>{v.status === "approved" ? "Approved" : "Rejected"} by {v.approvedBy}</span>
                  <span className="text-muted-foreground">+2 min</span>
                </li>
              ) : null}
              {payment ? (
                <li className="flex justify-between gap-3">
                  <Link href={`/payments/${payment.id}`} className="underline">Paid {money(payment.amount)} · {payment.card}</Link>
                  <span className="text-muted-foreground">+3 min</span>
                </li>
              ) : null}
            </ol>
          </Card>
        </div>

        <Card className="h-fit p-4">
          <div className="flex items-center gap-3">
            <Avatar name={g.name} vip={g.vip} />
            <div className="min-w-0">
              <div className="truncate font-medium">{g.name}</div>
              <div className="text-sm text-muted-foreground">{g.handle ?? "No Instagram"}</div>
            </div>
          </div>
          <div className="mt-3">
            <GuestChips guestId={g.id} />
          </div>
          <div className="mt-4 grid gap-1">
            <Line label="Visits here" value={g.visitsHere} />
            <Line label="Next Loyalty Reward" value={`${LOYALTY_VISITS - (g.visitsHere % LOYALTY_VISITS)} visits`} muted />
          </div>
          {pastHere.length ? (
            <Section title="Earlier visits" className="mt-4">
              <ul className="grid gap-1 text-sm">
                {pastHere.slice(0, 4).map((p) => (
                  <li key={p.id}>
                    <Link href={`/visits/${p.id}`} className="flex justify-between hover:underline">
                      <span>{p.day}</span>
                      <span className="tabular">{money(p.bill)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          ) : (
            <div className="mt-3">
              <Chip tone="brand">First visit</Chip>
            </div>
          )}
        </Card>
      </div>
    </PageBody>
  );
}
