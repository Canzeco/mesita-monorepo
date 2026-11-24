import { redirect } from "next/navigation";
import { payTabPath } from "@/components/consumer/pay/pay-sections";

// /pay/pick: an old address. The places are the Wallet's Pay tile (MESITA-4838).
export default function Page() {
  redirect(payTabPath("pay"));
}
