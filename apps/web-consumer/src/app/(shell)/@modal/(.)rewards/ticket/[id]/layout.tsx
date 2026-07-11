import { BottomSheetShell } from "@/components/consumer/overlay/BottomSheetShell";

// Mounts the ticket bottom sheet ONCE for this intercepted segment (see
// SlideOverShell's mounting contract) — slides up while content resolves.
export default function TicketModalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <BottomSheetShell>{children}</BottomSheetShell>;
}
