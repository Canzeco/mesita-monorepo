import { ProductList } from "@/components/shell/ProductList";

export const metadata = { title: "Payments" };

// Payments (Pato, MESITA-3136: "Payments (Soon)"): not on yet, so the page
// says what it will be and holds no form.
export default function PaymentsPage() {
  return (
    <div className="flex max-w-3xl flex-col gap-3 pb-8">
      <p className="text-muted-foreground text-sm">Coming to Mesita for your place. Nothing here is on yet.</p>
      <ProductList only={["Digital Payments"]} />
    </div>
  );
}
