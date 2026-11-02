import { PageHeader } from "@/components/shell/Page";
import { ProductList } from "@/components/shell/ProductList";

export const metadata = { title: "Settings" };

// Settings without a place (MESITA-3117): only the products list. A place's
// own settings are /places/<id>/settings, with the same list at its foot.
export default function SettingsPage() {
  return (
    <div className="flex max-w-3xl flex-col gap-6 pb-8">
      <PageHeader title="Settings" sub="Choose a place to see its settings." />
      <ProductList />
    </div>
  );
}
