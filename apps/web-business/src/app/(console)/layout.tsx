import { BottomTabs, MobileHeader, MockBanner, Sidebar } from "@/components/shell";

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MockBanner />
      <Sidebar />
      <div className="lg:pl-64">
        <MobileHeader />
        <main>{children}</main>
      </div>
      <BottomTabs />
    </>
  );
}
