import { PageHeader } from "@/components/shell/Page";
import { ClaimSearch } from "./ClaimSearch";

export const metadata = { title: "Claim your place" };

export default function ClaimPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Claim your place"
        sub="Find your place on Mesita and tell us who you are there. Mesita reviews every request, usually within a day."
      />
      <ClaimSearch autoFocus />
    </div>
  );
}
