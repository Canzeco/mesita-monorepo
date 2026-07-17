import { Alert, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import type { McpTokenMinted } from '@/lib/api/mcp-tokens';
import { copyText } from '@/lib/clipboard';

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

async function copy(text: string, okMsg: string) {
  try {
    await copyText(text);
    Alert.alert('Copied', okMsg);
  } catch {
    Alert.alert("Couldn't copy", 'Select the text manually.');
  }
}

export function FreshTokenCard({ fresh }: { fresh: McpTokenMinted }) {
  return (
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
        <Text style={{ fontWeight: '700', fontSize: 15, color: '#260409' }}>
          New token
        </Text>
        <Text style={{ color: '#775254', fontSize: 12 }}>
          Copy now — Mesita won’t show the full token again
        </Text>
      </View>
      <View style={{ padding: 14, gap: 10 }}>
        <Text
          selectable
          style={{
            backgroundColor: '#faeff0',
            padding: 12,
            borderRadius: 10,
            fontFamily: 'monospace',
            fontSize: 12,
            color: '#260409',
          }}
        >
          {fresh.token}
        </Text>
        <Button
          variant="ghost"
          onPress={() =>
            void copy(fresh.token, 'Token copied — paste into your AI client')
          }
          accessibilityLabel="Copy token"
        >
          Copy token
        </Button>
        <Text
          style={{
            color: '#775254',
            fontWeight: '700',
            letterSpacing: 1,
            fontSize: 11,
          }}
        >
          MCP URL
        </Text>
        <Text
          selectable
          style={{
            backgroundColor: '#faeff0',
            padding: 12,
            borderRadius: 10,
            fontFamily: 'monospace',
            fontSize: 12,
            color: '#260409',
          }}
        >
          {fresh.mcp_url}
        </Text>
        <Button
          variant="ghost"
          onPress={() =>
            void copy(
              cursorSnippet(fresh.mcp_url, fresh.token),
              'Cursor / Claude config copied',
            )
          }
          accessibilityLabel="Copy Cursor Claude config"
        >
          Copy Cursor / Claude config
        </Button>
      </View>
    </View>
  );
}
