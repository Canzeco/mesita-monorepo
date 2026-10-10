import { SoonStrip } from "@/components/console/SoonStrip";
import { SOON_STRIPS } from "@/components/console/SoonStrips";

export default function AdminCapitalPage() {
  return (
    <>
      <p className="text-muted-foreground text-sm leading-snug">
        Take cash now against meals you have not served yet. An advance sale of
        food, never a loan. Nothing is live yet.
      </p>
      <SoonStrip {...SOON_STRIPS.capital} />
    </>
  );
}
