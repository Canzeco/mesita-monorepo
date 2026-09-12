import { TiersClient } from "./TiersClient";
import { DiscountCapClient } from "./DiscountCapClient";
import { PromosSaveFooter } from "./PromosSaveFooter";
import { PromosSuperBox } from "./PromosSuperBox";

// Visits Rewards — composed onto Visits (MESITA-1784), own blob, own Save.
// Strategies table then Discount Cap then Save. The Expected Distribution
// box is gone (MESITA-1705): the console shows the rates a place is paid, not
// a forecast of them.
export function VisitsRewardsForm() {
  return (
    <div className="flex flex-col gap-8">
      <PromosSuperBox
        title="Visits Rewards"
        subtitle="Rates a visit pays. A place picks one column. Not orders, not prepaid."
      >
        <TiersClient />
      </PromosSuperBox>
      <PromosSuperBox
        title="Discount Cap"
        subtitle="First N pesos of a visit bill. Platform fallback — a place cap wins when set."
      >
        <DiscountCapClient />
      </PromosSuperBox>
      <PromosSaveFooter />
    </div>
  );
}
