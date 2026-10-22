import { MeScreen } from "@/components/consumer/me/MeScreen";
import { PerkList } from "@/components/consumer/me/perk-list";
import {
  RowDivider,
  SettingsGroup,
} from "@/components/consumer/me/settings-rows";
import { SkeletonLine } from "@/components/shared/Skeleton";
import { FREE_RESERVATIONS_PER_MONTH } from "@/lib/plan-perks";
import { StandingRowSkeleton } from "../me-skeletons";

// /me/plan's fallback while the page reads the guest's plan (Pato,
// MESITA-2701: "the placeholders must be similar to the page you are
// loading, like the sizes"). PlanModal's card, row for row: Free and
// Premium with their perks as themselves — fixed words, so they wrap where
// the page's do — and only what the read decides waiting: each row's disc
// (primary on the guest's plan) and its 11px line ("Your plan." or the
// plan's own). The perks are PlanModal's; change them there and here.
export default function PlanLoading() {
  return (
    <MeScreen title="Plan">
      <SettingsGroup>
        <StandingRowSkeleton title="Free">
          <SkeletonLine className="type-label" bar="w-20" />
          <PerkList
            label="Included in Free"
            items={[
              { text: "Browse and save places" },
              { text: "Mesita calls the place to book your table" },
              { text: `${FREE_RESERVATIONS_PER_MONTH} reservations a month` },
            ]}
          />
        </StandingRowSkeleton>
        <RowDivider />
        <StandingRowSkeleton title="Premium">
          <SkeletonLine className="type-label" bar="w-20" />
          <PerkList
            label="Included in Premium"
            items={[
              {
                text: `Everything in Free, including ${FREE_RESERVATIONS_PER_MONTH} reservations a month`,
              },
              { text: "More reservations every month", soon: true },
              {
                text: "Ask your AI assistant, like ChatGPT, to find and book places for you",
                soon: true,
              },
            ]}
          />
        </StandingRowSkeleton>
      </SettingsGroup>
      <p role="status" className="sr-only">
        Loading your plan
      </p>
    </MeScreen>
  );
}
