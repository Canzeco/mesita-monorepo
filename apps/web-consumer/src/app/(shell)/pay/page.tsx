import { QrCode } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";

// Pay — ONE page, the Soon state. No action button: there is no next step a
// guest can take toward paying today.
export default function PayPage() {
  return (
    <EmptyState
      icon={QrCode}
      title="Pay is coming soon"
      description="Paying at a place with Mesita lands here shortly — thanks for waiting."
    />
  );
}
