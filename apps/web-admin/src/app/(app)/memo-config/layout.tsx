import { ConfigPageLayout } from "@/components/ConfigPageLayout";

// Memo Config — a single flat page (no sub-tabs). Memo is Mesita's consumer AI
// concierge (consumer-web-ask-memo); this page tunes its persona, model, and
// place-retrieval knobs.
export default function MemoConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConfigPageLayout
      title="Memo Config"
      description="Memo — Mesita's consumer AI concierge (consumer-web-ask-memo). Tune its persona, model, and how it retrieves places."
    >
      {children}
    </ConfigPageLayout>
  );
}
