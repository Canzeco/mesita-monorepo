import { ConfigPageLayout, Notice, SectionCard, Stat, Table, TBody, Td, Th, THead, Tr } from "@/components/admin-ui";
import { COST_JOBS, first300Viewers, jobTotal, type CostJob, type CostSection } from "./prices";

// Extra › Cost (MESITA-4518). Static published rates. No Edge Function.

const usd = (n: number) => `$${n.toFixed(3)}`;

const SECTIONS: { id: CostSection; title: string; lede: string }[] = [
  {
    id: "fixed",
    title: "Fixed",
    lede: "Paid once per place. It does not depend on how many people open it.",
  },
  {
    id: "variable",
    title: "Variable",
    lede: "Paid again as unique viewers add up. The same person opening the place again does not count.",
  },
];

function JobCard({ job }: { job: CostJob }) {
  const total = jobTotal(job);
  return (
    <SectionCard
      title={job.alsoCalled ? `${job.title} · ${job.alsoCalled}` : job.title}
      subtitle={job.when}
      right={<Stat label="Per place" value={usd(total)} />}
    >
      <Table className="mt-4">
        <THead>
          <Tr>
            <Th>Vendor</Th>
            <Th>Call</Th>
            <Th numeric>Count</Th>
            <Th numeric>USD</Th>
          </Tr>
        </THead>
        <TBody>
          {job.lines.map((line) => (
            <Tr key={`${job.id}-${line.what}`}>
              <Td>{line.vendor}</Td>
              <Td>{line.what}</Td>
              <Td numeric>{line.count}</Td>
              <Td numeric>{usd(line.usd)}</Td>
            </Tr>
          ))}
        </TBody>
      </Table>
      {job.note ? <p className="text-muted-foreground mt-3 text-sm">{job.note}</p> : null}
    </SectionCard>
  );
}

export default function CostPage() {
  const window = first300Viewers();
  return (
    <ConfigPageLayout
      title="Cost"
      description="US dollars per place, after Google’s free cap. These are the published rates for the next call, not this month’s invoice."
    >
      <div className="flex flex-col gap-8">
        {SECTIONS.map((section) => (
          <section key={section.id} className="flex flex-col gap-4">
            <div>
              <h2 className="font-display text-lg font-semibold tracking-tight">{section.title}</h2>
              <p className="text-muted-foreground mt-0.5 text-sm">{section.lede}</p>
            </div>
            {COST_JOBS.filter((job) => job.section === section.id).map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </section>
        ))}
        <Notice>
          A page load pays nothing. Over the first 300 unique viewers the variable side is about{" "}
          {usd(window.fast)} of Fast Update, {usd(window.deepUpdate)} of Deep Update, and one Enrich at{" "}
          {usd(window.enrich)}. Create stays in Fixed.
        </Notice>
      </div>
    </ConfigPageLayout>
  );
}
