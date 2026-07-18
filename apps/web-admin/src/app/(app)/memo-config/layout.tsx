import { ConfigPageLayout } from "@/components/ConfigPageLayout";

// Memo Config — a single flat page (no sub-tabs). Memo is Mesita's consumer AI
// concierge (consumer-web-ask-memo); this page tunes its persona, model, and
// place-retrieval knobs. It lived as a Scoring tab for a while (PR #176);
// pulled back out as its own section by MESITA-627.
export default function MemoConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConfigPageLayout
      eyebrow="Agents · Memo"
      title="Memo Config"
      description="Memo — Mesita's consumer AI concierge (consumer-web-ask-memo), the Ask AI tab on consumer Home. Tune its persona, model, and how it retrieves places. It retrieves its candidates from Lineup (configured in Lineup Config → Scores & Lanes)."
    >
      {children}
    </ConfigPageLayout>
  );
}
