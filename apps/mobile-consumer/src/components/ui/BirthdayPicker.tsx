import { ChevronDown } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, Text, View } from 'react-native';

import { COLORS } from '@/constants/brand';

// Friendly birthday picker — three taps (Day / Month / Year) instead of a
// free-text field, so a partial selection sticks and the month never offers a
// bad day. RN port of apps/web-consumer BirthdayPicker: same parse/compose/
// clamp logic and the same "YYYY-MM-DD" contract the EF expects, so it's a
// drop-in wherever a birthday is collected (onboard today, P5 next).
//
// Web uses native <select>s; RN has none, so each part is a Pressable that
// opens the same bottom-sheet Modal + FlatList idiom the sign-in country
// picker uses — no new sheet approach introduced.

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

// Days in a given 1-based month, leap-year aware. Called with the current
// year/month so February and the 30/31-day months never offer a bad day.
function daysInMonth(year: number, month1: number): number {
  if (!year || !month1) return 31;
  return new Date(year, month1, 0).getDate();
}

type Parts = { year: string; month: string; day: string };
type Which = 'day' | 'month' | 'year';

function parse(value: string): Parts {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return { year: '', month: '', day: '' };
  return { year: m[1], month: String(Number(m[2])), day: String(Number(m[3])) };
}

function compose(parts: Parts): string {
  if (!parts.year || !parts.month || !parts.day) return '';
  // Clamp the day if a month/year change shortened the month (e.g. 31 → Feb)
  // so we never emit an impossible date.
  const maxDay = daysInMonth(Number(parts.year), Number(parts.month));
  const day = Math.min(Number(parts.day), maxDay);
  const mm = String(Number(parts.month)).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${parts.year}-${mm}-${dd}`;
}

export function BirthdayPicker({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const [parts, setParts] = useState<Parts>(() => parse(value));
  const [open, setOpen] = useState<Which | null>(null);

  // Re-seed from the prop when it changes to a complete date the local state
  // doesn't already represent (e.g. profile loads async in an edit sheet).
  // Done during render via the "adjust state on prop change" pattern — an
  // effect here would trip react-hooks/set-state-in-effect. Ignored while the
  // user is mid-selection (value "").
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    if (value && compose(parts) !== value) setParts(parse(value));
  }

  function update(next: Parts) {
    // Clamp the stored day when a month/year change shortens the month (e.g.
    // day 31 then February) so the Day trigger visibly reflects the day that
    // actually gets saved, instead of showing a now-invalid value while
    // compose() silently clamps behind it.
    const maxDay = daysInMonth(Number(next.year), Number(next.month));
    const clamped =
      next.day && Number(next.day) > maxDay
        ? { ...next, day: String(maxDay) }
        : next;
    setParts(clamped);
    onChange(compose(clamped));
  }

  // Oldest plausible birth year → 100 years back.
  const years = useMemo(() => {
    const now = new Date().getFullYear();
    return Array.from({ length: 101 }, (_, i) => now - i);
  }, []);

  const dayCount = daysInMonth(Number(parts.year), Number(parts.month));
  const days = useMemo(
    () => Array.from({ length: dayCount }, (_, i) => i + 1),
    [dayCount],
  );

  const monthLabel = parts.month ? (MONTHS[Number(parts.month) - 1] ?? '') : '';

  const options =
    open === 'day'
      ? days.map((d) => ({ value: String(d), label: String(d) }))
      : open === 'month'
        ? MONTHS.map((name, i) => ({ value: String(i + 1), label: name }))
        : open === 'year'
          ? years.map((y) => ({ value: String(y), label: String(y) }))
          : [];

  const selectedValue =
    open === 'day'
      ? parts.day
      : open === 'month'
        ? parts.month
        : open === 'year'
          ? parts.year
          : '';

  function choose(v: string) {
    if (!open) return;
    update({ ...parts, [open]: v });
    setOpen(null);
  }

  return (
    <View
      className={className}
      style={{ flexDirection: 'row', gap: 8 }}
    >
      <Trigger
        placeholder="Day"
        text={parts.day}
        flex={1}
        onPress={() => setOpen('day')}
        a11y="Birth day"
      />
      <Trigger
        placeholder="Month"
        text={monthLabel}
        flex={1.5}
        onPress={() => setOpen('month')}
        a11y="Birth month"
      />
      <Trigger
        placeholder="Year"
        text={parts.year}
        flex={1.1}
        onPress={() => setOpen('year')}
        a11y="Birth year"
      />

      <Modal
        visible={open !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(null)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.4)',
            justifyContent: 'flex-end',
          }}
          onPress={() => setOpen(null)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              maxHeight: '70%',
              backgroundColor: '#ffffff',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingBottom: 24,
            }}
          >
            <Text
              className="font-display font-semibold text-foreground"
              style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 }}
            >
              {open === 'month' ? 'Month' : open === 'year' ? 'Year' : 'Day'}
            </Text>
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              initialNumToRender={24}
              renderItem={({ item }) => {
                const active = item.value === selectedValue;
                return (
                  <Pressable
                    onPress={() => choose(item.value)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={{
                      minHeight: 44,
                      justifyContent: 'center',
                      paddingHorizontal: 20,
                      paddingVertical: 12,
                      backgroundColor: active ? '#ffe4ef' : 'transparent',
                    }}
                  >
                    <Text
                      className={
                        active
                          ? 'font-semibold text-foreground'
                          : 'text-foreground'
                      }
                      style={{ fontSize: 16 }}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function Trigger({
  placeholder,
  text,
  flex,
  onPress,
  a11y,
}: {
  placeholder: string;
  text: string;
  flex: number;
  onPress: () => void;
  a11y: string;
}) {
  const filled = text.length > 0;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={{ flex }}
      className="min-h-[48px] flex-row items-center justify-between rounded-2xl border border-border bg-card px-3.5"
    >
      <Text
        className={filled ? 'text-foreground' : 'text-muted-foreground'}
        style={{ fontSize: 15 }}
        numberOfLines={1}
      >
        {filled ? text : placeholder}
      </Text>
      <ChevronDown color={COLORS.mutedForeground} size={16} />
    </Pressable>
  );
}
