import { Gem, KeyRound, Mail } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Linking, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { FullScreenSheet } from '@/components/ui/FullScreenSheet';
import { CONSUMER_ROUTES } from '@/lib/consumer-route-contract';
import {
  DIAMOND,
  DIAMOND_RATE_HINT,
  DIAMOND_REQUEST_BODY,
  diamondHeadline,
  diamondNote,
} from '@/lib/consumer-identity';
import { useEffectiveFacts } from '@/lib/mock-class';
import { useAuth } from '@/providers/auth';
import { DiamondEmulator } from './DiamondEmulator';

// DIAMOND, AND NOTHING ELSE ON THIS PAGE (Pato, MESITA-2044: "you
// are in the list or you don't, not in between"). Hand-mirrored from web's
// `DiamondModal`.
//
// WHAT THIS REPLACES. `ClassModal` was a rail of four rungs, a "You" card, a
// discount meter and a `WaysToClimb` block with three doors — reach, a
// subscription and an invitation — all climbing the SAME axis. Instagram has
// its own page and grants nothing here, the subscription is Me › Plan, and
// what is left are two sides of one door: ask for an invitation, or redeem one
// you were given.
//
// REQUESTING IS A REAL LINE, NOT A QUEUE (decision, MESITA-2040). "you can
// request invitation" could mean a row in a table and an admin queue; that is
// a table, an Edge Function and an admin surface, none of which exists. What
// ships is the line that already exists and that someone actually reads. A
// button that silently wrote a row nobody triages would be worse than the
// toast the invite door used to fire.

const SUPPORT_EMAIL = 'support@mesita.ai';
const MESITA_INSTAGRAM = '@mesita.ai';

type Props = {
  visible: boolean;
  onClose: () => void;
  asRoute?: boolean;
};

export function DiamondModal({ visible, onClose, asRoute = false }: Props) {
  const router = useRouter();
  const { consumerClass, profile } = useAuth();
  const facts = useEffectiveFacts(
    consumerClass,
    profile?.instagram_handle ?? null,
  );
  const diamond = facts.diamond;

  const requestMail =
    `mailto:${SUPPORT_EMAIL}` +
    `?subject=${encodeURIComponent(`${DIAMOND} request`)}` +
    `&body=${encodeURIComponent(DIAMOND_REQUEST_BODY)}`;

  return (
    <FullScreenSheet
      visible={visible}
      onClose={onClose}
      asRoute={asRoute}
      title={DIAMOND}
      // The "how" line itself sits under the headline for a guest who is
      // not Diamond (`diamondNote`); the subtitle only says the rule.
      subtitle={DIAMOND_RATE_HINT}
    >
      {/* Demo state is declared before the surface it changes. */}
      <DiamondEmulator />

      {/* THE STATUS CARD IS THE WHOLE ANSWER. The rail needed a row per rung
          plus a marked current one; a boolean needs one card that says which
          of two things is true. Filled when the guest holds the invitation,
          outlined when they do not — "the one coloured thing means the
          fact", with one fact left: Diamond or not. */}
      <View
        className={
          diamond
            ? 'flex-row items-center gap-3 rounded-2xl bg-tier-diamond p-4'
            : 'flex-row items-center gap-3 rounded-2xl border border-border bg-card p-4'
        }
      >
        <View
          className={
            diamond
              ? 'h-11 w-11 items-center justify-center rounded-2xl bg-white/20'
              : 'h-11 w-11 items-center justify-center rounded-2xl bg-muted'
          }
        >
          <Gem color={diamond ? '#fff' : '#775254'} size={20} />
        </View>
        <View className="min-w-0 flex-1">
          <Text
            className={
              diamond
                ? 'font-bold tracking-tight text-white'
                : 'font-bold tracking-tight text-foreground'
            }
            style={{ fontSize: 15 }}
          >
            {diamondHeadline(facts)}
          </Text>
          <Text
            className={
              diamond ? 'text-white/85' : 'text-muted-foreground'
            }
            style={{ fontSize: 12, marginTop: 4 }}
          >
            {diamondNote(facts)}
          </Text>
        </View>
      </View>

      {/* TWO DOORS, AND BOTH ARE THE SAME DOOR FROM DIFFERENT SIDES: ask
          Mesita, or redeem what Mesita already handed someone. They never gate
          on whether the guest is Diamond — hiding them would make the
          page blank for the people it is written for. */}
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Button onPress={() => void Linking.openURL(requestMail)}>
            <View className="flex-row items-center gap-1.5">
              <Mail color="#fff" size={16} />
              <Text className="font-semibold text-primary-foreground">
                Ask to join
              </Text>
            </View>
          </Button>
        </View>
        <View className="flex-1">
          {/* The KEY is the invitation door's glyph everywhere (Pato,
              2026-08-22) — lucide's Ticket collides with THE TICKET. */}
          <Button
            variant="outline"
            onPress={() => router.push(CONSUMER_ROUTES.mePages.diamondInvite)}
          >
            <View className="flex-row items-center gap-1.5">
              <KeyRound color="#260409" size={16} />
              <Text className="font-semibold text-foreground">
                I have a PIN
              </Text>
            </View>
          </Button>
        </View>
      </View>

      <Text
        className="text-center text-muted-foreground"
        style={{ fontSize: 12 }}
      >
        Invitations come from Mesita and its partners. You can also ask us on
        Instagram at {MESITA_INSTAGRAM}.
      </Text>
    </FullScreenSheet>
  );
}
