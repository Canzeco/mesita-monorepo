import { useState } from 'react';
import { useRouter } from 'expo-router';
import { SettingsSheet } from '@/components/me/MeProfileSheets';
import { DeleteAccountSheet } from '@/components/me/DeleteAccountSheet';

export default function SettingsPage() {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  return (
    <>
      <SettingsSheet
        visible
        asRoute
        onClose={() => router.back()}
        onDeleteAccount={() => setDeleteOpen(true)}
      />
      <DeleteAccountSheet
        visible={deleteOpen}
        onClose={() => setDeleteOpen(false)}
      />
    </>
  );
}
