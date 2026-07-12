import { Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Linking, Text, View } from 'react-native';
import { router } from 'expo-router';

import { Button } from '@/components/ui/Button';
import { FullScreenSheet } from '@/components/ui/FullScreenSheet';
import { TextField } from '@/components/ui/TextField';
import { apiDeleteConsumerAccount } from '@/lib/api/auth';
import { errMsg } from '@/lib/utils';
import { useAuth } from '@/providers/auth';

const CONFIRM_WORD = 'DELETE';
const PRIVACY_EMAIL = 'privacy@mesita.ai';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function DeleteAccountSheet({ visible, onClose }: Props) {
  const { signOut } = useAuth();
  const [confirm, setConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);

  const armed = confirm.trim().toUpperCase() === CONFIRM_WORD && !deleting;

  async function deleteAccount() {
    if (!armed) return;
    setDeleting(true);
    try {
      await apiDeleteConsumerAccount();
      await signOut().catch(() => {});
      onClose();
      router.replace('/sign-in');
    } catch (e) {
      Alert.alert(
        "Couldn't delete",
        errMsg(e, "Couldn't delete your account — try again."),
      );
      setDeleting(false);
    }
  }

  return (
    <FullScreenSheet
      visible={visible}
      onClose={onClose}
      title="Delete account"
      subtitle="This is permanent and can’t be undone."
    >
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          backgroundColor: 'rgba(220,38,38,0.1)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Trash2 color="#dc2626" size={22} />
      </View>

      <Text style={{ color: '#775254', lineHeight: 20, fontSize: 14 }}>
        Your profile, tickets, reservations and rewards will be permanently
        deleted, and your sign-in will stop working immediately. If you’d rather
        we handle it manually, email{' '}
        <Text
          style={{ color: '#ec006c', textDecorationLine: 'underline' }}
          onPress={() =>
            void Linking.openURL(
              `mailto:${PRIVACY_EMAIL}?subject=${encodeURIComponent(
                'Delete my Mesita account',
              )}`,
            )
          }
          accessibilityRole="link"
          accessibilityLabel={`Email ${PRIVACY_EMAIL}`}
        >
          {PRIVACY_EMAIL}
        </Text>
        .
      </Text>

      <Text style={{ fontWeight: '600', fontSize: 14, color: '#260409' }}>
        Type{' '}
        <Text style={{ color: '#dc2626', fontFamily: 'monospace' }}>
          {CONFIRM_WORD}
        </Text>{' '}
        to confirm:
      </Text>
      <TextField
        value={confirm}
        onChangeText={setConfirm}
        placeholder={CONFIRM_WORD}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={CONFIRM_WORD.length}
        accessibilityLabel="Type DELETE to confirm"
        style={{
          textAlign: 'center',
          letterSpacing: 4,
        }}
      />

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
        <View style={{ flex: 1 }}>
          <Button variant="outline" onPress={onClose}>
            Cancel
          </Button>
        </View>
        <View style={{ flex: 1 }}>
          <Button
            onPress={() => void deleteAccount()}
            disabled={!armed}
            loading={deleting}
            accessibilityLabel="Delete forever"
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Trash2 color="#fff" size={16} />
              <Text style={{ color: '#fffafb', fontWeight: '600', fontSize: 14 }}>
                Delete forever
              </Text>
            </View>
          </Button>
        </View>
      </View>
      <Text
        accessibilityRole="alert"
        style={{ color: '#dc2626', fontSize: 12, textAlign: 'center' }}
      >
        This action cannot be undone.
      </Text>
    </FullScreenSheet>
  );
}
