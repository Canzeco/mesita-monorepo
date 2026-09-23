import {
  Bell,
  CalendarCheck,
  CircleHelp,
  Bot,
  Footprints,
  Gift,
  Settings as SettingsIcon,
  Share2,
  ShoppingBag,
  UserRound,
  Users,
  Wallet as WalletIcon,
  Crown,
  Gem,
  AtSign,
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
import {
  DIAMOND,
  diamondChipA11y,
  diamondChipLabel,
  diamondSummary,
  identityHeaderA11y,
  instagramSummary,
} from '@/lib/consumer-identity';
import { useEffectiveFacts } from '@/lib/mock-class';
import {
  ageFromBirthday,
  formatPhoneDisplay,
  formatSex,
} from '@/lib/utils';
import { useAuth } from '@/providers/auth';

// Me hub — DestTiles navigate to /me/<box> (MESITA-1789). Same grid as web:
// Profile full-width, then seven pairs. Parked cells stay Soon. No Stripe
// checkout (Apple review).
//
// THERE IS NO PASSPORT (Pato, MESITA-2043: "we don't have passports. its only
// instagram and diamond"). The cell and /me/passport are deleted; the member
// number it printed now leads Profile's summary and lives on the Profile page.
//
// INSTAGRAM AND DIAMOND ARE CELLS (Pato, MESITA-2040: "so add
// instagram and then diamond"; renamed Diamond in MESITA-2044). Read the history before assuming this is a revert: the pair
// was cells (MESITA-1650), then header only (MESITA-1652), then cells again
// (MESITA-1682), then rows on a since-deleted page (MESITA-1787) — and every round was about
// where ONE AXIS lives, with "the hero already says the rung" as the argument
// against a cell. There is no rung. These are two unrelated destinations, and
// the ORDER is load-bearing: Instagram first, here and on the hero.

export default function MeHub() {
  const { profile, consumerClass, stats } = useAuth();
  const facts = useEffectiveFacts(
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

  // The auth provider seeds the class row and the profile separately, so the
  // handle can arrive from either. The facts win when they have one; the
  // profile row covers the cold load.
  const igFacts = facts.igHandle
    ? facts
    : {
        ...facts,
        igHandle: profile?.instagram_handle ?? null,
        igConnected: facts.igConnected || Boolean(profile?.instagram_handle),
      };
  const igLabel = instagramSummary(igFacts);
  // The tile and the header chip say different things on purpose: the tile
  // is titled "Diamond" already, the chip is a gem and a word.
  const diamondTileSummary = diamondSummary(facts);

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
              name={name}
              sexLabel={sexLabel}
              age={age}
              phone={formatPhoneDisplay(profile?.phone)}
              phoneRaw={profile?.phone}
              avatarUrl={profile?.avatar_url}
              igConnected={igFacts.igConnected}
              handle={igFacts.igHandle}
              followers={igFacts.igFollowers}
              diamond={facts.diamond}
              diamondLabel={diamondChipLabel(facts)}
              diamondA11y={diamondChipA11y(facts)}
              identityA11y={identityHeaderA11y(facts)}
              savedCents={savedCents}
              visits={visits ?? stats?.visits ?? null}
            />
          )}

          <MockControls />

          <DestGrid>
            <DestTile
              Icon={UserRound}
              title="Profile"
              summary={
                !profile
                  ? 'Name, photo, birthday'
                  : profile.code
                    ? `Member ${profile.code}`
                    : 'Member pending'
              }
              href={pages.profile}
            />
          </DestGrid>
          <DestGrid>
            {/* `AtSign`, not `Instagram`: lucide-react-native does not ship
                the brand glyph web uses, and `DestTile` takes a LucideIcon.
                It is the same stand-in MockControls and VerifySocialSheet
                already use for this platform. */}
            <DestTile
              Icon={AtSign}
              title="Instagram"
              summary={igLabel}
              href={pages.instagram}
            />
            <DestTile
              Icon={Gem}
              title={DIAMOND}
              summary={diamondTileSummary}
              href={pages.diamond}
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
