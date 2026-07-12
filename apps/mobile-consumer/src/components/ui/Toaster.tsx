import { AlertCircle, Check, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SHADOW_ELEV } from '@/constants/brand';
import { subscribeToToasts, toast, type Toast } from '@/lib/toast';

// Top-anchored toast stack — web Toaster parity (above gesture chrome).

export function Toaster() {
  const insets = useSafeAreaInsets();
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => subscribeToToasts(setToasts), []);

  if (toasts.length === 0) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: insets.top + 8,
        left: 16,
        right: 16,
        zIndex: 200,
        gap: 8,
        alignItems: 'center',
      }}
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} t={t} />
      ))}
    </View>
  );
}

function ToastCard({ t }: { t: Toast }) {
  const Icon =
    t.tone === 'success' ? Check : t.tone === 'error' ? AlertCircle : null;
  const iconColor =
    t.tone === 'success'
      ? '#059669'
      : t.tone === 'error'
        ? '#dc2626'
        : '#260409';

  return (
    <View
      className={`w-full max-w-sm flex-row items-center gap-3 rounded-lg border bg-card/95 px-4 py-2.5 ${
        t.tone === 'error' ? 'border-red-500/40' : 'border-border'
      }`}
      style={SHADOW_ELEV}
    >
      {Icon ? <Icon color={iconColor} size={16} strokeWidth={2.5} /> : null}
      <Text className="flex-1 text-sm leading-snug text-foreground">
        {t.message}
      </Text>
      {t.action ? (
        <Pressable
          onPress={() => {
            t.action?.onClick();
            toast.dismiss(t.id);
          }}
          className="rounded-full px-3 py-1 active:bg-muted"
        >
          <Text className="text-xs font-semibold text-secondary">
            {t.action.label}
          </Text>
        </Pressable>
      ) : null}
      <Pressable
        onPress={() => toast.dismiss(t.id)}
        accessibilityLabel="Dismiss"
        className="rounded-full p-1 active:bg-muted"
      >
        <X color="#775254" size={12} />
      </Pressable>
    </View>
  );
}
