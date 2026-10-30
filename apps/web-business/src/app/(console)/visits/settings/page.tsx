import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/page";
import { visitTabs } from "@/components/visits";
import { VisitSettingsForm } from "./VisitSettingsForm";

export const metadata: Metadata = { title: "Visit settings" };

export default function VisitSettings() {
  return (
    <PageBody>
      <PageHeader title="Visits" sub="Who approves visits, and how you hear about them" tabs={visitTabs} />
      <VisitSettingsForm />
    </PageBody>
  );
}
