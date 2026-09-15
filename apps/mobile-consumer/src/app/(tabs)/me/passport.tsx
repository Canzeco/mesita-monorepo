import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ChevronRight, Copy } from 'lucide-react-native';
import { Platform, Pressable, Share, Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

import { ChannelMark } from '@/components/brand/channel-marks';
import { FullScreenSheet } from '@/components/ui/FullScreenSheet';
import { DefaultAvatar } from '@/components/ui/DefaultAvatar';
import { COLORS, GRADIENT_DIAGONAL, GRADIENTS } from '@/constants/brand';
import { COUNTRIES } from '@/lib/countries';
import { CLASSES, CLASS_ICONS } from '@/lib/consumer-classes';
import { CONSUMER_ROUTES } from '@/lib/consumer-route-contract';
import { useEffectiveClass } from '@/lib/mock-class';
import {
  buildMrz,
  completionLine,
  passportFields,
} from '@/lib/passport-document';
import { toast } from '@/lib/toast';
import { formatCompactCount } from '@/lib/utils';
import { useAuth } from '@/providers/auth';

// Passport is a DOCUMENT plus two doors (MESITA-1801, MESITA-1820). Mirror of
// web `components/consumer/me/PassportModal.tsx` — consumer IA cannot diverge,
// so the two ship in one PR and carry the same card.
//
// MESITA-1820 turned the identity card from three rounded rows into an ICAO
// 9303 data page: a class-metal header band naming the class, a 35:45 portrait
// in a metal frame, an uppercase field grid (Member No. / Surname / Given
// names / Nationality · Date of birth · Sex), a guilloche, and two real
// 44-character TD3 machine-readable lines. Identity is look, not a button.
//
// NO COSTUME. The document is carried by the band, the portrait ratio, the
// grid, the guilloche and the MRZ. No fake visa stamps, no hologram sheen, no
// torn-paper edges, no rotated APPROVED mark, no fake barcodes, no paper grain.
//
// Class and Instagram are the only tiles — they open the existing pages. The
// ladder, invite PIN, and connect form stay there. No Profile row (Me › Profile
// is the editor). No Plan (MESITA-1619). No privacy (MESITA-1688).
//
// Colour means class: metal on the band, the portrait frame, the guilloche and
// the Class 44px glyph. Instagram's brand gradient stays inside its glyph,
// never a full-width pink field. Copy is origin-aware — do not tell a Diamond
// guest to climb.

const CLASS_FLOOR = CLASSES[0];
const CLASS_CEILING = CLASSES[CLASSES.length - 1];
const REACH_CANDIDATES = CLASSES.filter((c) => c.followerThreshold > 0);
const REACH_ENTRY = REACH_CANDIDATES.reduce(
  (lowest, c) =>
    c.followerThreshold < lowest.followerThreshold ? c : lowest,
  REACH_CANDIDATES[0] ?? CLASSES[0],
);

/** The MRZ's face. Neither app loads a monospace family, so each platform
 *  borrows the one its OS already ships — web takes Tailwind's `font-mono`
 *  stack, mobile takes these. */
const MRZ_FONT = Platform.select({ ios: 'Courier', android: 'monospace' });

function classReward(classId: string): string {
  if (classId === CLASS_CEILING.id) return 'Highest discount';
  if (classId === CLASS_FLOOR.id) return 'Base discount';
  return 'Higher discount';
}

function classBadgeColors(classKey: string): readonly [string, string] {
  if (classKey === 'aura') return ['#fde68a', '#fb923c'] as const;
  if (classKey === 'influencer') return ['#fecaca', '#ef4444'] as const;
  if (classKey === 'premium') return ['#bfdbfe', '#2563eb'] as const;
  return ['#e5e7eb', '#9ca3af'] as const;
}

function classBadgeIconColor(classKey: string): string {
  if (classKey === 'aura') return '#78350f';
  if (classKey === 'influencer') return '#7f1d1d';
  if (classKey === 'premium') return '#1e3a8a';
  return '#171717';
}

function classWash(classKey: string): readonly [string, string] {
  if (classKey === 'aura') {
    return ['rgba(245,204,88,0.18)', 'rgba(235,136,31,0.10)'] as const;
  }
  if (classKey === 'influencer') {
    return ['rgba(239,68,68,0.16)', 'rgba(185,28,28,0.10)'] as const;
  }
  if (classKey === 'premium') {
    return ['rgba(37,99,235,0.16)', 'rgba(96,165,250,0.12)'] as const;
  }
  return ['rgba(156,163,175,0.16)', 'rgba(156,163,175,0.06)'] as const;
}

function phoneCountry(phone: string | null | undefined) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 10) {
    return COUNTRIES.find((c) => c.code === 'MX') ?? null;
  }
  const sorted = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
  return sorted.find((c) => digits.startsWith(c.dial)) ?? null;
}

