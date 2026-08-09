import { useRouter } from 'expo-router';
import { CalendarPlus, MapPin, Phone, XCircle } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { apiCancelReservation } from '@/lib/api/reservations';
import { placePath } from '@/lib/consumer-route-contract';
import { toast } from '@/lib/toast';
import { errMsg } from '@/lib/utils';

export function ReservationActions({
  reservationId,
  projectId,
  cancelled,
  onChanged,
}: {
  reservationId: string;
  projectId: string;
  cancelled: boolean;
  onChanged?: () => void;
}) {
  const router = useRouter();
  const [cancelBusy, setCancelBusy] = useState(false);

  async function submitCancel() {
    if (cancelBusy) return;
    setCancelBusy(true);
    try {
      await apiCancelReservation({ reservationId });
      toast.success('Reservation cancelled.');
      onChanged?.();
    } catch (e) {
      toast.error(errMsg(e, "Couldn't cancel the reservation."));
    } finally {
      setCancelBusy(false);
    }
  }

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
            onPress={() => void submitCancel()}
            disabled={cancelBusy}
            accessibilityRole="button"
            accessibilityLabel="Cancel reservation"
            className="flex-row items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 active:bg-muted disabled:opacity-60"
          >
            {cancelBusy ? (
              <ActivityIndicator color="#260409" />
            ) : (
              <XCircle color="#260409" size={16} />
            )}
            <Text className="text-sm font-semibold text-foreground/80">
              {cancelBusy ? 'Cancelling…' : 'Cancel reservation'}
            </Text>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}
