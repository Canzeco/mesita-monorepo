import { redirect } from "next/navigation";

// Folded into Products (MESITA-3114).
export default function Page() {
  redirect("/products");
}
