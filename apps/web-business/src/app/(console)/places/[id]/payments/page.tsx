import { ProductList } from "@/components/shell/ProductList";

export const metadata = { title: "Payments" };

// Payments (Pato, MESITA-3136: "Payments (Soon)"): not on yet, so the page
// says what it will be and holds no form.
export default function PaymentsPage() {
  return (
    <div className="flex flex-col gap-3 pb-8">
      <ProductList only={["Digital Payments"]} />
    </div>
  );
}
