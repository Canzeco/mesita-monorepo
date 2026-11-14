import { BONE_CLASS, SECTION_CARD_CLASS } from "@/components/admin-ui/manage";
import { PageContainer, PageHeader } from "@/components/PageContainer";

// Activity › Feedback while the feedback loads: the real header, then the
// one card (MESITA-3851) with three rows at their sizes (place + chip, note,
// who · when). Without it the previous page stays painted after the rail tap.

function Bone({ className }: { className: string }) {
  return <div aria-hidden className={`${BONE_CLASS} ${className}`} />;
}

export default function FeedbackLoading() {
  return (
    <PageContainer className="flex flex-col gap-6 sm:gap-8">
      <PageHeader title="Feedback" description="Everything guests send, newest first." />
      <section aria-hidden className={SECTION_CARD_CLASS}>
        <span className="sr-only">Loading feedback</span>
        <div className="flex flex-col">
          {[0, 1, 2].map((i) => (
            <div key={i} className="border-border flex flex-col gap-2 border-t py-3 first:border-t-0 first:pt-0">
              <div className="flex items-center gap-2">
                <Bone className="h-3.5 w-40" />
                <Bone className="h-5 w-24 rounded-full" />
              </div>
              <Bone className="h-3.5 w-3/4" />
              <Bone className="h-3 w-48" />
            </div>
          ))}
        </div>
      </section>
    </PageContainer>
  );
}
