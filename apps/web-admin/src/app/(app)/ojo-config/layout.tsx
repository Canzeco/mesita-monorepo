import { ConfigPageLayout } from "@/components/ConfigPageLayout";

// Ojo Config — the proof-verification engine's policy. One flat page.
export default function OjoConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConfigPageLayout
      eyebrow="Agents · Ojo"
      title="Ojo Config"
      description="Ojo reads the screenshot a guest posts as proof of an Instagram story or a Google review and scores how well it matches the place and the task. It is friction, not proof: a screenshot cannot show that a review is still live, that the account belongs to the guest, or that the screen is theirs — so Ojo returns a confidence band, never a silent rejection. The engine is not built yet (MESITA-1034); every knob here is live and saved, and STAGED until it ships."
    >
      {children}
    </ConfigPageLayout>
  );
}
