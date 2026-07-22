import {
  Camera,
  Globe,
  MessageCircle,
  Phone,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Linking, Modal, Pressable, Text, View } from 'react-native';

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
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss contact sheet"
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: 'rgba(38,4,9,0.4)',
          justifyContent: 'center',
          paddingHorizontal: 16,
        }}
      >
        <Pressable
          accessibilityRole="none"
          onPress={(e) => e.stopPropagation()}
          className="rounded-[20px] border border-border bg-card py-2"
        >
          <View className="flex-row items-center gap-3 px-4 pb-2 pt-3">
            <View className="size-12 items-center justify-center rounded-full bg-emerald-500/10">
              <MessageCircle color="#059669" size={20} />
            </View>
            <View className="min-w-0 flex-1">
              <Text
                className="font-bold text-foreground"
                style={{ fontSize: 17 }}
              >
                Contact
              </Text>
              <Text
                className="text-muted-foreground"
                style={{ fontSize: 12 }}
                numberOfLines={1}
              >
                {place.name}
              </Text>
            </View>
          </View>
          {rows.length === 0 ? (
            <Text
              className="px-4 py-4 text-muted-foreground"
              style={{ fontSize: 14 }}
            >
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
                accessibilityRole="button"
                accessibilityLabel={`${row.label}: ${row.sub}`}
                className="min-h-[48px] flex-row items-center gap-3 rounded-xl px-3 py-3 active:bg-muted"
              >
                <View
                  className="size-10 items-center justify-center rounded-full"
                  style={{ backgroundColor: row.tint }}
                >
                  <row.Icon color={row.iconColor} size={18} />
                </View>
                <View className="min-w-0 flex-1">
                  <Text
                    className="font-semibold text-foreground"
                    style={{ fontSize: 15 }}
                  >
                    {row.label}
                  </Text>
                  <Text
                    className="text-muted-foreground"
                    style={{ fontSize: 13 }}
                  >
                    {row.sub}
                  </Text>
                </View>
              </Pressable>
            ))
          )}
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            className="mx-2 mb-2 mt-1 min-h-[48px] items-center justify-center rounded-xl bg-muted active:opacity-80"
          >
            <Text className="font-semibold text-foreground" style={{ fontSize: 14 }}>
              Cancel
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
