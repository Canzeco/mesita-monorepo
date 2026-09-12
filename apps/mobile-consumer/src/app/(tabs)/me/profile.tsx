import { useRouter } from 'expo-router';
import { PersonalDetailsSheet } from '@/components/me/MeProfileSheets';
import { useAuth } from '@/providers/auth';

export default function ProfilePage() {
  const router = useRouter();
  const { refreshProfile } = useAuth();
  return (
    <PersonalDetailsSheet
      visible
      asRoute
      onClose={() => router.back()}
      onSaved={() => void refreshProfile()}
    />
  );
}
