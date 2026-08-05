import { ConfigPageLayout } from "@/components/ConfigPageLayout";

// Verification Config — a single flat page (no sub-tabs). Governs whether
// newly created places start as Verified Partner on the consumer surface.
export default function VerificationConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConfigPageLayout
      eyebrow="Operations · Verification"
      title="Verification Config"
      description="Verified vs Not Verified on place profiles is the Verified Partner badge (projects.listing_type). Real ownership proof is entering the place's phone number (OTP). This page only controls whether new places are created already showing as Verified Partner — even when nobody has proven ownership yet."
    >
      {children}
    </ConfigPageLayout>
  );
}