/** The engraved rosette lattice a security document prints behind its field
 *  grid — web's `--guilloche` in SVG. Two offset rings of concentric hairline
 *  circles in the class metal at 0.12 opacity, the same alpha ceiling web
 *  documents, so the field values above stay ≥4.5:1. Drawn, never an asset. */
function Guilloche({ color }: { color: string }) {
  const rings = [10, 20, 30, 40, 50, 60, 70, 80];
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
    >
      <Svg width="100%" height="100%" opacity={0.12}>
        <G>
          {rings.map((r) => (
            <Circle
              key={`a${r}`}
              cx="14%"
              cy="118%"
              r={r}
              stroke={color}
              strokeWidth={0.6}
              fill="none"
            />
          ))}
          {rings.map((r) => (
            <Circle
              key={`b${r}`}
              cx="86%"
              cy="-18%"
              r={r}
              stroke={color}
              strokeWidth={0.6}
              fill="none"
            />
          ))}
        </G>
      </Svg>
    </View>
  );
}

/** One printed line of the data page. A `Row` on a document has no chevron
 *  and no handler, on purpose — it is not the settings cell MESITA-1801
 *  deleted. Guest-fillable blanks print `—` and are counted by the completion
 *  line; server-owed blanks print `pending` and are never counted. */
function Row({
  label,
  value,
  placeholder,
  grow,
}: {
  label: string;
  value: string | null;
  placeholder: string;
  /** Takes the leftover width in a horizontal triple; the fixed-label columns
   *  beside it (DATE OF BIRTH, SEX) size to their own label. */
  grow?: boolean;
}) {
  return (
    <View style={{ minWidth: 0, flexShrink: 1, flexGrow: grow ? 1 : 0 }}>
      <Text
        className="font-bold uppercase text-muted-foreground"
        style={{ fontSize: 10, letterSpacing: 1.2 }}
      >
        {label}
      </Text>
      <Text
        className={
          value
            ? 'font-display text-[13px] text-foreground'
            : 'font-display text-[13px] text-muted-foreground'
        }
        numberOfLines={1}
      >
        {value ?? placeholder}
      </Text>
    </View>
  );
}

