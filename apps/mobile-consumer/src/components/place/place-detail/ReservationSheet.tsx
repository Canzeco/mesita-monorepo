import { CalendarCheck, PhoneCall } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { FullScreenSheet } from '@/components/ui/FullScreenSheet';
import { TextField } from '@/components/ui/TextField';
import { apiCreateReservation } from '@/lib/api/reservations';
import type { PlaceDetail } from '@/lib/types/place-detail';
import { errMsg, guestNoun } from '@/lib/utils';

const DATE_WINDOW = 14; // two weeks of pills
const DEFAULT_TIME = '20:00';
const DEFAULT_PARTY = 2;
// Mexico City is UTC-6 year-round (no DST since 2022). The picked slot is the
// venue's wall-clock; stamping the offset lets the agent read it back in
// America/Mexico_City and match what the guest chose.
const MX_OFFSET = '-06:00';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TIME_SLOTS = [
  '13:00', '13:30', '14:00', '14:30', '18:00', '18:30', '19:00',
  '19:30', '20:00', '20:30', '21:00', '21:30', '22:00',
];

type DateOption = { iso: string; weekday: string; day: number };

function buildDateOptions(count: number): DateOption[] {
  const out: DateOption[] = [];
  const base = new Date();
  for (let i = 0; i < count; i += 1) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate(),
    ).padStart(2, '0')}`;
    const weekday = i === 0 ? 'Today' : i === 1 ? 'Tom.' : WEEKDAYS[d.getDay()];
    out.push({ iso, weekday, day: d.getDate() });
  }
  return out;
}

function timeLabel(hhmm: string): string {
  const [h, m] = hhmm.split(':').map((n) => Number(n));
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

export function ReservationSheet({
  place,
  visible,
  onClose,
}: {
  place: PlaceDetail;
  visible: boolean;
  onClose: () => void;
}) {
  const dateOptions = useMemo(() => buildDateOptions(DATE_WINDOW), []);
  const [date, setDate] = useState(dateOptions[0]?.iso ?? '');
  const [time, setTime] = useState(DEFAULT_TIME);
  const [party, setParty] = useState(DEFAULT_PARTY);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const chosen = dateOptions.find((d) => d.iso === date);
  const whenLabel = chosen
    ? `${chosen.weekday === 'Today' || chosen.weekday === 'Tom.' ? chosen.weekday : `${chosen.weekday} ${chosen.day}`} · ${timeLabel(time)}`
    : timeLabel(time);

  function handleClose() {
    onClose();
    // Reset transient state so a re-open starts clean; keep the picked slot.
    setDone(false);
    setError(null);
    setSubmitting(false);
  }

  async function submit() {
    if (!date || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiCreateReservation({
        projectId: place.id,
        reservedAt: `${date}T${time}:00${MX_OFFSET}`,
        partySize: party,
        notes,
      });
      setDone(true);
    } catch (e) {
      setError(errMsg(e, "Couldn't request the reservation."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FullScreenSheet
      visible={visible}
      onClose={handleClose}
      title={done ? 'Reservation requested' : 'Reserve a table'}
      subtitle={done ? undefined : `${place.name} · Mesita calls the place for you`}
    >
      {done ? (
        <View className="items-center py-4">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <PhoneCall color="#ec006c" size={26} />
          </View>
          <Text className="mt-4 font-display text-xl font-semibold text-foreground">
            Reservation requested
          </Text>
          <Text className="mt-2 max-w-xs text-center text-[13px] leading-relaxed text-muted-foreground">
            Mesita is calling{' '}
            <Text className="font-medium text-foreground">{place.name}</Text> to
            book your table for {party} {guestNoun(party)} on {whenLabel}. We&apos;ll
            update this reservation once the place confirms.
          </Text>
          <View className="mt-6 w-full">
            <Button onPress={handleClose}>Done</Button>
          </View>
        </View>
      ) : (
        <>
          {/* Date pills */}
          <View>
            <Text className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Date
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingRight: 8 }}
            >
              {dateOptions.map((d) => {
                const active = d.iso === date;
                return (
                  <Pressable
                    key={d.iso}
                    onPress={() => setDate(d.iso)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    className={`h-16 w-14 items-center justify-center rounded-2xl border ${
                      active
                        ? 'border-primary bg-primary'
                        : 'border-border bg-card'
                    }`}
                  >
                    <Text
                      className={`text-[11px] font-semibold ${active ? 'text-primary-foreground' : 'text-muted-foreground'}`}
                    >
                      {d.weekday}
                    </Text>
                    <Text
                      className={`text-[17px] font-bold ${active ? 'text-primary-foreground' : 'text-foreground'}`}
                    >
                      {d.day}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Time slots */}
          <View>
            <Text className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Time
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {TIME_SLOTS.map((slot) => {
                const active = slot === time;
                return (
                  <Pressable
                    key={slot}
                    onPress={() => setTime(slot)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    className={`rounded-xl border px-3 py-2 ${
                      active
                        ? 'border-primary bg-primary'
                        : 'border-border bg-card'
                    }`}
                  >
                    <Text
                      className={`text-[13px] font-semibold ${active ? 'text-primary-foreground' : 'text-foreground'}`}
                    >
                      {timeLabel(slot)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Party stepper */}
          <View>
            <Text className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Party size
            </Text>
            <View className="flex-row items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
              <Text className="text-[15px] font-semibold text-foreground">
                {party} {guestNoun(party)}
              </Text>
              <View className="flex-row items-center gap-3">
                <Stepper
                  label="Decrease party size"
                  symbol="−"
                  disabled={party <= 1}
                  onPress={() => setParty((p) => Math.max(1, p - 1))}
                />
                <Stepper
                  label="Increase party size"
                  symbol="+"
                  disabled={party >= 20}
                  onPress={() => setParty((p) => Math.min(20, p + 1))}
                />
              </View>
            </View>
          </View>

          {/* Notes */}
          <TextField
            label="Notes for the place (optional)"
            value={notes}
            onChangeText={setNotes}
            placeholder="Birthday, terrace seating, high chair…"
            multiline
            numberOfLines={2}
            maxLength={280}
          />

          {error ? (
            <View className="rounded-xl bg-red-500/10 px-3 py-2">
              <Text className="text-[13px] font-medium text-red-600">
                {error}
              </Text>
            </View>
          ) : null}

          <Button onPress={submit} loading={submitting} disabled={!date}>
            {submitting ? 'Requesting…' : `Request · ${whenLabel}`}
          </Button>
          <Text className="text-center text-[11px] text-muted-foreground">
            Mesita&apos;s AI agent calls the place to book — you&apos;ll be notified.
          </Text>
        </>
      )}
    </FullScreenSheet>
  );
}

function Stepper({
  label,
  symbol,
  onPress,
  disabled,
}: {
  label: string;
  symbol: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={`h-9 w-9 items-center justify-center rounded-full border border-border ${
        disabled ? 'opacity-40' : 'bg-card active:bg-muted'
      }`}
    >
      <Text className="text-[18px] font-semibold text-foreground">{symbol}</Text>
    </Pressable>
  );
}
