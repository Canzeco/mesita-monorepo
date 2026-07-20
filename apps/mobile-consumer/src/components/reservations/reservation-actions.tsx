import { useRouter } from 'expo-router';
import { CalendarPlus, MapPin, Phone } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { placePath } from '@/lib/consumer-route-contract';
import { toast } from '@/lib/toast';

export function ReservationActions({
  projectId,
  cancelled,
}: {
  projectId: string;
  cancelled: boolean;
}) {
  const router = useRouter();

  return (
    <View className="gap-2">
      <Pressable
        onPress={() => router.push(placePath(projectId))}
        accessibilityRole="button"
        accessibilityLabel="View place"
        className="flex-row items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 active:bg-muted"
      >
        <View className="flex-row items-center gap-3">
          <View className="h-9 w-9 items-center justify-center rounded-full bg-muted">
            <MapPin color="#260409" size={16} />
          </View>
          <Text className="text-sm font-semibold text-foreground">
            View place
          </Text>
        </View>
        <Text className="text-[12px] text-muted-foreground">
          Details, map, menu
        </Text>
      </Pressable>

      {!cancelled ? (
        <>
          <Pressable
            onPress={() =>
              toast.action(
                'Calendar export lands with the booking integration.',
                { label: 'Notify me', onClick: () => {} },
              )
            }
            accessibilityRole="button"
            accessibilityLabel="Add to calendar"
            className="flex-row items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 active:bg-muted"
          >
            <View className="flex-row items-center gap-3">
              <View className="h-9 w-9 items-center justify-center rounded-full bg-muted">
                <CalendarPlus color="#260409" size={16} />
              </View>
              <Text className="text-sm font-semibold text-foreground">
                Add to calendar
              </Text>
            </View>
            <Text className="text-[12px] text-muted-foreground">
              Google, Apple, Outlook
            </Text>
          </Pressable>

          <Pressable
            onPress={() =>
              toast.action(
                'Calling the place from inside the app lands soon.',
                { label: 'Notify me', onClick: () => {} },
              )
            }
            accessibilityRole="button"
            accessibilityLabel="Call place"
            className="flex-row items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 active:bg-muted"
          >
            <View className="flex-row items-center gap-3">
              <View className="h-9 w-9 items-center justify-center rounded-full bg-muted">
                <Phone color="#260409" size={16} />
              </View>
              <Text className="text-sm font-semibold text-foreground">
                Call place
              </Text>
            </View>
            <Text className="text-[12px] text-muted-foreground">
              If plans change
            </Text>
          </Pressable>

          <Pressable
            onPress={() =>
              toast.action(
                'Cancellation lands with the booking integration. Email support@mesita.ai meanwhile.',
                { label: 'Copy email', onClick: () => {} },
              )
            }
            accessibilityRole="button"
            accessibilityLabel="Cancel reservation"
            className="items-center justify-center rounded-2xl border border-border bg-card px-4 py-3 active:bg-muted"
          >
            <Text className="text-sm font-semibold text-foreground/80">
              Cancel reservation
            </Text>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}
