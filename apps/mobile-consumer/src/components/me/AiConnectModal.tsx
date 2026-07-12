import { Bot, Copy, Crown, KeyRound, Trash2 } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import {
  Appbar,
  Button,
  IconButton,
  List,
  Modal,
  Portal,
  Text,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  apiCreateMcpToken,
  apiListMcpTokens,
  apiRevokeMcpToken,
  type McpTokenMinted,
} from '@/lib/api/mcp-tokens';
import { copyText } from '@/lib/clipboard';
import { useEffectiveClass } from '@/lib/mock-class';
import { errMsg } from '@/lib/utils';
import { useAuth } from '@/providers/auth';

type Props = {
  visible: boolean;
  onClose: () => void;
};

function cursorSnippet(mcpUrl: string, token: string): string {
  return JSON.stringify(
    {
      mcpServers: {
        mesita: {
          url: mcpUrl,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      },
    },
    null,
    2,
  );
}

export function AiConnectModal({ visible, onClose }: Props) {
  const { consumerClass, profile } = useAuth();
  const { key: classKey } = useEffectiveClass(
    consumerClass,
    profile?.instagram_handle ?? null,
  );
  const isPremium = classKey === 'premium';
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
    if (!isPremium) {
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

  async function copy(text: string, okMsg: string) {
    try {
      await copyText(text);
      Alert.alert('Copied', okMsg);
    } catch {
      Alert.alert("Couldn't copy", 'Select the text manually.');
    }
  }

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onClose}
        contentContainerStyle={{
          flex: 1,
          backgroundColor: '#fff7f8',
          margin: 0,
        }}
      >
        <SafeAreaView style={{ flex: 1 }}>
          <Appbar.Header style={{ backgroundColor: '#fff7f8' }} elevated>
            <Appbar.Content
              title="AI"
              subtitle="Connect your Mesita profile to an AI"
            />
            <Appbar.Action icon="close" onPress={onClose} />
          </Appbar.Header>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}
          >
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
            >
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
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                >
                  <Text variant="titleLarge" style={{ fontWeight: '700' }}>
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
                      variant="labelSmall"
                      style={{
                        color: '#775254',
                        fontWeight: '700',
                        letterSpacing: 1,
                      }}
                    >
                      PREMIUM
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <Text
              variant="bodyMedium"
              style={{ color: '#775254', lineHeight: 20 }}
            >
              Generate a personal access token, then add Mesita as an MCP server
              in Claude, Cursor, or ChatGPT. Your AI can then find places, save
              them, book tables, and check rewards — as you. Available for
              Premium members only — not on Free.
            </Text>

            {!isPremium ? (
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
                <Text
                  variant="bodySmall"
                  style={{ flex: 1, color: '#78350f', lineHeight: 18 }}
                >
                  You’re on Free. Upgrade to Mesita Premium to create an MCP
                  token and let an AI control your profile.
                </Text>
              </View>
            ) : null}

            <Button
              mode="contained"
              onPress={() => void mint()}
              disabled={minting || !isPremium}
              loading={minting}
              icon={() => <KeyRound color="#fff" size={18} />}
              buttonColor="#7c3aed"
              contentStyle={{ paddingVertical: 4 }}
            >
              {minting
                ? 'Creating token…'
                : isPremium
                  ? 'Create MCP token'
                  : 'Premium required'}
            </Button>

            {fresh ? (
              <View
                style={{
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: '#ebd9db',
                  backgroundColor: '#ffffff',
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    borderBottomWidth: 1,
                    borderBottomColor: 'rgba(235,217,219,0.6)',
                    padding: 14,
                  }}
                >
                  <Text variant="titleSmall" style={{ fontWeight: '700' }}>
                    New token
                  </Text>
                  <Text variant="labelSmall" style={{ color: '#775254' }}>
                    Copy now — Mesita won’t show the full token again
                  </Text>
                </View>
                <View style={{ padding: 14, gap: 10 }}>
                  <Text
                    selectable
                    variant="labelSmall"
                    style={{
                      backgroundColor: '#faeff0',
                      padding: 12,
                      borderRadius: 10,
                      fontFamily: 'monospace',
                    }}
                  >
                    {fresh.token}
                  </Text>
                  <Button
                    mode="text"
                    icon={() => <Copy color="#7c3aed" size={16} />}
                    onPress={() =>
                      void copy(
                        fresh.token,
                        'Token copied — paste into your AI client',
                      )
                    }
                  >
                    Copy token
                  </Button>
                  <Text
                    variant="labelSmall"
                    style={{
                      color: '#775254',
                      fontWeight: '700',
                      letterSpacing: 1,
                    }}
                  >
                    MCP URL
                  </Text>
                  <Text
                    selectable
                    variant="labelSmall"
                    style={{
                      backgroundColor: '#faeff0',
                      padding: 12,
                      borderRadius: 10,
                      fontFamily: 'monospace',
                    }}
                  >
                    {fresh.mcp_url}
                  </Text>
                  <Button
                    mode="text"
                    icon={() => <Copy color="#7c3aed" size={16} />}
                    onPress={() =>
                      void copy(
                        cursorSnippet(fresh.mcp_url, fresh.token),
                        'Cursor / Claude config copied',
                      )
                    }
                  >
                    Copy Cursor / Claude config
                  </Button>
                </View>
              </View>
            ) : null}

            <Text
              variant="labelSmall"
              style={{
                color: 'rgba(38,4,9,0.55)',
                letterSpacing: 1.6,
                textTransform: 'uppercase',
                fontWeight: '700',
              }}
            >
              Active tokens
            </Text>
            <View
              style={{
                borderRadius: 16,
                borderWidth: 1,
                borderColor: '#ebd9db',
                backgroundColor: '#ffffff',
                overflow: 'hidden',
              }}
            >
              {loading && tokens.length === 0 ? (
                <Text
                  variant="bodySmall"
                  style={{ color: '#775254', padding: 14 }}
                >
                  Loading…
                </Text>
              ) : tokens.length === 0 ? (
                <Text
                  variant="bodySmall"
                  style={{ color: '#775254', padding: 14 }}
                >
                  No active tokens yet.
                </Text>
              ) : (
                tokens.map((t) => (
                  <List.Item
                    key={t.id}
                    title={t.label}
                    description={`${t.token_prefix}…`}
                    left={(props) => (
                      <List.Icon
                        {...props}
                        icon={() => <KeyRound color="#775254" size={18} />}
                      />
                    )}
                    right={() => (
                      <IconButton
                        icon={() => <Trash2 color="#dc2626" size={18} />}
                        onPress={() => void revoke(t.id)}
                        accessibilityLabel="Revoke token"
                      />
                    )}
                  />
                ))
              )}
            </View>

            <Text
              variant="labelSmall"
              style={{ color: '#775254', lineHeight: 16 }}
            >
              Tools: get profile, suggest/get places, save places, list/create
              reservations, list rewards. Revoke anytime if a client is
              compromised.
            </Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </Portal>
  );
}
