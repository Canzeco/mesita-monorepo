import { SoonCard } from "@/components/shell/SoonCard";

export const metadata = { title: "Products" };

// Products is not on yet: the box says Soon and explains nothing
// (MESITA-3171).
export default function ProductsPage() {
  return (
    <div className="flex flex-col gap-3 pb-8">
      <SoonCard />
    </div>
  );
}
