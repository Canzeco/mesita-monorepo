import { PageHeader } from "@/components/shell/Page";
import { ClaimSearch } from "./ClaimSearch";

export const metadata = { title: "Claim your place" };

export default function ClaimPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Claim your place"
        sub="Find your place on Mesita. If the phone you signed in with is the one on its listing, it is yours at once; otherwise Mesita reviews your request."
      />
      <ClaimSearch />
    </div>
  );
}
