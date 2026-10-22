import { CLASS_ROWS } from "@/components/consumer/me/class-words";
import { MeScreen } from "@/components/consumer/me/MeScreen";
import { PerkList } from "@/components/consumer/me/perk-list";
import {
  RowDivider,
  SettingsGroup,
} from "@/components/consumer/me/settings-rows";
import { SkeletonLine } from "@/components/shared";
import { StandingRowSkeleton } from "../me-skeletons";

// /me/class' fallback while the page reads the guest's class (Pato,
// MESITA-2701: "the placeholders must be similar to the page you are
// loading, like the sizes"). ClassList's card, row for row: Regular and VIP
// with their fixed words as themselves — CLASS_ROWS, the words ClassList
// draws, so they wrap where the page's do — and only what the read decides
// waiting: each disc (primary on the guest's class) and the "Your class."
// line.
//
// THAT LINE IS HELD UNDER REGULAR: almost every guest is Regular (VIP comes
// only through a partner), so the common page lands with nothing moving.
// The note ClassList adds under the card for a Regular guest is not drawn:
// it lands below everything, so it moves nothing either.
export default function ClassLoading() {
  const { regular, vip } = CLASS_ROWS;
  return (
    <MeScreen title="Class">
      <SettingsGroup>
        <StandingRowSkeleton title={regular.title}>
          <SkeletonLine className="type-label" bar="w-16" />
          <span className="text-muted-foreground type-label block">
            {regular.subtitle}
          </span>
        </StandingRowSkeleton>
        <RowDivider />
        <StandingRowSkeleton title={vip.title}>
          <span className="text-muted-foreground type-label block">
            {vip.subtitle}
          </span>
          {vip.perks && (
            <PerkList label={vip.perks.label} items={vip.perks.items} />
          )}
        </StandingRowSkeleton>
      </SettingsGroup>
      <p role="status" className="sr-only">
        Loading your class
      </p>
    </MeScreen>
  );
}
