import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import {
  ExternalLink,
  FileText,
  Minus,
  Plus,
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
  type MenuKind,
} from '@/lib/menu-url';

type MenuViewerItem = {
  name: string;
  url: string;
  kind: MenuKind;
};

const MIN_ZOOM = 0.75;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.25;

/** Full-screen menu viewer — web MenuViewer peer (zoom ± for images). */
export function MenuViewer({
  open,
  onClose,
  menu,
}: {
  open: boolean;
  onClose: () => void;
  menu: MenuViewerItem | null;
}) {
  if (!menu || !open) return null;
  return <MenuViewerBody key={menu.url} menu={menu} onClose={onClose} />;
}

function MenuViewerBody({
  menu,
  onClose,
}: {
  menu: MenuViewerItem;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(true);
  const kindLabel = menuKindLabel(menu.kind);

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
            {menu.kind === 'image' ? (
              <Utensils color="#d97706" size={16} />
            ) : (
              <FileText color="#d97706" size={16} />
            )}
          </View>
          <View className="min-w-0 flex-1">
            <Text
              className="font-display text-[15px] font-semibold text-foreground"
              numberOfLines={1}
            >
              {menu.name}
            </Text>
            <Text className="text-[11px] text-muted-foreground">
              {kindLabel}
              {menu.kind === 'drive' ? ' · reference preview' : null}
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
              contentContainerClassName="min-h-full items-center justify-center p-4"
              showsVerticalScrollIndicator={false}
              maximumZoomScale={1}
              minimumZoomScale={1}
            >
              <Image
                source={{ uri: menu.url }}
                style={{
                  width: `${Math.round(zoom * 100)}%`,
                  minHeight: 420,
                  borderRadius: 12,
                  alignSelf: 'center',
                }}
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
            <View className="absolute inset-0 items-center justify-center gap-2">
              <ActivityIndicator color="#fb2b7b" size="large" />
              <Text className="text-xs font-medium text-muted-foreground">
                Loading menu…
              </Text>
            </View>
          ) : null}
        </View>

        {menu.kind === 'image' ? (
          <View
            className="flex-row items-center justify-center gap-3 border-t border-border px-4 py-2.5"
            style={{ paddingBottom: Math.max(insets.bottom, 12) }}
          >
            <Pressable
              accessibilityLabel="Zoom out"
              disabled={zoom <= MIN_ZOOM}
              onPress={() =>
                setZoom((z) => Math.max(MIN_ZOOM, +(z - ZOOM_STEP).toFixed(2)))
              }
              className="size-9 items-center justify-center rounded-full bg-muted disabled:opacity-40"
            >
              <Minus color="#260409" size={16} />
            </Pressable>
            <Text className="w-12 text-center text-xs font-semibold tabular-nums text-muted-foreground">
              {Math.round(zoom * 100)}%
            </Text>
            <Pressable
              accessibilityLabel="Zoom in"
              disabled={zoom >= MAX_ZOOM}
              onPress={() =>
                setZoom((z) => Math.min(MAX_ZOOM, +(z + ZOOM_STEP).toFixed(2)))
              }
              className="size-9 items-center justify-center rounded-full bg-muted disabled:opacity-40"
            >
              <Plus color="#260409" size={16} />
            </Pressable>
          </View>
        ) : (
          <View
            className="flex-row items-center justify-between border-t border-border px-4 py-2.5"
            style={{ paddingBottom: Math.max(insets.bottom, 12) }}
          >
            <Text className="flex-1 text-[11px] leading-snug text-muted-foreground">
              Prices may differ at the place.
            </Text>
            <Pressable
              onPress={() => void openExternal()}
              className="ml-3 flex-row items-center gap-1"
            >
              <Text className="text-xs font-semibold text-primary">
                Open full
              </Text>
              <ExternalLink color="#fb2b7b" size={12} />
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}
