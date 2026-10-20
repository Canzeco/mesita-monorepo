import { RouteSheetShell } from "@/components/consumer/overlay/RouteSheetShell";

// Ask AI floats over Search as a sheet (Pato, MESITA-2475: "like a modal"),
// so the map stays in view under it. Mounted from the layout so the rise
// plays once.
export default function AskAiSheetLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RouteSheetShell ariaLabel="Ask AI">{children}</RouteSheetShell>;
}
