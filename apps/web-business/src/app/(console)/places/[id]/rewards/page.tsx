import { ProductList } from "@/components/shell/ProductList";

export const metadata = { title: "Rewards" };

// Rewards (Pato, MESITA-3136: "Rewards (Soon)"): not on yet, so the page
// says what it will be and holds no form.
export default function RewardsPage() {
  return (
    <div className="flex max-w-3xl flex-col gap-3 pb-8">
      <p className="text-muted-foreground text-sm">Coming to Mesita for your place. Nothing here is on yet.</p>
      <ProductList only={["Credit Rewards"]} />
    </div>
  );
}
