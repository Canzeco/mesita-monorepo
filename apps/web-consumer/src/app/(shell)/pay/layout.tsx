import { PayList } from "@/components/consumer/rewards/PayList";

// Pay's list lives here, not in the page (Pato, MESITA-3254: "here in pay actually
// use sub routes"), so it stays painted and keeps its scroll under the sheet at
// /pay/<place>/<step>. With no loading.tsx below this layout, a tap from another
// tab draws (shell)/loading.tsx's Pay frame, and a tap on a row keeps the list.
export default function PayLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PayList />
      {children}
    </>
  );
}
