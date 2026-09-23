import { Bot, Crown, KeyRound } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { ActiveTokensList } from '@/components/me/AiConnectActiveTokensList';
import { FreshTokenCard } from '@/components/me/AiConnectFreshTokenCard';
import { Button } from '@/components/ui/Button';
import { FullScreenSheet } from '@/components/ui/FullScreenSheet';
import { COLORS } from '@/constants/brand';

import {
  apiCreateMcpToken,
  apiListMcpTokens,
  apiRevokeMcpToken,
  type McpTokenMinted,
} from '@/lib/api/mcp-tokens';
import { isElevatedClass } from '@/lib/consumer-classes';
import { useEffectiveClass } from '@/lib/mock-class';
import { errMsg } from '@/lib/utils';
import { useAuth } from '@/providers/auth';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function AiConnectModal({ visible, onClose }: Props) {
  const { consumerClass, profile } = useAuth();
  const { key: classKey } = useEffectiveClass(
    consumerClass,
    profile?.instagram_handle ?? null,
  );
  // AI connect is an elevated perk: the Premium plan or Diamond.
  const canConnect = isElevatedClass(classKey);
  const [minting, setMinting] = useState(false);
  const [fresh, setFresh] = useState<McpTokenMinted | null>(null);

  const tokensQuery = useQuery({
    queryKey: ['mcp-tokens'],
    queryFn: apiListMcpTokens,
    enabled: visible,
  });
  const tokens = (tokensQuery.data ?? []).filter((t) => !t.revoked_at);
  const loading = tokensQuery.isLoading;

  async function mint() {
    if (!canConnect) {
      Alert.alert(
        'Premium required',
        'AI connect is for Mesita Premium — upgrade to create a token.',
      );
      return;
    }
    setMinting(true);
    setFresh(null);
    try {
      const token = await apiCreateMcpToken('AI client');
      setFresh(token);
      await tokensQuery.refetch();
      Alert.alert('Token created', 'Copy it now — Mesita won’t show it again.');
    } catch (e) {
      Alert.alert('Error', errMsg(e, "Couldn't create MCP token."));
    } finally {
      setMinting(false);
    }
  }

  async function revoke(id: string) {
    try {
      await apiRevokeMcpToken(id);
      if (fresh?.id === id) setFresh(null);
      await tokensQuery.refetch();
    } catch (e) {
      Alert.alert('Error', errMsg(e, "Couldn't revoke token."));
    }
  }

  return (
    <FullScreenSheet
      visible={visible}
      onClose={onClose}
      title="AI"
      subtitle="Connect your Mesita profile to an AI"
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 999,
            // A violet wash under a violet glyph: chroma on decoration, not on
            // a platform mark — the Bot is generic lucide, not Claude's or
            // OpenAI's. It keeps its LIGHTNESS: the wash read ~L*93, and the
            // muted token that would match it exactly IS the page this sheet
            // sits on (bg-background), so the disc takes card white to stay a
            // disc at all, and the glyph takes ink.
            backgroundColor: COLORS.card,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Bot color={COLORS.foreground} size={22} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text
              style={{
                fontWeight: '700',
                fontSize: 20,
                color: COLORS.foreground,
              }}
            >
              AI
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                borderWidth: 1,
                borderColor: COLORS.border,
                borderRadius: 999,
                paddingHorizontal: 8,
                paddingVertical: 2,
              }}
            >
              {/* RESERVED (MESITA-1954): the product NAMES the tier out loud
                  one glyph to the right, so the Crown keeps its hue — at
                  tailwind `tier.premium`, which is where web converged. It
                  reads as near-ink at 10px, and that is the point: the pill's
                  border and label are already neutral, so this is the only
                  thing on the pill that is allowed not to be. */}
              <Crown color="#32191b" size={10} />
              <Text
                style={{
                  color: COLORS.mutedForeground,
                  fontWeight: '700',
                  letterSpacing: 1,
                  fontSize: 11,
                }}
              >
                PREMIUM
              </Text>
            </View>
          </View>
        </View>
      </View>

      <Text
        style={{ color: COLORS.mutedForeground, lineHeight: 20, fontSize: 14 }}
      >
        Generate a personal access token, then add Mesita as an MCP server in
        Claude, Cursor, or ChatGPT. Your AI can then find places, save them,
        book tables, and check rewards — as you. Available with Premium or
        Diamond.
      </Text>

      {/* THE GATE, RE-SEPARATED BY SHAPE (MESITA-1954). Amber was the only
          thing saying "you are blocked" here, and the achromatic version of an
          amber-tinted rounded box is a light rounded box — which is exactly
          what FreshTokenCard and ActiveTokensList are, two white cards under
          the same hairline further down this same sheet. Greyed, "you cannot
          do this" would have read as "here is some more information", the
          collapse web shipped three times. So the gate stops being a tinted
          card and becomes an OUTLINE: dashed, in the muted-foreground grey
          rather than the hairline, over no fill of its own — the vocabulary's
          "not here yet / waiting on somebody else". Nothing else on the sheet
          is dashed, and nothing dashed is tappable. The copy then takes full
          ink against the muted body copy above it — a step in tone, not in
          weight: the shape is what carries the state. */}
      {!canConnect ? (
        <View
          style={{
            flexDirection: 'row',
            gap: 12,
            borderRadius: 16,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: COLORS.mutedForeground,
            backgroundColor: COLORS.muted,
            padding: 14,
          }}
        >
          {/* The same tier mark as the eyebrow pill, at the same reserved
              value: the Crown names Premium, the dashed box carries the
              state. A hue on the glyph would be naming the tier; a hue on the
              box would be colouring a state. */}
          <Crown color="#32191b" size={16} style={{ marginTop: 2 }} />
          <Text
            style={{
              flex: 1,
              color: COLORS.foreground,
              lineHeight: 18,
              fontSize: 13,
            }}
          >
            You’re on the Free plan and not Diamond. Premium — or Diamond —
            lets you create an MCP token and let an AI control your profile.
          </Text>
        </View>
      ) : null}

      <Button
        onPress={() => void mint()}
        disabled={minting || !canConnect}
        loading={minting}
        accessibilityLabel="Create MCP token"
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <KeyRound color={COLORS.primaryForeground} size={18} />
          <Text
            style={{
              color: COLORS.primaryForeground,
              fontWeight: '600',
              fontSize: 14,
            }}
          >
            {canConnect ? 'Create MCP token' : 'Premium required'}
          </Text>
        </View>
      </Button>

      {fresh ? <FreshTokenCard fresh={fresh} /> : null}

      <Text
        style={{
          // Same alpha, so the eyebrow keeps the exact lightness it had.
          color: 'rgba(23,23,23,0.55)',
          letterSpacing: 1.6,
          textTransform: 'uppercase',
          fontWeight: '700',
          fontSize: 11,
        }}
      >
        Active tokens
      </Text>
      <ActiveTokensList
        loading={loading}
        tokens={tokens}
        onRevoke={(id) => void revoke(id)}
      />

      <Text
        style={{ color: COLORS.mutedForeground, lineHeight: 16, fontSize: 12 }}
      >
        Tools: get profile, suggest/get places, save places, list/create
        reservations, list rewards. Revoke anytime if a client is compromised.
      </Text>
    </FullScreenSheet>
  );
}
