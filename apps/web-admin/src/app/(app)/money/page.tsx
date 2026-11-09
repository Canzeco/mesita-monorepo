import { getMoneyConfig, listConnectedPlaces, listNeedsReview } from "./actions";
import { MoneyClient } from "./MoneyClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Money" };

export default async function MoneyPage() {
  const [config, review, places] = await Promise.all([getMoneyConfig(), listNeedsReview(), listConnectedPlaces()]);
  return (
    <MoneyClient
      initialConfig={config.ok ? config.config : null}
      initialRows={review.ok ? review.rows : []}
      initialNext={review.ok ? review.next : null}
      initialPlaces={places.ok ? places : null}
      loadError={!config.ok ? config.error : !review.ok ? review.error : !places.ok ? places.error : null}
    />
  );
}
