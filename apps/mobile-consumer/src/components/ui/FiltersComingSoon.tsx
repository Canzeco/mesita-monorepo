import { SlidersHorizontal, X } from 'lucide-react-native';
import { Modal, Pressable, Text, View } from 'react-native';

// Shared "filters are coming soon" panel — port of web FiltersComingSoon.
// Home Swipe Filter + Search Filters both park behind this.

export function FiltersComingSoonSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 justify-end bg-black/40"
        onPress={onClose}
      >
        <Pressable
          className="rounded-t-3xl border-t border-border bg-card"
          onPress={(e) => e.stopPropagation()}
        >
          <View className="flex-row items-center justify-between px-4 pt-3 pb-3">
            <View className="flex-row items-center gap-2">
              <View className="size-9 items-center justify-center rounded-xl bg-primary/10">
                <SlidersHorizontal color="#fb2b7b" size={16} />
              </View>
              <View className="flex-row items-center gap-2">
                <Text className="font-display text-base font-semibold text-foreground">
                  Filters
                </Text>
                <View className="rounded-full border border-border px-1.5 py-0.5">
                  <Text
                    className="font-semibold uppercase text-muted-foreground"
                    style={{ fontSize: 9, letterSpacing: 1.2 }}
                  >
                    Soon
                  </Text>
                </View>
              </View>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityLabel="Close"
              className="size-8 items-center justify-center rounded-full active:bg-muted"
            >
              <X color="#775254" size={16} />
            </Pressable>
          </View>

          <View className="items-center px-8 py-14">
            <View className="size-14 items-center justify-center rounded-2xl bg-muted">
              <SlidersHorizontal color="#775254" size={24} />
            </View>
            <Text className="mt-4 text-base font-semibold text-foreground">
              Filters are coming soon
            </Text>
            <Text className="mt-1.5 max-w-[280px] text-center text-sm leading-relaxed text-muted-foreground">
              {"We're polishing how you narrow places down. For now, browse the full list — smart filters land shortly."}
            </Text>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
