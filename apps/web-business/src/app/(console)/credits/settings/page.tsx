import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/page";
import { creditTabs } from "../tabs";
import { CreditSettingsForm } from "./CreditSettingsForm";

export const metadata: Metadata = { title: "Credit settings" };

export default function CreditSettings() {
  return (
    <PageBody>
      <PageHeader title="Credits" sub="How long credit lasts" tabs={creditTabs} />
      <CreditSettingsForm />
    </PageBody>
  );
}
