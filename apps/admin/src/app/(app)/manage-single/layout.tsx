import { ManageSingleLayoutShell } from "./ManageSingleLayoutShell";

export default function ManageSingleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // PageContainer lives inside ManageSingleLayoutShell so unit-editor routes
  // can full-bleed the sticky chrome (no max-w-6xl gutters).
  return <ManageSingleLayoutShell>{children}</ManageSingleLayoutShell>;
}
