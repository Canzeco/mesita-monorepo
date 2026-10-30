import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/page";
import { paymentTabs } from "../tabs";
import { PaymentSettingsForm } from "./PaymentSettingsForm";

export const metadata: Metadata = { title: "Payment settings" };

export default function PaymentSettings() {
  return (
    <PageBody>
      <PageHeader title="Payments" sub="Your Stripe account and tips" tabs={paymentTabs} />
      <PaymentSettingsForm />
    </PageBody>
  );
}
