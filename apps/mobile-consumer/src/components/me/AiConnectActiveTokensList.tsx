import { KeyRound, Trash2 } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { COLORS } from '@/constants/brand';
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
        borderColor: COLORS.border,
        backgroundColor: COLORS.card,
        overflow: 'hidden',
      }}
    >
      {loading && tokens.length === 0 ? (
        <Text
          style={{ color: COLORS.mutedForeground, padding: 14, fontSize: 13 }}
        >
          Loading…
        </Text>
      ) : tokens.length === 0 ? (
        <Text
          style={{ color: COLORS.mutedForeground, padding: 14, fontSize: 13 }}
        >
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
              borderBottomColor: 'rgba(219,219,219,0.5)',
            }}
          >
            <KeyRound color={COLORS.mutedForeground} size={18} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={{
                  fontWeight: '600',
                  fontSize: 15,
                  color: COLORS.foreground,
                }}
              >
                {t.label}
              </Text>
              <Text style={{ color: COLORS.mutedForeground, fontSize: 12 }}>
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
              <Trash2 color={COLORS.destructive} size={18} />
            </Pressable>
          </View>
        ))
      )}
    </View>
  );
}
