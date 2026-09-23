import {
  ChevronRight,
  Info,
  Utensils,
} from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { MenuViewer } from '@/components/place/MenuViewer';
import { COLORS } from '@/constants/brand';
import { menuSubtitle } from '@/lib/menu-url';
import { nutritionLine } from '@/lib/nutrition';
import type { PlaceMenuItem } from '@/lib/types/place-detail';

export function ProductsTab({ menus }: { menus: PlaceMenuItem[] }) {
  const [active, setActive] = useState<PlaceMenuItem | null>(null);

  return (
    <>
      <View className="overflow-hidden rounded-2xl border border-border bg-card p-4">
        <View className="mb-3 flex-row items-center gap-2">
          {/* The section mark. Amber was decoration, so the tile is `muted`
              like every other one (see ui/BoxRow) — but the glyph stays FULL
              INK here, one weight above the muted Utensils of the empty state
              below, so "there is a menu" and "there is no menu" cannot render
              as the same picture at two sizes. */}
          <View className="size-8 items-center justify-center rounded-full bg-muted">
            <Utensils color={COLORS.foreground} size={16} />
          </View>
          <Text className="text-[10px] font-bold tracking-[0.18em] text-muted-foreground uppercase">
            Menu
          </Text>
        </View>

        {menus.length === 0 ? (
          <View className="items-center gap-2 py-4">
            <View className="size-12 items-center justify-center rounded-full bg-muted">
              <Utensils color={COLORS.mutedForeground} size={20} />
            </View>
            <Text className="font-display text-sm font-semibold text-foreground">
              No menu available yet
            </Text>
            <Text className="px-4 text-center text-xs leading-snug text-muted-foreground">
              This place hasn{"'"}t uploaded a menu or product catalog.
            </Text>
          </View>
        ) : (
          <View className="gap-2">
            {/* THE PRICE CAVEAT, RE-SEPARATED BY SHAPE (MESITA-1954). Amber
                was the entire signal that these prices are not binding, and the
                achromatic form of a light tinted box is `bg-muted` — the EXACT
                fill of the menu rows directly beneath it, so the caveat would
                have dissolved into the list it warns about. It inverts instead:
                the rows stay FILLED and this becomes OUTLINED over the card's
                own white, the vocabulary's "a real state nobody must act on".
                The Info glyph stays and takes full ink, which is what keeps a
                bordered box above a list from reading as a section header —
                and the outline is muted-foreground at the amber's own 40%,
                not the hairline, so it is not mistaken for a divider. */}
            <View className="mb-1 flex-row items-start gap-2 rounded-xl border border-muted-foreground/40 bg-card px-3 py-2.5">
              <Info
                color={COLORS.foreground}
                size={14}
                style={{ marginTop: 1 }}
              />
              <Text className="flex-1 text-[11px] leading-snug font-medium text-foreground">
                Reference only — current product prices may differ at the
                place.
              </Text>
            </View>
            {menus.map((m) => (
              <Pressable
                key={`${m.name}-${m.url}`}
                onPress={() => setActive(m)}
                className="flex-row items-center gap-3 rounded-xl bg-background p-3 active:opacity-90"
              >
                <View className="size-9 items-center justify-center rounded-full bg-muted">
                  <Utensils color={COLORS.foreground} size={16} />
                </View>
                <View className="min-w-0 flex-1">
                  <Text
                    className="font-display text-base font-semibold text-foreground"
                    numberOfLines={1}
                  >
                    {m.name}
                  </Text>
                  {nutritionLine(m.nutrition) ? (
                    <Text
                      className="text-xs text-foreground"
                      numberOfLines={2}
                    >
                      {nutritionLine(m.nutrition)}
                    </Text>
                  ) : null}
                  <Text
                    className="text-xs text-muted-foreground"
                    numberOfLines={1}
                  >
                    {menuSubtitle({
                      kind: m.kind,
                      pages: m.pages,
                      updated_label: m.updated_label,
                    })}
                  </Text>
                </View>
                <View className="flex-row items-center gap-0.5 rounded-full bg-foreground px-3 py-1.5">
                  <Text className="text-xs font-semibold text-background">
                    View
                  </Text>
                  <ChevronRight color={COLORS.background} size={14} />
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <MenuViewer
        open={active != null}
        menu={active}
        onClose={() => setActive(null)}
      />
    </>
  );
}
