import { Bot, Crown, KeyRound } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { ActiveTokensList } from '@/components/me/AiConnectActiveTokensList';
import { FreshTokenCard } from '@/components/me/AiConnectFreshTokenCard';
import { Button } from '@/components/ui/Button';
import { FullScreenSheet } from '@/components/ui/FullScreenSheet';

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
  // AI connect is an elevated-class perk — every class above Standard.
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
            backgroundColor: 'rgba(124,58,237,0.1)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Bot color="#7c3aed" size={22} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontWeight: '700', fontSize: 20, color: '#260409' }}>
              AI
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                borderWidth: 1,
                borderColor: '#ebd9db',
                borderRadius: 999,
                paddingHorizontal: 8,
                paddingVertical: 2,
              }}
            >
              <Crown color="#d97706" size={10} />
              <Text
                style={{
                  color: '#775254',
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

      <Text style={{ color: '#775254', lineHeight: 20, fontSize: 14 }}>
        Generate a personal access token, then add Mesita as an MCP server in
        Claude, Cursor, or ChatGPT. Your AI can then find places, save them,
        book tables, and check rewards — as you. Available for Gold,
        Silver and Diamond members — not on Bronze.
      </Text>

      {!canConnect ? (
        <View
          style={{
            flexDirection: 'row',
            gap: 12,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: 'rgba(245,158,11,0.25)',
            backgroundColor: 'rgba(245,158,11,0.1)',
            padding: 14,
          }}
        >
          <Crown color="#b45309" size={16} style={{ marginTop: 2 }} />
          <Text style={{ flex: 1, color: '#78350f', lineHeight: 18, fontSize: 13 }}>
            You’re on Bronze. Upgrade to Gold — or reach Silver via
            Instagram — to create an MCP token and let an AI control your
            profile.
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
          <KeyRound color="#fff" size={18} />
          <Text style={{ color: '#fffafb', fontWeight: '600', fontSize: 14 }}>
            {canConnect ? 'Create MCP token' : 'Premium required'}
          </Text>
        </View>
      </Button>

      {fresh ? <FreshTokenCard fresh={fresh} /> : null}

      <Text
        style={{
          color: 'rgba(38,4,9,0.55)',
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

      <Text style={{ color: '#775254', lineHeight: 16, fontSize: 12 }}>
        Tools: get profile, suggest/get places, save places, list/create
        reservations, list rewards. Revoke anytime if a client is compromised.
      </Text>
    </FullScreenSheet>
  );
}
