import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/page";
import { comingSoon } from "@/lib/mock";
import { NotifyList } from "./NotifyList";

export const metadata: Metadata = { title: "Coming soon" };

export default function ComingSoon() {
  return (
    <PageBody>
      <PageHeader title="Coming soon" sub="Tell us what you want next. We build what places ask for." />
      <NotifyList items={comingSoon} />
    </PageBody>
  );
}
