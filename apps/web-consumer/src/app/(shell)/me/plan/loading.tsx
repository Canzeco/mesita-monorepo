import { MeScreen } from "@/components/consumer/me/MeScreen";
import { PerkList } from "@/components/consumer/me/perk-list";
import { PLAN_ROWS } from "@/components/consumer/me/plan-words";
import {
  RowDivider,
  SettingsGroup,
} from "@/components/consumer/me/settings-rows";
import type { GuestPlan } from "@/lib/guest-standing";
import { StandingRowSkeleton } from "../me-skeletons";

// /me/plan's fallback while the page reads the guest's plan (Pato,
// MESITA-2701: "the placeholders must be similar to the page you are
// loading, like the sizes"). PlanModal's card, row for row: Free and
// Pro with their perks as themselves — PLAN_ROWS, the words PlanModal
// draws, so they wrap where the page's do — and only what the read decides
// waiting: the Current pill, which lands beside the guest's plan's title and
// moves nothing (MESITA-2983).
export default function PlanLoading() {
  return (
    <MeScreen title="Plan">
      <SettingsGroup>
        <PlanRowSkeleton plan="free" />
        <RowDivider />
        <PlanRowSkeleton plan="premium" />
      </SettingsGroup>
      <p role="status" className="sr-only">
        Loading your plan
      </p>
    </MeScreen>
  );
}

function PlanRowSkeleton({ plan }: { plan: GuestPlan }) {
  const { title, subtitle, label, items } = PLAN_ROWS[plan];
  return (
    <StandingRowSkeleton title={title}>
      <span className="text-muted-foreground type-label block">{subtitle}</span>
      <PerkList label={label} items={items} />
    </StandingRowSkeleton>
  );
}
