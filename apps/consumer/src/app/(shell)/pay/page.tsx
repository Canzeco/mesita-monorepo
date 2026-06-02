import { redirect } from "next/navigation";

// /pay → default tab
export default function PayIndexPage() {
  redirect("/pay/qr");
}
