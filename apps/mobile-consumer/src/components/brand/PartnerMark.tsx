// RN port of web-consumer's PartnerMark — the Mesita Partner badge.
//
// decision: Pato (MESITA-2031) — *"FOR PARTNER BADGE USE THE VERIFIED ICON,
// THAT BLUE SHIT FROM TWITTER KINDA, BUT RED."* The scalloped rosette the whole
// internet reads as "verified", in the `partner` red.
//
// Mobile never got the previous port either: two screens hand-rolled their own
// badge as a `rounded-full bg-[#0EA5E9]` View with a `✓` TEXT GLYPH inside, so
// the check's weight and baseline came from the system font and drifted per
// device. Three more surfaces each picked a different colour for the same fact
// — sky here, brand pink there. One mark, one file, one red.
//
// The silhouette is EIGHT lobes and the path is byte-identical to web's, so the
// two platforms cannot drift apart by a curve. Twitter's badge is eight too,
// and the count is not cosmetic: at the 14–18px this renders at, twelve
// scallops alias into a soft circle and the badge goes back to being a dot.
//
// Web tints via currentColor; RN has no such thing, so colour is a prop
// (MesitaMark carries the same note).
import { Platform } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { COLORS } from '@/constants/brand';

const ROSETTE =
  'M12 2.5A3.68 3.68 0 0 1 18.72 5.28A3.68 3.68 0 0 1 21.5 12A3.68 3.68 0 0 1 18.72 18.72A3.68 3.68 0 0 1 12 21.5A3.68 3.68 0 0 1 5.28 18.72A3.68 3.68 0 0 1 2.5 12A3.68 3.68 0 0 1 5.28 5.28A3.68 3.68 0 0 1 12 2.5Z';
const CHECK = 'M7.5 12.3l3 3 6-6.1';

export function PartnerMark({
  color = COLORS.partner,
  size = 16,
  label = 'Mesita Partner',
}: {
  color?: string;
  size?: number;
  /** Pass null to drop it from the a11y tree (the row already says "Partner"). */
  label?: string | null;
}) {
  // On web react-native-svg forwards RN a11y props to the DOM and React warns,
  // so use ARIA there instead. (MESITA-571)
  const a11y =
    label === null
      ? Platform.select({
          web: { 'aria-hidden': true },
          default: {
            accessibilityElementsHidden: true,
            importantForAccessibility: 'no-hide-descendants',
          },
        })
      : Platform.select({
          web: { role: 'img', 'aria-label': label },
          default: { accessibilityRole: 'image', accessibilityLabel: label },
        });

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...(a11y as object)}>
      <Path d={ROSETTE} fill={color} />
      {/* White, not COLORS.partnerForeground: the check is knocked OUT of the
          fill, so it stays white even when a caller overrides `color`. */}
      <Path
        d={CHECK}
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
