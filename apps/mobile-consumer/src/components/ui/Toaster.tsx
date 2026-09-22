import { AlertCircle, Check, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS, SHADOW_ELEV } from '@/constants/brand';
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
  // Success loses its green (#059669) — state never keeps chroma — and lands
  // on muted-foreground, the neutral nearest its lightness and the value
  // web-consumer's Toaster took in MESITA-1936. The Check/AlertCircle split
  // above is what separates the two tones now, which matters because
  // greyscaling #059669 and #dc2626 by lightness would have landed them under
  // 10 L* apart at 16px: one grey glyph for opposite outcomes. Error keeps its
  // hue — a failed action is the danger case — and moves off stock red-600
  // onto the destructive token.
  const iconColor =
    t.tone === 'success'
      ? COLORS.mutedForeground
      : t.tone === 'error'
        ? COLORS.destructive
        : COLORS.foreground;

  return (
    <View
      className={`w-full max-w-sm flex-row items-center gap-3 rounded-lg border bg-card/95 px-4 py-2.5 ${
        t.tone === 'error' ? 'border-destructive/40' : 'border-border'
      }`}
      style={SHADOW_ELEV}
    >
      {Icon ? <Icon color={iconColor} size={16} strokeWidth={2.5} /> : null}
      <Text className="flex-1 text-sm leading-snug text-foreground">
        {t.message}
      </Text>
      {/* MATCHES web-consumer's Toaster.tsx exactly (MESITA-1936, merged to
          main): text-secondary + active:bg-muted, no fill. A filled ink chip
          was tried here first — the action label used to be text-secondary
          pink with no border and no fill, so the hue alone said "tappable,"
          and greying it read as fainter than the message beside it, the
          opposite of what it is. But this file's header asserts parity with
          web, and web already shipped the quiet-link answer to the same
          problem; two platforms disagreeing about one component after both
          claim to be the same component is worse than either choice alone. */}
      {t.action ? (
        <Pressable
          onPress={() => {
            t.action?.onClick();
            toast.dismiss(t.id);
          }}
          className="-mr-2 shrink-0 rounded-full px-3 py-1 active:bg-muted"
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
        <X color={COLORS.mutedForeground} size={12} />
      </Pressable>
    </View>
  );
}
