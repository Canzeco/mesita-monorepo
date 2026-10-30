import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/page";
import { profileTabs } from "../tabs";
import { ProfileLinksForm } from "./ProfileLinksForm";

export const metadata: Metadata = { title: "Profile links" };

export default function ProfileLinks() {
  return (
    <PageBody>
      <PageHeader title="Profile" sub="Where guests find you, and what two rewards need" tabs={profileTabs} />
      <ProfileLinksForm />
    </PageBody>
  );
}
