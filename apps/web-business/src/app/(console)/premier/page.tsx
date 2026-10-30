import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, TrendingUp } from "lucide-react";
import { PageBody, PageHeader } from "@/components/page";
import { ButtonLink, Card, Chip, Note, Section } from "@/components/ui";
import { place, premierTiers, profileChecklist, rewardRules } from "@/lib/mock";

export const metadata: Metadata = { title: "Premier" };

export default function Premier() {
  const onPremier = place.plan !== "Free";
  const badge = [
    { label: "Verified", done: place.verified },
    { label: "Profile complete", done: profileChecklist.every((c) => c.done), href: "/profile", cta: "Open Profile" },
    { label: "Rewards on", done: rewardRules.some((r) => r.enabled), href: "/rewards/settings", cta: "Open Rewards" },
    { label: "Payments on", done: place.stripeConnected, href: "/payments/settings", cta: "Open Payments" },
    { label: "Premier", done: onPremier, href: "/billing", cta: "Upgrade" },
  ];
  const doneCount = badge.filter((b) => b.done).length;

  return (
    <PageBody>
      <PageHeader
        title="Premier"
        sub="Be shown more often to guests looking for where to go"
        status={<Chip tone={onPremier ? "success" : "neutral"}>{place.plan}</Chip>}
        actions={onPremier ? null : <ButtonLink href="/billing" variant="primary">Upgrade</ButtonLink>}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {premierTiers.map((t) => (
          <Card key={t.name} className="p-5">
            <div className="flex items-center gap-2">
              <TrendingUp className="size-5 text-brand-text" aria-hidden />
              <span className="font-display text-xl font-semibold">{t.name}</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{t.line}</p>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Price to be set</span>
              <Link href="/billing" className="text-sm font-medium text-brand-text">Choose</Link>
            </div>
          </Card>
        ))}
      </div>
      <Note>Premier changes how often you are shown, never the reviews, ratings or rewards guests see.</Note>

      <Section title="Partner badge" aside={<span className="text-sm text-muted-foreground">{doneCount} of {badge.length} done</span>}>
        <Card className="divide-y divide-border">
          {badge.map((b) => (
            <div key={b.label} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="font-medium">{b.label}</span>
              {b.done ? (
                <Chip tone="dark">Done</Chip>
              ) : (
                <span className="flex items-center gap-2">
                  <Chip>Not yet</Chip>
                  {b.href ? (
                    <Link href={b.href} className="rounded-full border border-border px-3 py-1 text-sm font-medium hover:bg-muted">
                      {b.cta}
                    </Link>
                  ) : null}
                </span>
              )}
            </div>
          ))}
        </Card>
        <p className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
          <BadgeCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
          Guests see the Partner badge on your profile once all five are done. You are on {place.plan}, so there is no badge yet.
        </p>
      </Section>
    </PageBody>
  );
}
