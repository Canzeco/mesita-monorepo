import { ConfigPageLayout } from "@/components/ConfigPageLayout";

// Verification Config — a single flat page (no sub-tabs). Owns every
// verification policy knob: catalog Verified Partner badge at create time,
// plus per-method ownership auto-confirm (phone / email / video).
export default function VerificationConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConfigPageLayout
      eyebrow="Operations · Verification"
      title="Verification Config"
      description="Two layers, one page. The Verified Partner badge on place profiles is projects.listing_type — separate from ownership proof. Ownership is phone/email OTP or a video walkthrough; these toggles decide whether a successful proof grants ownership immediately or waits on the Verification Queue under Alerts."
    >
      {children}
    </ConfigPageLayout>
  );
}
