import { Check, ExternalLink } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { FullScreenSheet } from '@/components/ui/FullScreenSheet';
import { COLORS, GRADIENTS } from '@/constants/brand';

export type ProofSheetPhase =
  | 'idle'
  | 'opening'
  | 'confirming'
  | 'success'
  | 'error';

export function googleMapsSearchUrl(placeName: string, address?: string | null) {
  const q = [placeName, address].filter(Boolean).join(' ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    q || 'restaurant',
  )}`;
}

function GoogleReviewSheetBody({
  placeName,
  mapsUrl,
  onConfirm,
  onClose,
}: {
  placeName: string;
  mapsUrl: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<ProofSheetPhase>('idle');
  const [error, setError] = useState<string | null>(null);

  const openGoogle = useCallback(async () => {
    setPhase('opening');
    try {
      await Linking.openURL(mapsUrl);
    } finally {
      setTimeout(() => setPhase('idle'), 600);
    }
  }, [mapsUrl]);

  const confirm = useCallback(async () => {
    setPhase('confirming');
    setError(null);
    try {
      await onConfirm();
      setPhase('success');
      setTimeout(() => onClose(), 400);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't confirm that just yet.",
      );
      setPhase('error');
    }
  }, [onConfirm, onClose]);

  return (
    <View style={{ padding: 16, paddingBottom: 32, gap: 12 }}>
      <Text
        className="text-muted-foreground"
        style={{ fontSize: 12.5, lineHeight: 17 }}
      >
        Post your review on Google, then confirm here so we can unlock the
        reward.
      </Text>

      <Pressable
        onPress={() => void openGoogle()}
        disabled={phase === 'confirming'}
        accessibilityRole="button"
        className="overflow-hidden rounded-2xl active:opacity-90"
        style={{ opacity: phase === 'confirming' ? 0.5 : 1 }}
      >
        <LinearGradient
          colors={[...GRADIENTS.pink]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            minHeight: 48,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 8,
          }}
        >
          {phase === 'opening' ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <ExternalLink size={16} color="#fff" />
          )}
          <Text className="font-bold text-white" style={{ fontSize: 14 }}>
            Open Google
          </Text>
        </LinearGradient>
      </Pressable>

      <Pressable
        onPress={() => void confirm()}
        disabled={phase === 'confirming' || phase === 'opening'}
        accessibilityRole="button"
        className="flex-row items-center justify-center rounded-2xl border border-border bg-card"
        style={{
          minHeight: 48,
          gap: 8,
          opacity: phase === 'confirming' || phase === 'opening' ? 0.5 : 1,
        }}
      >
        {phase === 'confirming' ? (
          <ActivityIndicator size="small" color={COLORS.foreground} />
        ) : phase === 'success' ? (
          <Check size={16} color="#059669" strokeWidth={3} />
        ) : null}
        <Text className="font-bold text-foreground" style={{ fontSize: 14 }}>
          {phase === 'confirming'
            ? 'Confirming…'
            : phase === 'success'
              ? 'Confirmed'
              : 'I’ve posted it'}
        </Text>
      </Pressable>

      {phase === 'success' ? (
        <Text
          style={{
            fontSize: 12,
            fontWeight: '600',
            color: '#15803d',
            backgroundColor: '#f0fdf4',
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 10,
            textAlign: 'center',
          }}
        >
          Got it — updating your tasks
        </Text>
      ) : null}

      {error ? (
        <Text
          className="rounded-lg bg-destructive/10 px-3 py-2 text-destructive"
          style={{ fontSize: 12 }}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function GoogleReviewSheet({
  open,
  onClose,
  placeName,
  mapsUrl,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  placeName: string;
  mapsUrl: string;
  onConfirm: () => Promise<void>;
}) {
  return (
    <FullScreenSheet
      visible={open}
      onClose={onClose}
      title="Leave a Google review"
      subtitle={placeName}
    >
      {open ? (
        <GoogleReviewSheetBody
          placeName={placeName}
          mapsUrl={mapsUrl}
          onConfirm={onConfirm}
          onClose={onClose}
        />
      ) : null}
    </FullScreenSheet>
  );
}
