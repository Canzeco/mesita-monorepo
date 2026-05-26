import { SimpleHeader } from "@/components/consumer/SimpleHeader";
import { PayTabs } from "./PayTabs";

export default function PayLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <SimpleHeader title="Pay" />
      <PayTabs />
      <div className="scrollbar-hide flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
