import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import {
  ChevronRight,
  ExternalLink,
  FileText,
  Info,
  Utensils,
  X,
} from 'lucide-react-native';
import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  drivePreviewUrl,
  menuKindLabel,
  menuSubtitle,
} from '@/lib/menu-url';
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

      {active ? (
        <MenuViewerModal
          key={active.url}
          menu={active}
          onClose={() => setActive(null)}
        />
      ) : null}
    </>
  );
}

function MenuViewerModal({
  menu,
  onClose,
}: {
  menu: PlaceMenuItem;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);

  const openExternal = async () => {
    const target =
      menu.kind === 'drive' ? drivePreviewUrl(menu.url) ?? menu.url : menu.url;
    await WebBrowser.openBrowserAsync(target);
  };

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View
        className="flex-1 bg-background"
        style={{ paddingTop: Math.max(insets.top, 8) }}
      >
        <View className="flex-row items-center gap-2 border-b border-border px-4 py-3">
          <View className="size-9 items-center justify-center rounded-full bg-amber-50">
            <FileText color="#d97706" size={16} />
          </View>
          <View className="min-w-0 flex-1">
            <Text
              className="font-display text-[15px] font-semibold text-foreground"
              numberOfLines={1}
            >
              {menu.name}
            </Text>
            <Text className="text-[11px] text-muted-foreground">
              {menuKindLabel(menu.kind)}
            </Text>
          </View>
          <Pressable
            onPress={() => void openExternal()}
            accessibilityLabel="Open externally"
            className="size-9 items-center justify-center rounded-full bg-muted"
          >
            <ExternalLink color="#260409" size={16} />
          </Pressable>
          <Pressable
            onPress={onClose}
            accessibilityLabel="Close"
            className="size-9 items-center justify-center rounded-full bg-muted"
          >
            <X color="#260409" size={16} />
          </Pressable>
        </View>

        <View className="relative min-h-0 flex-1 bg-muted/40">
          {menu.kind === 'image' ? (
            <ScrollView
              maximumZoomScale={3}
              minimumZoomScale={1}
              contentContainerClassName="min-h-full items-center justify-center p-4"
              showsVerticalScrollIndicator={false}
            >
              <Image
                source={{ uri: menu.url }}
                style={{ width: '100%', minHeight: 420, borderRadius: 12 }}
                contentFit="contain"
                onLoad={() => setLoading(false)}
                onError={() => setLoading(false)}
              />
            </ScrollView>
          ) : (
            <View className="flex-1 items-center justify-center gap-4 px-8">
              <View className="size-14 items-center justify-center rounded-2xl bg-amber-50">
                <FileText color="#d97706" size={24} />
              </View>
              <Text className="text-center font-display text-lg font-semibold text-foreground">
                {menu.name}
              </Text>
              <Text className="text-center text-sm leading-relaxed text-muted-foreground">
                {menu.kind === 'drive'
                  ? 'Open the Google Drive preview in a secure browser sheet.'
                  : 'Open the PDF in a secure browser sheet for the best reading experience.'}
              </Text>
              <Pressable
                onPress={() => void openExternal()}
                className="mt-2 flex-row items-center gap-2 rounded-full bg-foreground px-5 py-3 active:opacity-90"
              >
                <Text className="text-sm font-semibold text-background">
                  Open menu
                </Text>
                <ExternalLink color="#fffaf8" size={16} />
              </Pressable>
            </View>
          )}

          {loading && menu.kind === 'image' ? (
            <View className="absolute inset-0 items-center justify-center">
              <ActivityIndicator color="#fb2b7b" size="large" />
            </View>
          ) : null}
        </View>

        <View
          className="flex-row items-center justify-between border-t border-border px-4 py-3"
          style={{ paddingBottom: Math.max(insets.bottom, 12) }}
        >
          <Text className="flex-1 text-[11px] leading-snug text-muted-foreground">
            Prices may differ at the place.
          </Text>
          <Pressable
            onPress={() => void openExternal()}
            className="ml-3 flex-row items-center gap-1"
          >
            <Text className="text-xs font-semibold text-primary">Open full</Text>
            <ExternalLink color="#fb2b7b" size={12} />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
