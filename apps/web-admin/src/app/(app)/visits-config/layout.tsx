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
      description="THE TICKET is Mesita's money moment: the guest sits down, types the bill, picks a reward, does the task, shows the QR, pays, and the ticket validates itself. This page is how that journey behaves — the tip chips it offers, how fast each side polls, whether a screenshot is required, how many send-backs it tolerates, which pay rails are open, and when an abandoned ticket gives up. What a visit PAYS is Promos Config; who reads the proof is Ojo. The apps ship their own constants today and nothing here is read, so the page stays empty until THE TICKET takes its policy from this console."
    >
      {children}
    </ConfigPageLayout>
  );
}
