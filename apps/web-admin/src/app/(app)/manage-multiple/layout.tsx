import { PageContainer, PageHeader } from "@/components/admin-ui";

// Manage › Multiple Places — one flat page: Google Search · Mesita Search ·
// Create · Enrich · Update, over a pasted list. The one-place sibling is
// Single Place (/manage-single), which runs the same actions on one place.
//
// No umbrella word over the three writes (MESITA-2096 retired "Crenup", which
// had replaced "Intake"): each verb is its own box, and the header names them.

export default function ManageMultipleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PageContainer>
      <PageHeader
        title="Multiple Places"
        description="Many places at once. Google Search and Mesita Search look them up; Create, Enrich and Edit write them. The rail jumps to each; one place at a time is Single Place."
      />
      {/* pb tops the container's own pb-10/sm:pb-14 up to 64/96px; the kit's cn has no merge. */}
      <div className="mt-6 pb-6 sm:mt-8 sm:pb-10">{children}</div>
    </PageContainer>
  );
}
