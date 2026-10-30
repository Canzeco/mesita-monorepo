import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/page";
import { profileTabs } from "../tabs";
import { ProfileInfoForm } from "./ProfileInfoForm";

export const metadata: Metadata = { title: "Profile info" };

export default function ProfileInfo() {
  return (
    <PageBody>
      <PageHeader title="Profile" sub="What guests read on your page. Filled from Google; edit anything." tabs={profileTabs} />
      <ProfileInfoForm />
    </PageBody>
  );
}
