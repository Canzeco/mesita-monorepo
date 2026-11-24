import { redirect } from "next/navigation";
import { payModalPath } from "@/components/consumer/pay/pay-sections";

// /wallet/buy: an old address. Prepay is the Wallet's own tile (MESITA-4838).
export default function Page() {
  redirect(payModalPath("prepay"));
}
