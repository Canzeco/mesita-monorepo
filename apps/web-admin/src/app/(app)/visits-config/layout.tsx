import { ConfigPageLayout } from "@/components/ConfigPageLayout";

// Visits Config — the local context's policy. One flat page.
export default function VisitsConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConfigPageLayout
      eyebrow="Product · Visits"
      title="Visits Config"
      description="THE TICKET is Mesita's money moment: the guest sits down, types the bill, picks a reward, does the task, shows the QR, pays, and the ticket validates itself. The apps run that journey on constants they ship themselves, so this page carries no knobs at all — it is Soon, not a wall of staged switches. The day THE TICKET reads its policy from here the controls come back; what each one means lives in Notion Docs › Visits. What a visit PAYS is Promos Config; who reads the proof is the Ojo section of General."
    >
      {children}
    </ConfigPageLayout>
  );
}
