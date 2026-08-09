import { ConfigPageLayout } from "@/components/ConfigPageLayout";

// Aura Users — a single flat page (no sub-tabs) under the Users section. The
// roster of the invite-only Aura class (segments v6, MESITA-797). What Aura
// EARNS is priced in Rewards Config; this page only decides WHO is in.
export default function AuraUsersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConfigPageLayout
      eyebrow="Users · Aura"
      title="Aura Users"
      description="Aura is the invite-only presence class — the top of the ladder (Standard · Premium · Influencer · Aura), and the only one no consumer can reach on their own. This page is its single door: invite by consumer id, 8-digit code, phone, @handle or name, and revoke to drop a member back to whatever class they still qualify for on their own. Every rate Aura earns is set in Rewards Config."
    >
      {children}
    </ConfigPageLayout>
  );
}
