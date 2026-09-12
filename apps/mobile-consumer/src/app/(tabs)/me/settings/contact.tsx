import { useRouter } from 'expo-router';
import { ContactSheet } from '@/components/me/contact-sheet';

export default function ContactPage() {
  const router = useRouter();
  return <ContactSheet visible asRoute onClose={() => router.back()} />;
}
