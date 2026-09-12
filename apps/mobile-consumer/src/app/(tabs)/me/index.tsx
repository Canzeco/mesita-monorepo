import {
  Bell,
  CalendarCheck,
  CircleHelp,
  Bot,
  Footprints,
  Gift,
  IdCard,
  AtSign,
  Medal,
  Settings as SettingsIcon,
  Share2,
  ShoppingBag,
  UserRound,
  Users,
  Wallet as WalletIcon,
  Crown,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  IdentityHero,
  IdentityHeroSkeleton,
} from '@/components/me/IdentityHero';
import { DestGrid, DestTile } from '@/components/me/dest-tile';
import { MockControls } from '@/components/me/MockControls';
import { ShellWash } from '@/components/ui/HeroBackdrop';
import { TAB_SCROLL_PADDING_BOTTOM } from '@/lib/tab-layout';
import { apiFetchConsumerMetrics } from '@/lib/api/auth';
import { CONSUMER_ROUTES } from '@/lib/consumer-route-contract';
import { CLASSES } from '@/lib/consumer-classes';
import { useEffectiveClass } from '@/lib/mock-class';
import {
  ageFromBirthday,
  formatPhoneDisplay,
  formatSex,
} from '@/lib/utils';
import { useAuth } from '@/providers/auth';

// Me hub — DestTiles navigate to /me/<box> (MESITA-1789). Same eight pairs
// as web. Parked cells stay Soon. No Stripe checkout (Apple review).

export default function MeHub() {
  const { profile, consumerClass, stats } = useAuth();
  const effective = useEffectiveClass(
    consumerClass,
    profile?.instagram_handle ?? null,
  );
  const [savedCents, setSavedCents] = useState<number | null>(null);
  const [visits, setVisits] = useState<number | null>(null);

  const name =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') ||
    profile?.full_name ||
    'Mesita member';
  const age = ageFromBirthday(profile?.birthday);
  const sexLabel = formatSex(profile?.sex);

  const classLabel =
    CLASSES.find((c) => c.id === effective.key)?.label ?? 'Bronze';
  const handle = effective.handle ?? profile?.instagram_handle ?? null;
  const igConnected = effective.origin === 'instagram' || Boolean(handle);
  const igSummary = igConnected
    ? handle
      ? `@${handle}`
      : 'Connected'
    : 'Connect it';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const metrics = await apiFetchConsumerMetrics();
        if (cancelled) return;
        setSavedCents(metrics.saved_cents);
        setVisits(metrics.places_visited);
      } catch {
        if (!cancelled) setVisits(stats?.visits ?? null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [stats?.visits, profile?.id]);

  const pages = CONSUMER_ROUTES.mePages;

  return (
    <ShellWash>
      <SafeAreaView className="flex-1" edges={['top']}>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            padding: 16,
            paddingBottom: TAB_SCROLL_PADDING_BOTTOM,
            gap: 12,
          }}
          showsVerticalScrollIndicator={false}
        >
          {!profile ? (
            <IdentityHeroSkeleton />
          ) : (
            <IdentityHero
              classKey={effective.key}
              name={name}
              sexLabel={sexLabel}
              age={age}
              phone={formatPhoneDisplay(profile?.phone)}
              phoneRaw={profile?.phone}
              avatarUrl={profile?.avatar_url}
              igConnected={igConnected}
              handle={handle}
              followers={effective.followers}
              classLabel={classLabel}
              savedCents={savedCents}
              visits={visits ?? stats?.visits ?? null}
            />
          )}

          <MockControls />

          <DestGrid>
            <DestTile
              Icon={UserRound}
              title="Profile"
              summary="Name, photo, birthday"
              href={pages.profile}
            />
            <DestTile
              Icon={IdCard}
              title="Passport"
              summary="Your member number"
              href={pages.passport}
            />
          </DestGrid>
          <DestGrid>
            <DestTile
              Icon={AtSign}
              title="Instagram"
              summary={igSummary}
              href={pages.instagram}
            />
            <DestTile
              Icon={Medal}
              title="Class"
              summary={classLabel}
              href={pages.class}
            />
          </DestGrid>
          <DestGrid>
            <DestTile
              Icon={WalletIcon}
              title="Wallet"
              summary="Credits and cards"
              href={CONSUMER_ROUTES.rewards.root}
            />
            <DestTile
              Icon={Crown}
              title="Plan"
              summary="Free or Premium"
              href={pages.plan}
            />
          </DestGrid>
          <DestGrid>
            <DestTile
              Icon={Bell}
              title="Notifications"
              summary="Visits and bookings"
              href={pages.notifications}
            />
            <DestTile
              Icon={Footprints}
              title="Visits"
              summary="Tickets and QRs"
              href={pages.visits}
            />
          </DestGrid>
          <DestGrid>
            <DestTile Icon={ShoppingBag} title="Orders" summary="" soon />
            <DestTile
              Icon={CalendarCheck}
              title="Reservations"
              summary="Upcoming and past"
              href={pages.reservations}
            />
          </DestGrid>
          <DestGrid>
            <DestTile Icon={Share2} title="Share" summary="" soon />
            <DestTile Icon={Gift} title="Gift" summary="" soon />
          </DestGrid>
          <DestGrid>
            <DestTile
              Icon={SettingsIcon}
              title="Settings"
              summary="Privacy, language"
              href={pages.settings}
            />
            <DestTile
              Icon={CircleHelp}
              title="Help"
              summary="How rewards work"
              href={pages.help}
            />
          </DestGrid>
          <DestGrid>
            <DestTile Icon={Bot} title="Integrations" summary="" soon />
            <DestTile Icon={Users} title="Friends" summary="" soon />
          </DestGrid>
        </ScrollView>
      </SafeAreaView>
    </ShellWash>
  );
}
