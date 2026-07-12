import {
  Camera,
  Globe,
  MessageCircle,
  Phone,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Linking, Pressable, View } from 'react-native';
import { Modal, Portal, Text } from 'react-native-paper';

import type { PlaceDetail } from '@/lib/types/place-detail';

type ContactRow = {
  key: string;
  Icon: LucideIcon;
  tint: string;
  iconColor: string;
  label: string;
  sub: string;
  href: string;
};

function prettyHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'Visit website';
  }
}

function buildContactRows(place: PlaceDetail): ContactRow[] {
  const rows: ContactRow[] = [];
  const { whatsapp_url, instagram_url, website_url } = place.channels;

  if (whatsapp_url) {
    rows.push({
      key: 'whatsapp',
      Icon: MessageCircle,
      tint: '#ecfdf5',
      iconColor: '#059669',
      label: 'WhatsApp',
      sub: 'Chat on WhatsApp',
      href: whatsapp_url,
    });
  }
  if (place.phone) {
    rows.push({
      key: 'phone',
      Icon: Phone,
      tint: '#ecfdf5',
      iconColor: '#059669',
      label: 'Call',
      sub: place.phone,
      href: `tel:${place.phone.replace(/\s+/g, '')}`,
    });
  }
  if (instagram_url) {
    rows.push({
      key: 'instagram',
      Icon: Camera,
      tint: '#fdf2f8',
      iconColor: '#db2777',
      label: 'Instagram',
      sub: 'Send a direct message',
      href: instagram_url,
    });
  }
  if (website_url) {
    rows.push({
      key: 'website',
      Icon: Globe,
      tint: '#f0f9ff',
      iconColor: '#0284c7',
      label: 'Website',
      sub: prettyHost(website_url),
      href: website_url,
    });
  }
  return rows;
}

export function PlaceContactSheet({
  place,
  open,
  onClose,
}: {
  place: PlaceDetail;
  open: boolean;
  onClose: () => void;
}) {
  const rows = buildContactRows(place);

  return (
    <Portal>
      <Modal
        visible={open}
        onDismiss={onClose}
        contentContainerStyle={{
          marginHorizontal: 16,
          borderRadius: 20,
          backgroundColor: '#ffffff',
          paddingVertical: 8,
          paddingHorizontal: 8,
        }}
      >
        <Text
          variant="titleMedium"
          style={{
            fontWeight: '700',
            paddingHorizontal: 12,
            paddingTop: 12,
            paddingBottom: 8,
          }}
        >
          Contact
        </Text>
        {rows.length === 0 ? (
          <Text variant="bodyMedium" style={{ color: '#775254', padding: 16 }}>
            No contact links available yet.
          </Text>
        ) : (
          rows.map((row) => (
            <Pressable
              key={row.key}
              onPress={() => {
                void Linking.openURL(row.href);
                onClose();
              }}
              className="flex-row items-center gap-3 rounded-xl px-3 py-3 active:bg-muted"
            >
              <View
                className="size-10 items-center justify-center rounded-full"
                style={{ backgroundColor: row.tint }}
              >
                <row.Icon color={row.iconColor} size={18} />
              </View>
              <View className="min-w-0 flex-1">
                <Text variant="titleSmall" style={{ fontWeight: '600' }}>
                  {row.label}
                </Text>
                <Text variant="bodySmall" style={{ color: '#775254' }}>
                  {row.sub}
                </Text>
              </View>
            </Pressable>
          ))
        )}
        <Pressable
          onPress={onClose}
          className="mx-2 mb-2 mt-1 items-center rounded-xl bg-muted py-3 active:opacity-80"
        >
          <Text variant="labelLarge" style={{ fontWeight: '600' }}>
            Cancel
          </Text>
        </Pressable>
      </Modal>
    </Portal>
  );
}
