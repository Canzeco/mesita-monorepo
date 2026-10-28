import { MeScreen } from "@/components/consumer/me/MeScreen";
import { PerkList } from "@/components/consumer/me/perk-list";
import { PLAN_ROWS } from "@/components/consumer/me/plan-words";
import {
  RowDivider,
  SettingsGroup,
} from "@/components/consumer/me/settings-rows";
import { SkeletonLine } from "@/components/shared";
import type { GuestPlan } from "@/lib/guest-standing";
import { StandingRowSkeleton } from "../me-skeletons";

// /me/plan's fallback while the page reads the guest's plan (Pato,
// MESITA-2701: "the placeholders must be similar to the page you are
// loading, like the sizes"). PlanModal's card, row for row: Free and
// Pro with their perks as themselves — PLAN_ROWS, the words PlanModal
// draws, so they wrap where the page's do — and only what the read decides
// waiting: each row's disc (primary on the guest's plan) and its 11px line
// ("Your plan." or the plan's own).
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
  const { title, label, items } = PLAN_ROWS[plan];
  return (
    <StandingRowSkeleton title={title}>
      <SkeletonLine className="type-label" bar="w-20" />
      <PerkList label={label} items={items} />
    </StandingRowSkeleton>
  );
}
