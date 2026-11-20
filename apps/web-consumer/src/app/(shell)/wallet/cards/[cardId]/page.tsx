import { CardMethodPage } from "@/components/consumer/wallet/CardMethodPage";

export default async function Page({ params }: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await params;
  return <CardMethodPage cardId={decodeURIComponent(cardId)} />;
}
