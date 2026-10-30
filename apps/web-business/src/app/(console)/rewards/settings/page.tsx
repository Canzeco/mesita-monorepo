import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/page";
import { rewardTabs } from "../tabs";
import { RewardSettingsForm } from "./RewardSettingsForm";

export const metadata: Metadata = { title: "Reward settings" };

export default function RewardSettings() {
  return (
    <PageBody>
      <PageHeader title="Rewards" sub="Turn each reward on, set what it's worth, and cap the total" tabs={rewardTabs} />
      <RewardSettingsForm />
    </PageBody>
  );
}
