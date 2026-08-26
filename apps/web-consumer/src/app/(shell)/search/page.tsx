import { SearchClient } from "@/components/consumer/search/SearchClient";

export const dynamic = "force-dynamic";

export default function SearchPage() {
  const mapKey = process.env.NEXT_PUBLIC_GMP_KEY ?? "";
  return <SearchClient apiKey={mapKey} />;
}