export default function PassportPage() {
  const router = useRouter();
  const { profile, consumerClass } = useAuth();
  const effective = useEffectiveClass(
    consumerClass,
    profile?.instagram_handle ?? null,
  );
  const classLabel =
    CLASSES.find((c) => c.id === effective.key)?.label ?? CLASS_FLOOR.label;
  const ClassIcon = CLASS_ICONS[effective.key];
  const handle = effective.handle ?? profile?.instagram_handle ?? null;
  const igConnected = effective.origin === 'instagram' || Boolean(handle);
  const code = profile?.code ?? null;
  const atCeiling = effective.key === CLASS_CEILING.id;
  const onFloor = effective.key === CLASS_FLOOR.id;

  const name =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') ||
    profile?.full_name ||
    'Mesita member';

  // NATIONALITY comes from the phone dial code, not a stored country: the
  // column is never written by onboarding, so the dial code the guest already
  // gave us is in practice the only source. `1` resolves to USA — a stable
  // code beats an em dash for every North American guest.
  const country = phoneCountry(profile?.phone);

  const dataPage = {
    code,
    firstName: profile?.first_name ?? null,
    lastName: profile?.last_name ?? null,
    birthday: profile?.birthday ?? null,
    sex: profile?.sex ?? null,
    nationality: country?.iso3 ?? null,
    // The LABEL the band is printing, not the class key: mobile still speaks
    // the legacy keys and web speaks the metals, and encoding the key would
    // make the MRZ contradict the band two centimetres above it.
    classLabel,
  };
  const { fields, missing } = passportFields(dataPage);
  const [mrzLine1, mrzLine2] = buildMrz(dataPage);
  const completion = completionLine(missing.length);
  const byId = (id: string) => fields.find((f) => f.id === id)?.value ?? null;

  const classNote =
    onFloor && !igConnected
      ? 'Climb with Instagram or an invite'
      : igConnected
        ? classReward(effective.key)
        : `${classReward(effective.key)} · Instagram or an invite`;

  const igHeadline = igConnected
    ? handle
      ? `@${handle}`
      : 'Connected'
    : atCeiling
      ? 'Not connected'
      : 'Connect it';
  const igNote = igConnected
    ? `${formatCompactCount(effective.followers)} followers`
    : atCeiling
      ? 'Connect for Stories and Rewards'
      : `${REACH_ENTRY.followerThreshold.toLocaleString('en-US')}+ followers lifts you to ${REACH_ENTRY.label}`;

  async function copyCode() {
    if (!code) return;
    try {
      await Share.share({ message: code });
    } catch {
      toast("Couldn't share the number");
    }
  }

  return (
    <FullScreenSheet
      visible
      asRoute
      onClose={() => router.back()}
      title="Your passport"
    >
      <View className="gap-3.5">
        <View className="overflow-hidden rounded-2xl border border-border bg-card">
          <LinearGradient
            colors={[...classWash(effective.key)]}
            start={GRADIENT_DIAGONAL.start}
            end={GRADIENT_DIAGONAL.end}
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
            }}
          />

          {/* The band. A real passport's top strip names the issuing state;
              naming the metal there spends the colour budget on the one
              surface licensed to hold it, and cannot be read as a button. */}
          <LinearGradient
            colors={[...classBadgeColors(effective.key)]}
            start={GRADIENT_DIAGONAL.start}
            end={GRADIENT_DIAGONAL.end}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 16,
              paddingVertical: 10,
            }}
          >
            <Text
              className="font-display font-semibold uppercase"
              style={{
                fontSize: 12,
                letterSpacing: 1.68,
                color: classBadgeIconColor(effective.key),
              }}
            >
              Mesita
            </Text>
            <Text
              className="font-bold uppercase"
              style={{
                fontSize: 10,
                letterSpacing: 1.2,
                color: classBadgeIconColor(effective.key),
              }}
            >
              {classLabel}
            </Text>
          </LinearGradient>

          <View className="p-4">
            <Guilloche color={classBadgeColors(effective.key)[1]} />

            <View className="flex-row gap-4">
              {/* 35:45 — the ratio a passport photo actually is. */}
              <LinearGradient
                colors={[...classBadgeColors(effective.key)]}
                start={GRADIENT_DIAGONAL.start}
                end={GRADIENT_DIAGONAL.end}
                style={{ borderRadius: 6, padding: 2.5 }}
              >
                <View className="h-[95px] w-[74px] items-center justify-center overflow-hidden rounded-[4px] bg-muted">
                  {profile?.avatar_url ? (
                    <Image
                      source={{ uri: profile.avatar_url }}
                      style={{ width: '100%', height: '100%' }}
                      contentFit="cover"
                      accessibilityLabel={name}
                    />
                  ) : (
                    <DefaultAvatar size={95} />
                  )}
                </View>
              </LinearGradient>

              <View className="min-w-0 flex-1 gap-2">
                {/* The member number takes the whole top row — louder than it
                    was, not quieter. It is still the only print of
                    consumers.code. */}
                <View style={{ minWidth: 0 }}>
                  <Text
                    className="font-bold uppercase text-muted-foreground"
                    style={{ fontSize: 10, letterSpacing: 1.2 }}
                  >
                    Member No.
                  </Text>
                  <View className="flex-row items-center">
                    <Text
                      className={
                        code
                          ? 'font-display tabular-nums tracking-wide text-foreground'
                          : 'font-display tabular-nums tracking-wide text-muted-foreground'
                      }
                      style={{ fontSize: 18 }}
                      numberOfLines={1}
                    >
                      {code ?? 'pending'}
                    </Text>
                    {code ? (
                      <Pressable
                        onPress={() => void copyCode()}
                        accessibilityLabel="Copy member number"
                        className="h-11 w-11 items-center justify-center rounded-xl"
                      >
                        <Copy color={COLORS.mutedForeground} size={16} />
                      </Pressable>
                    ) : null}
                  </View>
                </View>

                <Row label="Surname" value={byId('surname')} placeholder="—" />
                <Row
                  label="Given names"
                  value={byId('given')}
                  placeholder="—"
                />
              </View>
            </View>

            {/* The passport triple runs the FULL width of the card, not the
                column beside the portrait: "DATE OF BIRTH" at the 10px floor
                measures ~91px and the column left of it is ~159px on a narrow
                phone. Three of them do not fit there. */}
            <View className="mt-3 flex-row gap-3">
              <Row
                label="Nationality"
                value={byId('nationality')}
                placeholder="—"
                grow
              />
              <Row
                label="Date of birth"
                value={byId('birth')}
                placeholder="—"
              />
              <Row label="Sex" value={byId('sex')} placeholder="—" />
            </View>

            {/* THE COMPLETION LINE IS A COUNT, NOT A LINK (decision,
                MESITA-1820). The issue asked for a "Complete" link to
                Me › Profile beside it; the passport's law is two doors and
                only two (MESITA-1801), pinned twice over by web's
                passport-axes contract. The count names what is missing and
                Me › Profile is one Back away. */}
            {completion ? (
              <Text className="mt-3 text-xs text-muted-foreground">
                {completion}
              </Text>
            ) : null}
          </View>

          {/* The MRZ. Two real TD3 lines with real 7-3-1 check digits, hidden
              from the screen reader because 44 characters of `<` read aloud is
              hostile and the grid above already announces every fact it
              encodes. 10px is the floor, so no scaling. */}
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            className="border-t border-border bg-muted px-3 py-2"
          >
            <Text
              numberOfLines={1}
              className="text-muted-foreground"
              style={{ fontFamily: MRZ_FONT, fontSize: 10, letterSpacing: -0.1 }}
            >
              {mrzLine1}
            </Text>
            <Text
              numberOfLines={1}
              className="text-muted-foreground"
              style={{ fontFamily: MRZ_FONT, fontSize: 10, letterSpacing: -0.1 }}
            >
              {mrzLine2}
            </Text>
          </View>
        </View>

        <Pressable
          onPress={() => router.push(CONSUMER_ROUTES.mePages.class)}
          accessibilityRole="link"
          accessibilityLabel={`Class: ${classLabel}`}
          className="min-h-[72px] flex-row items-center gap-3 rounded-2xl border border-border bg-card p-3.5 active:scale-[0.99]"
        >
          <LinearGradient
            colors={[...classBadgeColors(effective.key)]}
            start={GRADIENT_DIAGONAL.start}
            end={GRADIENT_DIAGONAL.end}
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ClassIcon color={classBadgeIconColor(effective.key)} size={20} />
          </LinearGradient>
          <View className="min-w-0 flex-1">
            <Text
              className="font-bold uppercase text-muted-foreground"
              style={{ fontSize: 10, letterSpacing: 1.2 }}
            >
              Class
            </Text>
            <View className="mt-0.5 self-start rounded-full px-2.5 py-0.5" style={{ backgroundColor: classBadgeColors(effective.key)[0] }}>
              <Text
                className="text-sm font-bold"
                style={{ color: classBadgeIconColor(effective.key) }}
              >
                {classLabel}
              </Text>
            </View>
            <Text className="mt-0.5 text-xs leading-snug text-muted-foreground">
              {classNote}
            </Text>
          </View>
          <ChevronRight color={COLORS.mutedForeground} size={16} />
        </Pressable>

        <Pressable
          onPress={() => router.push(CONSUMER_ROUTES.mePages.instagram)}
          accessibilityRole="link"
          accessibilityLabel={`Instagram: ${igHeadline}`}
          className="min-h-[72px] flex-row items-center gap-3 rounded-2xl border border-border bg-card p-3.5 active:scale-[0.99]"
        >
          <LinearGradient
            colors={[...GRADIENTS.instagram]}
            start={GRADIENT_DIAGONAL.start}
            end={GRADIENT_DIAGONAL.end}
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ChannelMark channel="instagram" size={20} color="#ffffff" />
          </LinearGradient>
          <View className="min-w-0 flex-1">
            <Text
              className="font-bold uppercase text-muted-foreground"
              style={{ fontSize: 10, letterSpacing: 1.2 }}
            >
              Instagram
            </Text>
            <Text
              className="mt-0.5 text-sm font-bold text-foreground"
              numberOfLines={1}
            >
              {igHeadline}
            </Text>
            <Text className="mt-0.5 text-xs leading-snug text-muted-foreground">
              {igNote}
            </Text>
          </View>
          <ChevronRight color={COLORS.mutedForeground} size={16} />
        </Pressable>
      </View>
    </FullScreenSheet>
  );
}
