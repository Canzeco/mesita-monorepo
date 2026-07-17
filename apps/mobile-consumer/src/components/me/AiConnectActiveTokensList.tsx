import { KeyRound, Trash2 } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import type { McpTokenMeta } from '@/lib/api/mcp-tokens';

export function ActiveTokensList({
  loading,
  tokens,
  onRevoke,
}: {
  loading: boolean;
  tokens: McpTokenMeta[];
  onRevoke: (id: string) => void;
}) {
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
      {loading && tokens.length === 0 ? (
        <Text style={{ color: '#775254', padding: 14, fontSize: 13 }}>
          Loading…
        </Text>
      ) : tokens.length === 0 ? (
        <Text style={{ color: '#775254', padding: 14, fontSize: 13 }}>
          No active tokens yet.
        </Text>
      ) : (
        tokens.map((t) => (
          <View
            key={t.id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingHorizontal: 14,
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: 'rgba(235,217,219,0.5)',
            }}
          >
            <KeyRound color="#775254" size={18} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={{ fontWeight: '600', fontSize: 15, color: '#260409' }}
              >
                {t.label}
              </Text>
              <Text style={{ color: '#775254', fontSize: 12 }}>
                {t.token_prefix}…
              </Text>
            </View>
            <Pressable
              onPress={() => onRevoke(t.id)}
              accessibilityRole="button"
              accessibilityLabel="Revoke token"
              hitSlop={8}
              style={{
                minHeight: 44,
                minWidth: 44,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Trash2 color="#dc2626" size={18} />
            </Pressable>
          </View>
        ))
      )}
    </View>
  );
}
