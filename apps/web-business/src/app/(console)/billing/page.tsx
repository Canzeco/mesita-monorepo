import type { Metadata } from "next";
import { CreditCard, FileText } from "lucide-react";
import { PageBody, PageHeader } from "@/components/page";
import { ButtonLink, Card, Chip, EmptyState, Note, Section } from "@/components/ui";
import { place } from "@/lib/mock";
import { TaxForm } from "./TaxForm";

export const metadata: Metadata = { title: "Billing" };

export default function Billing() {
  return (
    <PageBody>
      <PageHeader title="Billing" sub="What you pay Mesita" />

      <Section title="Plan">
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display text-2xl font-semibold">{place.plan}</span>
              <Chip tone="success">Current</Chip>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Profile, Visits, Rewards, Payments and Credits are included. Premier adds visibility.
            </p>
          </div>
          <ButtonLink href="/premier" variant="primary">See Premier</ButtonLink>
        </Card>
      </Section>

      <Section title="Payment method">
        <EmptyState icon={CreditCard} title="No card yet" body="Add a card when you choose Premier. Payments from guests never come out of it." />
      </Section>

      <Section title="Invoices">
        <EmptyState icon={FileText} title="No invoices yet" body="Every Premier charge appears here to download." />
      </Section>

      <Section title="Tax details">
        <TaxForm />
        <Note>Invoices for Mexican tax deductions (CFDI) are not settled yet.</Note>
      </Section>
    </PageBody>
  );
}
