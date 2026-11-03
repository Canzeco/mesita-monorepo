import { ProductList } from "@/components/shell/ProductList";

export const metadata = { title: "Rewards" };

// Rewards (Pato, MESITA-3136: "Rewards (Soon)"): not on yet, so the page
// says what it will be and holds no form.
export default function RewardsPage() {
  return (
    <div className="flex flex-col gap-3 pb-8">
      <ProductList only={["Credit Rewards"]} />
    </div>
  );
}
