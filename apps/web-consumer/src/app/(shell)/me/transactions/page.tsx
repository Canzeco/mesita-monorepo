import { TransactionsModal } from "@/components/consumer/me/TransactionsModal";

// /me/transactions — every money line, newest first (MESITA-3465).
export default function Page() {
  return <TransactionsModal />;
}
