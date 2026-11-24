import { redirect } from "next/navigation";
import { payModalPath } from "@/components/consumer/pay/pay-sections";

// /pay/pick: an old address. The places are the Wallet's Pay modal (MESITA-4846).
export default function Page() {
  redirect(payModalPath("pay"));
}
