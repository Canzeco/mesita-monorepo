import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { FullScreenSheet } from '@/components/ui/FullScreenSheet';
import { TextField } from '@/components/ui/TextField';
import { apiClaimInviteCode } from '@/lib/api/auth';
import { CONSUMER_ROUTES } from '@/lib/consumer-route-contract';
import { errMsg } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { useAuth } from '@/providers/auth';

export default function InvitePage() {
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const [digits, setDigits] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cleaned = digits.replace(/\D/g, '').slice(0, 10);
  const canClaim = cleaned.length === 10 && !claiming;

  async function claim() {
    if (!canClaim) return;
    setClaiming(true);
    setError(null);
    try {
      await apiClaimInviteCode({ code: cleaned });
      await refreshProfile();
      toast.success('Invitation redeemed — your class updated.');
      router.replace(CONSUMER_ROUTES.me);
    } catch (e) {
      setError(errMsg(e, "That PIN didn't work."));
      setClaiming(false);
    }
  }

  return (
    <FullScreenSheet
      visible
      asRoute
      onClose={() => router.back()}
      title="Invitation PIN"
      subtitle="Ten digits. It names your class outright."
    >
      <View className="rounded-2xl border border-border bg-card p-4">
        <TextField
          label="Your PIN"
          value={cleaned}
          onChangeText={setDigits}
          keyboardType="number-pad"
          maxLength={10}
        />
        {error ? (
          <Text className="mt-2 text-sm text-destructive">{error}</Text>
        ) : null}
        <View className="mt-3">
          <Button onPress={() => void claim()} disabled={!canClaim}>
            {claiming ? 'Checking…' : 'Redeem'}
          </Button>
        </View>
      </View>
      <Text className="text-center text-xs text-muted-foreground">
        Invitations come from Mesita and its partners. A PIN works once.
      </Text>
    </FullScreenSheet>
  );
}
