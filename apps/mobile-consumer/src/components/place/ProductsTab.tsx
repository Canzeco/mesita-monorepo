import {
  ChevronRight,
  Info,
  Utensils,
} from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { MenuViewer } from '@/components/place/MenuViewer';
import { menuSubtitle } from '@/lib/menu-url';
import type { PlaceMenuItem } from '@/lib/types/place-detail';

export function ProductsTab({ menus }: { menus: PlaceMenuItem[] }) {
  const [active, setActive] = useState<PlaceMenuItem | null>(null);

  return (
    <>
      <View className="overflow-hidden rounded-2xl border border-border bg-card p-4">
        <View className="mb-3 flex-row items-center gap-2">
          <View className="size-8 items-center justify-center rounded-full bg-amber-50">
            <Utensils color="#d97706" size={16} />
          </View>
          <Text className="text-[10px] font-bold tracking-[0.18em] text-muted-foreground uppercase">
            Menu
          </Text>
        </View>

        <View className="mb-3 flex-row items-start gap-2 rounded-xl border border-amber-400/40 bg-amber-50 px-3 py-2.5">
          <Info color="#d97706" size={14} style={{ marginTop: 1 }} />
          <Text className="flex-1 text-[11px] leading-snug font-medium text-amber-950">
            Reference only — current product prices may differ at the place.
          </Text>
        </View>

        {menus.length === 0 ? (
          <View className="items-center gap-2 py-4">
            <View className="size-12 items-center justify-center rounded-full bg-muted">
              <Utensils color="#775254" size={20} />
            </View>
            <Text className="font-display text-sm font-semibold text-foreground">
              No menu available yet
            </Text>
            <Text className="px-4 text-center text-xs leading-snug text-muted-foreground">
              This place has not uploaded a menu or product catalog.
            </Text>
          </View>
        ) : (
          <View className="gap-2">
            {menus.map((m) => (
              <Pressable
                key={`${m.name}-${m.url}`}
                onPress={() => setActive(m)}
                className="flex-row items-center gap-3 rounded-xl bg-background p-3 active:opacity-90"
              >
                <View className="size-9 items-center justify-center rounded-full bg-muted">
                  <Utensils color="#260409" size={16} />
                </View>
                <View className="min-w-0 flex-1">
                  <Text
                    className="font-display text-base font-semibold text-foreground"
                    numberOfLines={1}
                  >
                    {m.name}
                  </Text>
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
                  <ChevronRight color="#fffaf8" size={14} />
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
