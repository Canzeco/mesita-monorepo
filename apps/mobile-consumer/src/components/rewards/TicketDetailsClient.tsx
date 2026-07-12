import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  CheckCircle2,
  ChevronLeft,
  Lock,
  MapPin,
  QrCode,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TicketBillReceipt } from '@/components/rewards/TicketBillReceipt';
import { TicketFlowStepper } from '@/components/rewards/TicketFlowStepper';
import {
  TicketReviewForm,
  type TicketReviewDraft,
} from '@/components/rewards/TicketReviewForm';
import { Button } from '@/components/ui/Button';
import { GRADIENT_DIAGONAL, GRADIENTS, SHADOW_ELEV } from '@/constants/brand';
import {
  fetchPayTicketBundle,
  type PayTicketMeta,
} from '@/lib/api/notifications';
import {
  buildTicketTransactionSummary,
  formatTicketRewardLabel,
  formatTicketTransactionSummaryLine,
  formatTicketVisitDate,
  MOCK_STORY_DETECT_ENABLED,
  mockStoryDetect,
  payloadFromNotification,
  resolvePlaceInstagramHandle,
  submitTicketReview,
  type PayNotificationRow,
  type TicketBillPayload,
} from '@/lib/api/pay';
import {
  isTicketFlowComplete,
  resolveTicketFlowSteps,
  STEP_DONE_LINE,
  STEP_NOW_TITLE,
  ticketProgressFromBundle,
  ticketStepDummyInstructions,
  type TicketFlowStepId,
  type TicketFlowStepView,
} from '@/lib/ticket-flow-steps';
import { errMsg } from '@/lib/utils';

