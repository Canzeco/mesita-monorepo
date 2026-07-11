import { ConfigPageLayout } from "@/components/ConfigPageLayout";

// Buzz Config — the GLOBAL side of Buzz: the draft model and its knobs.
// The per-place score lives in Manage Single Unit → Buzz.
export default function BuzzConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConfigPageLayout
      title="Buzz Config"
      description="The model behind Buzz — the potency every place carries into the recommendation engines (Swipe, the Map, Memo). Per-place scores live in Manage Single Unit → Buzz."
    >
      {children}
    </ConfigPageLayout>
  );
}
