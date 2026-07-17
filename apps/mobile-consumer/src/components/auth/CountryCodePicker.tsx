import { FlatList, Modal, Pressable, Text } from 'react-native';

import { COUNTRIES } from '@/lib/countries';

type CountryCodePickerProps = {
  visible: boolean;
  countryCode: string;
  onClose: () => void;
  onSelect: (code: string) => void;
};

export function CountryCodePicker({
  visible,
  countryCode,
  onClose,
  onSelect,
}: CountryCodePickerProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.4)',
          justifyContent: 'flex-end',
        }}
        onPress={onClose}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            maxHeight: '70%',
            backgroundColor: '#ffffff',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingBottom: 24,
          }}
        >
          <Text
            className="font-display font-semibold text-foreground"
            style={{
              paddingHorizontal: 20,
              paddingTop: 20,
              paddingBottom: 12,
            }}
          >
            Country code
          </Text>
          <FlatList
            data={COUNTRIES}
            keyExtractor={(item) => item.code}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  onSelect(item.code);
                  onClose();
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingHorizontal: 20,
                  paddingVertical: 12,
                  backgroundColor:
                    item.code === countryCode ? '#ffe4ef' : 'transparent',
                }}
              >
                <Text style={{ fontSize: 20 }}>{item.flag}</Text>
                <Text className="text-foreground" style={{ flex: 1, fontSize: 16 }}>
                  {item.name}
                </Text>
                <Text className="font-semibold text-foreground">
                  +{item.dial}
                </Text>
              </Pressable>
            )}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
