import { Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Linking, ScrollView, View } from 'react-native';
import {
  Appbar,
  Button,
  HelperText,
  Modal,
  Portal,
  Text,
  TextInput,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

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
              title="Delete account"
              subtitle="This is permanent and can’t be undone."
            />
            <Appbar.Action icon="close" onPress={onClose} />
          </Appbar.Header>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
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

            <Text
              variant="bodyMedium"
              style={{ color: '#775254', lineHeight: 20 }}
            >
              Your profile, tickets, reservations and rewards will be
              permanently deleted, and your sign-in will stop working
              immediately. If you’d rather we handle it manually, email{' '}
              <Text
                style={{ color: '#ec006c', textDecorationLine: 'underline' }}
                onPress={() =>
                  void Linking.openURL(
                    `mailto:${PRIVACY_EMAIL}?subject=${encodeURIComponent(
                      'Delete my Mesita account',
                    )}`,
                  )
                }
              >
                {PRIVACY_EMAIL}
              </Text>
              .
            </Text>

            <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
              Type{' '}
              <Text style={{ color: '#dc2626', fontFamily: 'monospace' }}>
                {CONFIRM_WORD}
              </Text>{' '}
              to confirm:
            </Text>
            <TextInput
              mode="outlined"
              value={confirm}
              onChangeText={setConfirm}
              placeholder={CONFIRM_WORD}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={CONFIRM_WORD.length}
              style={{
                backgroundColor: '#ffffff',
                textAlign: 'center',
                letterSpacing: 4,
              }}
            />

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <Button
                mode="outlined"
                onPress={onClose}
                style={{ flex: 1 }}
                contentStyle={{ paddingVertical: 4 }}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={() => void deleteAccount()}
                disabled={!armed}
                loading={deleting}
                buttonColor="#dc2626"
                icon={() => <Trash2 color="#fff" size={16} />}
                style={{ flex: 1 }}
                contentStyle={{ paddingVertical: 4 }}
              >
                {deleting ? 'Deleting…' : 'Delete forever'}
              </Button>
            </View>
            <HelperText type="error" visible>
              This action cannot be undone.
            </HelperText>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </Portal>
  );
}
