import { ProductList } from "@/components/shell/ProductList";

export const metadata = { title: "Products" };

// Products (Pato, MESITA-3152: "add also menu as soon"): the place's menu,
// not on yet, so the page says what it will be and holds no form.
export default function ProductsPage() {
  return (
    <div className="flex flex-col gap-3 pb-8">
      <ProductList only={["Mesita Menu"]} />
    </div>
  );
}
