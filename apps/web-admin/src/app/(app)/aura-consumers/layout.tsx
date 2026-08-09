import { ConfigPageLayout } from "@/components/ConfigPageLayout";

// Aura Consumers — a single flat page (no sub-tabs) under Manage. The roster of
// the invite-only Aura class (segments v6, MESITA-797). What Aura EARNS is
// priced in Rewards Config; this page only decides WHO is in.
export default function AuraConsumersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConfigPageLayout
      eyebrow="Manage · Consumers"
      title="Aura Consumers"
      description="Aura is the invite-only presence class — the top of the ladder (Standard · Premium · Influencer · Aura), and the only one no consumer can reach on their own. That makes it the only class an operator grants by hand, and this page is its single door: invite by consumer id, 8-digit code, phone, @handle or name, and revoke to drop a member back to whatever class they still qualify for on their own. Every rate Aura earns is set in Rewards Config."
    >
      {children}
    </ConfigPageLayout>
  );
}