export function TicketDetailsClient({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const [rows, setRows] = useState<PayNotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticketMeta, setTicketMeta] = useState<PayTicketMeta | null>(null);
  const [placeInstagramUrl, setPlaceInstagramUrl] = useState<string | null>(
    null,
  );
  const [reviewDraft, setReviewDraft] = useState<TicketReviewDraft>({
    food: 0,
    service: 0,
    ambiance: 0,
    value: 0,
    overall: 0,
    comments: '',
  });
  const [peekStepId, setPeekStepId] = useState<TicketFlowStepId | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { notifications, ticketMeta: meta, placeInstagramUrl: ig } =
        await fetchPayTicketBundle(ticketId);
      setRows(notifications);
      setTicketMeta(meta);
      setPlaceInstagramUrl(ig);
      setError(null);
    } catch (e) {
      setError(errMsg(e, "Couldn’t load ticket."));
    }
    setLoading(false);
  }, [ticketId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { notifications, ticketMeta: meta, placeInstagramUrl: ig } =
          await fetchPayTicketBundle(ticketId);
        if (cancelled) return;
        setRows(notifications);
        setTicketMeta(meta);
        setPlaceInstagramUrl(ig);
        setError(null);
      } catch (e) {
        if (!cancelled) setError(errMsg(e, "Couldn’t load ticket."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ticketId]);

  const payload = useMemo<TicketBillPayload>(() => {
    const merged: TicketBillPayload = {};
    for (const row of rows)
      Object.assign(merged, payloadFromNotification(row.payload));
    return merged;
  }, [rows]);

  const ticketKind = ticketMeta?.kind ?? payload.ticket_kind ?? 'dp';
  const reviewNotification = rows.find((r) => r.kind === 'review');
  const billNotification = rows.find((r) => r.kind === 'bill');

  const progress = useMemo(
    () =>
      ticketProgressFromBundle({
        kind: ticketKind,
        status: ticketMeta?.status,
        story_status: ticketMeta?.story_status,
        story_submitted_at: ticketMeta?.story_submitted_at,
        total_cents: ticketMeta?.total_cents ?? payload.total_cents,
        review: reviewNotification,
      }),
    [ticketKind, ticketMeta, payload.total_cents, reviewNotification],
  );

  const isComplete = isTicketFlowComplete(progress);
  const flowSteps = useMemo(() => resolveTicketFlowSteps(progress), [progress]);
  const activeStep = flowSteps.find((s) => s.state === 'active');

  const displayStepId: TicketFlowStepId = useMemo(() => {
    if (peekStepId && flowSteps.some((s) => s.id === peekStepId)) {
      const peek = flowSteps.find((s) => s.id === peekStepId)!;
      if (peek.state !== 'upcoming') return peekStepId;
    }
    return activeStep?.id ?? flowSteps[flowSteps.length - 1]?.id ?? 'scan';
  }, [peekStepId, activeStep, flowSteps]);

  const displayStep = flowSteps.find((s) => s.id === displayStepId);

  const transactionSummary = useMemo(() => {
    return isComplete
      ? buildTicketTransactionSummary(payload, ticketKind)
      : null;
  }, [isComplete, payload, ticketKind]);

  const visitDateIso =
    ticketMeta?.created_at ??
    billNotification?.created_at ??
    rows[0]?.created_at ??
    null;
  const placeName = payload.place_name ?? 'Partner place';
  const visitDateLabel = formatTicketVisitDate(visitDateIso);
  const capMxn = payload.reward_cap_mxn ?? payload.monthly_promo_cap ?? null;
  const rewardLabel = formatTicketRewardLabel(payload, { capMxn });
  const placeInstagramHandle = useMemo(
    () => resolvePlaceInstagramHandle(payload, placeInstagramUrl),
    [payload, placeInstagramUrl],
  );

  const statusLine = useMemo(() => {
    if (isComplete) return null;
    const active = flowSteps.find((s) => s.state === 'active');
    if (!active) return null;
    return `${STEP_NOW_TITLE[active.id]} — in progress`;
  }, [isComplete, flowSteps]);

  const handleStepSelect = (id: TicketFlowStepId) => {
    const step = flowSteps.find((s) => s.id === id);
    if (!step || step.state === 'upcoming') return;
    if (step.state === 'active') setPeekStepId(null);
    else setPeekStepId(id);
  };

  const onMockStoryDetect = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await mockStoryDetect(ticketId);
      await load();
    } catch (e) {
      setError(errMsg(e, "Couldn’t simulate story detection."));
    } finally {
      setBusy(false);
    }
  }, [ticketId, load]);

  const onReview = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await submitTicketReview({
        ticketId,
        ...reviewDraft,
        comments: reviewDraft.comments.trim() || undefined,
      });
      await load();
    } catch (e) {
      setError(errMsg(e, "Couldn’t submit review."));
    } finally {
      setBusy(false);
    }
  }, [ticketId, reviewDraft, load]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff7f8' }} edges={['top']}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 4,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Back to tickets"
          style={{
            borderRadius: 999,
            padding: 8,
            backgroundColor: '#ffffff',
            borderWidth: 1,
            borderColor: '#ebd9db',
          }}
        >
          <ChevronLeft color="#260409" size={16} />
        </Pressable>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#260409' }}>
          Your visit
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 12,
          paddingTop: 12,
          paddingBottom: 32,
          gap: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator color="#fb2b7b" style={{ marginTop: 40 }} />
        ) : (
          <>
            <VisitHeader
              placeName={placeName}
              placePhotoUrl={payload.place_photo_url}
              rewardLabel={rewardLabel}
              visitDateLabel={visitDateLabel}
              steps={flowSteps}
              displayStepId={displayStepId}
              onStepSelect={isComplete ? undefined : handleStepSelect}
              transactionSummaryLine={
                transactionSummary
                  ? formatTicketTransactionSummaryLine(transactionSummary)
                  : null
              }
              statusLine={statusLine}
            />

            {isComplete && transactionSummary ? (
              <VisitComplete />
            ) : displayStep ? (
              <ActionCard
                step={displayStep}
                progress={progress}
                payload={payload}
                ticketKind={ticketKind}
                capMxn={capMxn}
                placeInstagramHandle={placeInstagramHandle}
                onShowQr={() => router.push('/(tabs)/rewards')}
              >
                {renderStepActions({
                  step: displayStep,
                  busy,
                  reviewDraft,
                  onReviewDraftChange: setReviewDraft,
                  onSubmitReview: () => void onReview(),
                  onMockStoryDetect: () => void onMockStoryDetect(),
                  showMockStoryButton: MOCK_STORY_DETECT_ENABLED,
                })}
              </ActionCard>
            ) : null}

            {error ? (
              <View
                style={{
                  borderRadius: 16,
                  backgroundColor: 'rgba(220,38,38,0.08)',
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                }}
              >
                <Text style={{ color: '#dc2626', fontSize: 14 }}>{error}</Text>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function VisitComplete() {
  return (
    <View
      style={{
        borderRadius: 16,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#ebd9db',
        padding: 16,
        alignItems: 'center',
        ...SHADOW_ELEV,
      }}
    >
      <CheckCircle2 color="#059669" size={48} strokeWidth={1.75} />
      <Text
        style={{
          marginTop: 12,
          fontSize: 20,
          fontWeight: '700',
          color: '#260409',
        }}
      >
        Visit complete
      </Text>
      <Text
        style={{
          marginTop: 4,
          maxWidth: 280,
          textAlign: 'center',
          fontSize: 14,
          color: '#775254',
          lineHeight: 20,
        }}
      >
        Thanks for using Mesita at this restaurant. Your discount was applied to
        the bill.
      </Text>
    </View>
  );
}

function VisitHeader({
  placeName,
  placePhotoUrl,
  rewardLabel,
  visitDateLabel,
  steps,
  displayStepId,
  onStepSelect,
  transactionSummaryLine,
  statusLine,
}: {
  placeName: string;
  placePhotoUrl?: string | null;
  rewardLabel: string;
  visitDateLabel?: string | null;
  steps: TicketFlowStepView[];
  displayStepId: TicketFlowStepId;
  onStepSelect?: (id: TicketFlowStepId) => void;
  transactionSummaryLine?: string | null;
  statusLine?: string | null;
}) {
  const pill = {
    flex: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    justifyContent: 'center' as const,
    borderWidth: 1,
  };

  return (
    <View
      style={{
        borderRadius: 16,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: 'rgba(16,185,129,0.15)',
        overflow: 'hidden',
        ...SHADOW_ELEV,
      }}
    >
      <View style={{ padding: 16, gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View
            style={{
              width: 104,
              height: 104,
              borderRadius: 16,
              overflow: 'hidden',
              backgroundColor: '#fff7f8',
              borderWidth: 1,
              borderColor: 'rgba(235,217,219,0.7)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {placePhotoUrl ? (
              <Image
                source={{ uri: placePhotoUrl }}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
              />
            ) : (
              <MapPin color="#775254" size={24} style={{ opacity: 0.4 }} />
            )}
          </View>
          <View style={{ flex: 1, gap: 8 }}>
            <View
              style={{
                ...pill,
                backgroundColor: 'rgba(255,247,248,0.7)',
                borderColor: 'rgba(235,217,219,0.5)',
              }}
            >
              <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '600' }}>
                {placeName}
              </Text>
            </View>
            <View
              style={{
                ...pill,
                backgroundColor: 'rgba(16,185,129,0.1)',
                borderColor: 'rgba(16,185,129,0.2)',
              }}
            >
              <Text
                numberOfLines={1}
                style={{ fontSize: 14, fontWeight: '600', color: '#059669' }}
              >
                {rewardLabel}
              </Text>
            </View>
            <View
              style={{
                ...pill,
                backgroundColor: 'rgba(255,247,248,0.6)',
                borderColor: 'rgba(235,217,219,0.5)',
              }}
            >
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 14,
                  fontWeight: '500',
                  color: '#775254',
                  fontVariant: ['tabular-nums'],
                }}
              >
                {visitDateLabel ?? '—'}
              </Text>
            </View>
          </View>
        </View>

        <View
          style={{
            backgroundColor: 'rgba(255,247,248,0.5)',
            borderRadius: 16,
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderWidth: 1,
            borderColor: 'rgba(235,217,219,0.5)',
          }}
        >
          <TicketFlowStepper
            steps={steps}
            selectedStepId={displayStepId}
            onSelectStep={onStepSelect}
          />
        </View>

        {transactionSummaryLine ? (
          <LinearGradient
            colors={[...GRADIENTS.pink]}
            start={GRADIENT_DIAGONAL.start}
            end={GRADIENT_DIAGONAL.end}
            style={{ borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }}
          >
            <Text
              style={{
                color: 'rgba(255,255,255,0.8)',
                fontSize: 10,
                fontWeight: '600',
                letterSpacing: 1.2,
                textTransform: 'uppercase',
              }}
            >
              Status summary
            </Text>
            <Text
              style={{
                marginTop: 4,
                color: '#fff',
                fontSize: 12,
                fontWeight: '500',
                lineHeight: 16,
              }}
            >
              {transactionSummaryLine}
            </Text>
          </LinearGradient>
        ) : statusLine ? (
          <View
            style={{
              backgroundColor: 'rgba(255,247,248,0.7)',
              borderRadius: 16,
              paddingHorizontal: 14,
              paddingVertical: 12,
              borderWidth: 1,
              borderColor: 'rgba(235,217,219,0.5)',
            }}
          >
            <Text
              style={{
                color: '#775254',
                fontSize: 10,
                fontWeight: '600',
                letterSpacing: 1.2,
                textTransform: 'uppercase',
              }}
            >
              Status summary
            </Text>
            <Text
              style={{
                marginTop: 2,
                color: '#260409',
                fontSize: 14,
                fontWeight: '500',
              }}
            >
              {statusLine}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function ActionCard({
  step,
  progress,
  payload,
  ticketKind,
  capMxn,
  placeInstagramHandle,
  onShowQr,
  children,
}: {
  step: TicketFlowStepView;
  progress: ReturnType<typeof ticketProgressFromBundle>;
  payload: TicketBillPayload;
  ticketKind?: string | null;
  capMxn?: number | null;
  placeInstagramHandle?: string | null;
  onShowQr: () => void;
  children?: ReactNode;
}) {
  const isDone = step.state === 'done';
  const isActive = step.state === 'active';
  const isLocked = step.state === 'upcoming';
  const tips = isActive
    ? ticketStepDummyInstructions(step.id, progress, { placeInstagramHandle })
    : [];
  const showBillReceipt =
    (step.id === 'bill' || step.id === 'pay') &&
    !!payload.total_cents &&
    !isLocked;

  return (
    <View
      style={{
        borderRadius: 16,
        backgroundColor: '#ffffff',
        borderWidth: isActive ? 2 : 1,
        borderColor: isActive ? 'rgba(251,43,123,0.35)' : '#ebd9db',
        overflow: 'hidden',
        ...SHADOW_ELEV,
      }}
    >
      {isActive ? (
        <LinearGradient
          colors={[...GRADIENTS.pink]}
          start={GRADIENT_DIAGONAL.start}
          end={GRADIENT_DIAGONAL.end}
          style={{ paddingHorizontal: 16, paddingVertical: 12 }}
        >
          <StatusPill done={isDone} active={isActive} locked={isLocked} />
          <Text
            style={{
              marginTop: 8,
              fontSize: 20,
              fontWeight: '700',
              color: '#fff',
              lineHeight: 26,
            }}
          >
            {STEP_NOW_TITLE[step.id]}
          </Text>
        </LinearGradient>
      ) : (
        <View
          style={{
            paddingHorizontal: 16,
            paddingVertical: 12,
            backgroundColor: isDone
              ? 'rgba(16,185,129,0.1)'
              : 'rgba(255,247,248,0.5)',
          }}
        >
          <StatusPill done={isDone} active={isActive} locked={isLocked} />
          <Text
            style={{
              marginTop: 8,
              fontSize: 20,
              fontWeight: '700',
              color: isLocked ? '#775254' : '#260409',
              lineHeight: 26,
            }}
          >
            {STEP_NOW_TITLE[step.id]}
          </Text>
          {isDone ? (
            <Text
              style={{
                marginTop: 4,
                fontSize: 14,
                fontWeight: '500',
                color: '#059669',
              }}
            >
              {STEP_DONE_LINE[step.id]}
            </Text>
          ) : null}
        </View>
      )}

      <View style={{ padding: 16, gap: 16 }}>
        {isLocked ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 12,
              borderRadius: 16,
              backgroundColor: 'rgba(255,247,248,0.7)',
              padding: 12,
            }}
          >
            <Lock color="#775254" size={20} style={{ marginTop: 2 }} />
            <Text style={{ flex: 1, fontSize: 14, color: '#775254', lineHeight: 20 }}>
              This comes later. Finish what’s highlighted in pink above first.
            </Text>
          </View>
        ) : null}

        {isActive && tips.length > 0
          ? tips.map((line, i) => (
              <View
                key={i}
                style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}
              >
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 999,
                    backgroundColor: 'rgba(251,43,123,0.15)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#fb2b7b' }}>
                    {i + 1}
                  </Text>
                </View>
                <Text
                  style={{
                    flex: 1,
                    fontSize: 15,
                    color: '#260409',
                    lineHeight: 22,
                    paddingTop: 1,
                  }}
                >
                  {line}
                </Text>
              </View>
            ))
          : null}

        {showBillReceipt ? (
          <TicketBillReceipt
            payload={payload}
            ticketKind={ticketKind}
            capMxn={capMxn}
            placeName={payload.place_name}
          />
        ) : null}

        {step.id === 'scan' && !isLocked ? (
          <View style={{ opacity: isActive ? 1 : 0.75 }}>
            <Button
              onPress={onShowQr}
              accessibilityLabel="Show my QR code"
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <QrCode color="#fff" size={20} />
                <Text
                  style={{
                    color: '#fffafb',
                    fontWeight: '600',
                    fontSize: 14,
                  }}
                >
                  Show my QR code
                </Text>
              </View>
            </Button>
          </View>
        ) : null}

        {children}

        {isDone && step.id !== 'bill' && !children ? (
          <Text style={{ textAlign: 'center', fontSize: 14, color: '#775254' }}>
            Nothing else needed for this step.
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function StatusPill({
  done,
  active,
  locked,
}: {
  done: boolean;
  active: boolean;
  locked: boolean;
}) {
  if (active) {
    return (
      <View
        style={{
          alignSelf: 'flex-start',
          borderRadius: 999,
          backgroundColor: 'rgba(255,255,255,0.2)',
          paddingHorizontal: 10,
          paddingVertical: 2,
        }}
      >
        <Text
          style={{
            color: '#fff',
            fontSize: 10,
            fontWeight: '700',
            letterSpacing: 0.8,
            textTransform: 'uppercase',
          }}
        >
          Do this now
        </Text>
      </View>
    );
  }
  if (done) {
    return (
      <View
        style={{
          alignSelf: 'flex-start',
          borderRadius: 999,
          backgroundColor: 'rgba(16,185,129,0.15)',
          paddingHorizontal: 10,
          paddingVertical: 2,
        }}
      >
        <Text
          style={{
            color: '#059669',
            fontSize: 10,
            fontWeight: '700',
            letterSpacing: 0.8,
            textTransform: 'uppercase',
          }}
        >
          Done
        </Text>
      </View>
    );
  }
  if (locked) {
    return (
      <View
        style={{
          alignSelf: 'flex-start',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          borderRadius: 999,
          backgroundColor: 'rgba(255,255,255,0.8)',
          paddingHorizontal: 10,
          paddingVertical: 2,
        }}
      >
        <Lock color="#775254" size={12} />
        <Text
          style={{
            color: '#775254',
            fontSize: 10,
            fontWeight: '700',
            letterSpacing: 0.8,
            textTransform: 'uppercase',
          }}
        >
          Later
        </Text>
      </View>
    );
  }
  return null;
}

function renderStepActions({
  step,
  busy,
  reviewDraft,
  onReviewDraftChange,
  onSubmitReview,
  onMockStoryDetect,
  showMockStoryButton,
}: {
  step: TicketFlowStepView;
  busy: boolean;
  reviewDraft: TicketReviewDraft;
  onReviewDraftChange: (d: TicketReviewDraft) => void;
  onSubmitReview: () => void;
  onMockStoryDetect?: () => void;
  showMockStoryButton?: boolean;
}): ReactNode {
  if (step.state !== 'active') return null;

  if (step.id === 'story' && showMockStoryButton && onMockStoryDetect) {
    return (
      <Button
        variant="outline"
        onPress={onMockStoryDetect}
        disabled={busy}
        loading={busy}
        accessibilityLabel="Mock: story posted and detected"
      >
        Mock: story posted & detected
      </Button>
    );
  }

  if (step.id === 'review') {
    return (
      <TicketReviewForm
        draft={reviewDraft}
        onChange={onReviewDraftChange}
        onSubmit={onSubmitReview}
        busy={busy}
        showIntro={false}
      />
    );
  }

  return null;
}
