import {
  Calendar,
  CheckCircle2,
  Clock,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';

import { ReservationActions } from '@/components/reservations/reservation-actions';
import { MetaRow } from '@/components/reservations/reservation-detail-ui';
import { Button } from '@/components/ui/Button';
import { COLORS } from '@/constants/brand';
import { apiConfirmReservation } from '@/lib/api/reservations';
import type {
  ReservationItem,
  ReservationState,
} from '@/lib/mock/reservations-mock';
import { guestNoun } from '@/lib/utils';

const STATE_META: Record<
  ReservationState,
  {
    label: string;
    pillClass: string;
    textClass: string;
    Icon: LucideIcon;
    iconColor: string;
    banner: string | null;
  }
> = {
  booking: {
    label: 'Booking',
    // WAITING ON THE PLACE — amber said "in flight" and greyscales into the
    // other two. A dashed ink outline says it instead: the only dashed edge on
    // the screen, repeated on the banner below, and shape survives a repaint.
    pillClass: 'border-dashed border-foreground bg-card',
    textClass: 'text-foreground',
    Icon: Clock,
    iconColor: COLORS.foreground,
    banner:
      "We're booking this for you — you'll get a confirmation as soon as the place replies.",
  },
  booked: {
    label: 'Booked',
    // THE AFFIRMATIVE, and on this screen the only one: `banner: null` means no
    // sentence ever says "confirmed", so the green pill was carrying the whole
    // confirmation alone. Filled ink now does — the one solid chip here, same
    // rank the list card gives it (ReservationCard.tsx).
    pillClass: 'border-primary bg-primary',
    textClass: 'text-primary-foreground',
    Icon: CheckCircle2,
    iconColor: COLORS.primaryForeground,
    banner: null,
  },
  cancelled: {
    label: 'Cancelled',
    // SPENT, and already the neutral one — so it stays the quiet one rather
    // than becoming what the other two collapsed into: flat muted fill, dimmed
    // label, plus the line-through title, the dimmed photo and the action rows
    // that ReservationActions withholds entirely.
    pillClass: 'border-border bg-muted',
    textClass: 'text-muted-foreground',
    Icon: X,
    iconColor: COLORS.mutedForeground,
    banner: 'This reservation is cancelled.',
  },
};

export function ReservationDetailBody({
  r,
  onChanged,
}: {
  r: ReservationItem;
  onChanged?: () => void;
}) {
  const meta = STATE_META[r.state];
  const cancelled = r.state === 'cancelled';
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const offers = (r.alternatives ?? []).filter((a) => a.time);
  const showOffers = r.dbState === 'pending' && offers.length > 0;
  const showAck =
    r.dbState === 'confirmed' &&
    !r.guestConfirmedAt &&
    r.guestNotify === 'app';

  async function confirm(args?: { newDate?: string; newTime?: string }) {
    setConfirmBusy(true);
    setConfirmError(null);
    try {
      await apiConfirmReservation({
        reservationId: r.id,
        ...args,
      });
      onChanged?.();
    } catch (e) {
      setConfirmError(e instanceof Error ? e.message : "Couldn't confirm");
    } finally {
      setConfirmBusy(false);
    }
  }

  return (
    <View className="gap-4 px-4 pb-8 pt-4">
      <View className="overflow-hidden rounded-2xl border border-border bg-card">
        <View className="aspect-[16/9] w-full bg-muted">
          {r.placePhoto ? (
            <Image
              source={{ uri: r.placePhoto }}
              className="h-full w-full"
              style={cancelled ? { opacity: 0.8 } : undefined}
              accessibilityLabel={r.placeName}
            />
          ) : null}
        </View>
        <View className="flex-row items-start justify-between gap-2 px-4 py-3">
          <Text
            className={`min-w-0 flex-1 font-display text-xl font-semibold leading-tight tracking-tight text-foreground ${
              cancelled ? 'line-through' : ''
            }`}
          >
            {r.placeName}
          </Text>
          <View
            className={`shrink-0 flex-row items-center gap-1 rounded-md border px-2.5 py-0.5 ${meta.pillClass}`}
          >
            <meta.Icon color={meta.iconColor} size={12} strokeWidth={2.25} />
            <Text className={`text-[11px] font-semibold ${meta.textClass}`}>
              {meta.label}
            </Text>
          </View>
        </View>
      </View>

      {meta.banner || r.stateNote ? (
        // ONE BOX, TWO OPPOSITE MEANINGS: "we're still calling the place" and
        // "this is dead" render through the same View. Amber vs muted told them
        // apart; two greys would not, and RN never drew the `ring-*` anyway.
        // So: dashed ink edge + ink text while it's live, hairline + dimmed text
        // once it isn't. `border` sits in the base so the box never resizes, and
        // the hairline is what keeps the inert one a box at all — `muted` and
        // the page behind it are the same value now.
        <View
          className={`rounded-2xl border px-3 py-2.5 ${
            r.state === 'booking'
              ? 'border-dashed border-foreground bg-card'
              : 'border-border bg-muted'
          }`}
        >
          <Text
            className={`text-[12.5px] leading-snug ${
              r.state === 'booking' ? 'text-foreground' : 'text-muted-foreground'
            }`}
          >
            {r.stateNote ?? meta.banner}
          </Text>
        </View>
      ) : null}

      <View className="overflow-hidden rounded-2xl border border-border bg-card">
        <MetaRow Icon={Calendar} label="When" value={r.when} />
        <View className="h-px bg-border/70" />
        <MetaRow
          Icon={Users}
          label="Party"
          value={`${r.partySize} ${guestNoun(r.partySize)}`}
        />
        <View className="h-px bg-border/70" />
        {/* `meta.iconColor` is the colour ON the pill, and `booked`'s pill is
            filled ink with a WHITE glyph — white on this white row would be an
            invisible icon. So the row takes the surface-correct ink, and keeps
            marking itself as the status line (rather than a third fact next to
            When and Party) by holding full ink while they stay muted. */}
        <MetaRow
          Icon={meta.Icon}
          iconColor={cancelled ? COLORS.mutedForeground : COLORS.foreground}
          label="State"
          value={meta.label}
        />
      </View>

      {showOffers ? (
        <View className="gap-2 rounded-2xl border border-border bg-card p-3">
          <Text className="text-[12.5px] font-semibold text-foreground">
            Pick an offered time
          </Text>
          {offers.map((alt) => {
            const label = [alt.date, alt.time, alt.note]
              .filter(Boolean)
              .join(' · ');
            return (
              <Pressable
                key={`${alt.date ?? ''}-${alt.time}-${alt.note ?? ''}`}
                disabled={confirmBusy}
                onPress={() =>
                  confirm({
                    ...(alt.date ? { newDate: alt.date } : {}),
                    newTime: alt.time,
                  })
                }
                className="rounded-xl border border-border px-3 py-2.5"
              >
                <Text className="text-sm font-medium text-foreground">
                  {label}
                </Text>
              </Pressable>
            );
          })}
          {/* RESERVED — danger. It sits under a list of tappable offers that
              are all foreground ink; without red a failure reads as one more
              option. Stock `red-600` moves to the destructive token. */}
          {confirmError ? (
            <Text className="text-[12px] font-medium text-destructive">
              {confirmError}
            </Text>
          ) : null}
        </View>
      ) : null}

      {showAck ? (
        <Button loading={confirmBusy} onPress={() => confirm()}>
          {confirmBusy ? 'Confirming…' : 'Got it — confirm in app'}
        </Button>
      ) : null}

      <ReservationActions
        reservationId={r.id}
        projectId={r.projectId}
        cancelled={cancelled}
        onChanged={onChanged}
      />
    </View>
  );
}
