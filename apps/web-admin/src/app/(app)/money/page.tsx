import { getMoneyConfig, listNeedsReview } from "./actions";
import { MoneyClient } from "./MoneyClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Money" };

export default async function MoneyPage() {
  const [config, review] = await Promise.all([getMoneyConfig(), listNeedsReview()]);
  return (
    <MoneyClient
      initialConfig={config.ok ? config.config : null}
      initialRows={review.ok ? review.rows : []}
      initialNext={review.ok ? review.next : null}
      loadError={!config.ok ? config.error : !review.ok ? review.error : null}
    />
  );
}
