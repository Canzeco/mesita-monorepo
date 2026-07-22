import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ImageIcon, Share2 } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { ChannelMark } from '@/components/brand/channel-marks';
import { MesitaMark } from '@/components/brand/MesitaMark';
import { formatInstagramHandle } from '@/lib/api/pay';

// RN port of web-consumer TicketStoryFrame — the 9:16 Instagram-story mock
// rendered on the "story" step of the ticket flow. Blurred place photo behind
// a dashed "photo or video" placeholder, an IG Story badge + share affordance
// up top, and the two mention tags (@mesita emphasized, the place handle) that
// the guest must tag. Brand marks come from the Foundation SVGs
// (ChannelMark instagram / MesitaMark) so the tags read as the real accounts.

const MESITA_TAG = '@mesita';

export function TicketStoryFrame({
  placePhotoUrl,
  placeName,
  placeInstagramHandle,
}: {
  placePhotoUrl?: string | null;
  placeName?: string | null;
  placeInstagramHandle?: string | null;
}) {
  const placeTag = formatInstagramHandle(placeInstagramHandle);

  return (
    <View style={{ alignItems: 'center' }}>
      <Text
        style={{
          marginBottom: 6,
          textAlign: 'center',
          fontSize: 10,
          fontWeight: '500',
          color: '#775254',
        }}
      >
        Your story goes in this frame
      </Text>

      <View
        accessibilityLabel="Instagram story preview"
        style={{
          width: 148,
          aspectRatio: 9 / 16,
          borderRadius: 16,
          overflow: 'hidden',
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: 'rgba(251,43,123,0.35)',
          backgroundColor: 'rgba(255,247,248,0.5)',
          shadowColor: '#260409',
          shadowOpacity: 0.1,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 3 },
          elevation: 2,
        }}
      >
        {placePhotoUrl ? (
          <Image
            source={{ uri: placePhotoUrl }}
            style={[StyleSheet.absoluteFill, { opacity: 0.35 }]}
            contentFit="cover"
            blurRadius={3}
          />
        ) : (
          <LinearGradient
            colors={['#fff7f8', 'rgba(255,247,248,0.6)']}
            style={StyleSheet.absoluteFill}
          />
        )}

        <LinearGradient
          colors={['rgba(0,0,0,0.1)', 'transparent', 'rgba(0,0,0,0.5)']}
          style={StyleSheet.absoluteFill}
        />

        {/* IG Story badge + share affordance */}
        <View
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            right: 8,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
          }}
        >
          <ChannelMark channel="instagram" size={12} color="#ffffff" />
          <Text
            style={{
              fontSize: 8,
              fontWeight: '600',
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.95)',
            }}
          >
            Story
          </Text>
          <View style={{ position: 'absolute', right: 0 }}>
            <Share2 color="rgba(255,255,255,0.9)" size={12} />
          </View>
        </View>

        {/* Dashed photo / video placeholder */}
        <View
          style={{
            position: 'absolute',
            top: 10,
            bottom: 10,
            left: 10,
            right: 10,
            borderRadius: 8,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: 'rgba(255,255,255,0.25)',
            backgroundColor: 'rgba(0,0,0,0.2)',
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 4,
          }}
        >
          <ImageIcon color="rgba(255,255,255,0.7)" size={20} strokeWidth={1.5} />
          <Text
            style={{
              marginTop: 4,
              maxWidth: 110,
              textAlign: 'center',
              fontSize: 9,
              lineHeight: 12,
              fontWeight: '500',
              color: 'rgba(255,255,255,0.9)',
            }}
          >
            Photo or video
          </Text>
          {placeName ? (
            <Text
              numberOfLines={2}
              style={{
                maxWidth: 110,
                textAlign: 'center',
                fontSize: 9,
                lineHeight: 12,
                fontWeight: '500',
                color: 'rgba(255,255,255,0.7)',
              }}
            >
              {placeName}
            </Text>
          ) : null}
        </View>

        {/* Mention tags — @mesita emphasized, place handle secondary */}
        <View
          style={{
            position: 'absolute',
            bottom: 28,
            left: 8,
            right: 8,
            alignItems: 'flex-start',
            gap: 4,
          }}
        >
          <StoryMentionTag handle={MESITA_TAG} emphasized />
          {placeTag ? <StoryMentionTag handle={placeTag} /> : null}
        </View>

        <Text
          style={{
            position: 'absolute',
            bottom: 4,
            left: 0,
            right: 0,
            textAlign: 'center',
            fontSize: 8,
            fontWeight: '500',
            color: 'rgba(255,255,255,0.75)',
          }}
        >
          Tag both accounts
        </Text>
      </View>
    </View>
  );
}

function StoryMentionTag({
  handle,
  emphasized = false,
}: {
  handle: string;
  emphasized?: boolean;
}) {
  return (
    <View
      style={{
        maxWidth: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 2,
        backgroundColor: emphasized ? '#fb2b7b' : 'rgba(255,255,255,0.95)',
        shadowColor: '#260409',
        shadowOpacity: 0.12,
        shadowRadius: 3,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
      }}
    >
      {emphasized ? (
        <MesitaMark color="#ffffff" size={9} />
      ) : (
        <ChannelMark channel="instagram" size={9} />
      )}
      <Text
        numberOfLines={1}
        style={{
          fontSize: 9,
          fontWeight: '700',
          color: emphasized ? '#ffffff' : '#260409',
        }}
      >
        {handle}
      </Text>
    </View>
  );
}
