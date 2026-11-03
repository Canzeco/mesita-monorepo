import { ProductList } from "@/components/shell/ProductList";

export const metadata = { title: "Future" };

// What Mesita is building next for a place (Pato, MESITA-3128): the products
// still marked Soon. Profile and Premier have their own menu rows.
export default function FuturePage() {
  return (
    <div className="flex max-w-3xl flex-col gap-3 pb-8">
      <p className="text-muted-foreground text-sm">Coming to Mesita for your place. Nothing here is on yet.</p>
      <ProductList soonOnly />
    </div>
  );
}
