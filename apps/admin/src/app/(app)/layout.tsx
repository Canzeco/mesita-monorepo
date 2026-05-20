import { Sidebar } from "@/components/Sidebar";

// Layout for the authenticated admin surface. The middleware gates every
// route below this layout — if the request hits here, the visitor has
// already cleared the password.
export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <main className="flex-1 overflow-x-hidden">{children}</main>
    </div>
  );
}
