import { PageHeader, Card } from "@/components/shell/Page";

// Payments, Prepayments and Rewards are on the way (MESITA-3103): a page that
// says so, no forms, no flows.
export function ComingSoon({ title, line }: { title: string; line: string }) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} />
      <Card className="flex flex-col items-start gap-2">
        <span className="bg-muted text-muted-foreground type-label rounded-full px-2.5 py-1 font-semibold">Coming soon</span>
        <p className="text-sm leading-relaxed">{line}</p>
      </Card>
    </div>
  );
}
