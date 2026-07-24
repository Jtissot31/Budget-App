import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { MotiView } from 'moti';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OnyxContainer } from '@/components/OnyxContainer';
import { ONYX_CONTAINER } from '@/constants/planFinanceKit';
import {
  FLOATING_TAB_BAR_PILL_HEIGHT,
  getFloatingTabBarBottomInset,
  jakartaBoldText,
  jakartaExtraBoldText,
  jakartaMediumText,
  jakartaRegularText,
  PAGE_PADDING_HORIZONTAL,
  spacing,
} from '@/constants/theme';
import {
  finishAppTour,
  isAppTourActive,
  maybeStartPendingAppTour,
  subscribeAppTourActive,
} from '@/lib/appTour';
import {
  measureAppTourTarget,
  revealAppTourTarget,
  subscribeAppTourTargets,
  type TourTargetRect,
} from '@/lib/appTourTargets';
import { tapHaptic } from '@/lib/haptics';
import { subscribeOnboardingCompleted } from '@/lib/onboarding';
import { ONBOARDING_TOUR_STOPS } from '@/lib/onboardingTour';
import { useAppTheme } from '@/lib/themeContext';

const SPOTLIGHT_PAD = 8;
const TOOLTIP_GAP = 14;
const MEASURE_RETRY_MS = [0, 80, 180, 320, 500] as const;

function inflateRect(rect: TourTargetRect, pad: number): TourTargetRect {
  return {
    x: Math.max(0, rect.x - pad),
    y: Math.max(0, rect.y - pad),
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  };
}

function fallbackTabRect(
  targetId: string,
  screenWidth: number,
  screenHeight: number,
  safeBottom: number,
): TourTargetRect | null {
  const tabOrder = [
    'tab:index',
    'tab:transactions',
    'tab:goals',
    'tab:accounts',
    'tab:budgets',
  ] as const;
  const index = tabOrder.indexOf(targetId as (typeof tabOrder)[number]);
  if (index < 0) return null;

  const bottom = getFloatingTabBarBottomInset(safeBottom);
  const pillLeft = spacing.lg;
  const pillWidth = screenWidth - spacing.lg * 2;
  const slotWidth = pillWidth / tabOrder.length;
  const pillHeight = FLOATING_TAB_BAR_PILL_HEIGHT;
  const pillTop = screenHeight - bottom - pillHeight;

  return {
    x: pillLeft + slotWidth * index + slotWidth * 0.15,
    y: pillTop + 4,
    width: slotWidth * 0.7,
    height: pillHeight - 8,
  };
}

export function AppGuidedTour() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { colors } = useAppTheme();

  const [active, setActive] = useState(isAppTourActive);
  const [stopIndex, setStopIndex] = useState(0);
  const [hole, setHole] = useState<TourTargetRect | null>(null);

  const stop = ONBOARDING_TOUR_STOPS[stopIndex] ?? ONBOARDING_TOUR_STOPS[0];
  const isLast = stopIndex >= ONBOARDING_TOUR_STOPS.length - 1;

  useEffect(() => {
    const unsubActive = subscribeAppTourActive(setActive);
    const unsubOnboarding = subscribeOnboardingCompleted((done) => {
      if (done) void maybeStartPendingAppTour();
    });
    void maybeStartPendingAppTour();
    return () => {
      unsubActive();
      unsubOnboarding();
    };
  }, []);

  const navigateToStop = useCallback(
    (index: number) => {
      const next = ONBOARDING_TOUR_STOPS[index];
      if (!next) return;
      if (pathname !== next.href) {
        router.navigate(next.href);
      }
      if (next.targetId === 'fyn-entry') {
        // Let the hub mount, then scroll the card into view.
        requestAnimationFrame(() => {
          revealAppTourTarget('fyn-entry');
        });
      }
    },
    [pathname, router],
  );

  useEffect(() => {
    if (!active) return;
    navigateToStop(stopIndex);
  }, [active, navigateToStop, stopIndex]);

  const refreshHole = useCallback(async () => {
    if (!active || !stop) {
      setHole(null);
      return;
    }

    let measured: TourTargetRect | null = null;
    for (const delay of MEASURE_RETRY_MS) {
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
      if (stop.targetId === 'fyn-entry') {
        revealAppTourTarget('fyn-entry');
      }
      measured = await measureAppTourTarget(stop.targetId);
      if (measured) break;
    }

    if (!measured) {
      measured = fallbackTabRect(stop.targetId, screenWidth, screenHeight, insets.bottom);
    }

    setHole(measured ? inflateRect(measured, SPOTLIGHT_PAD) : null);
  }, [active, insets.bottom, screenHeight, screenWidth, stop]);

  useEffect(() => {
    if (!active) return;
    void refreshHole();
    const unsub = subscribeAppTourTargets(() => {
      void refreshHole();
    });
    return unsub;
  }, [active, pathname, refreshHole, stopIndex]);

  const tooltipPlacement = useMemo(() => {
    if (!hole) {
      return { top: Math.max(insets.top + spacing.xl, screenHeight * 0.28) };
    }
    const tooltipApproxHeight = 168;
    const spaceAbove = hole.y - insets.top;
    const spaceBelow = screenHeight - (hole.y + hole.height) - insets.bottom;
    if (spaceAbove >= tooltipApproxHeight + TOOLTIP_GAP || spaceAbove > spaceBelow) {
      return {
        bottom: screenHeight - hole.y + TOOLTIP_GAP,
      };
    }
    return {
      top: hole.y + hole.height + TOOLTIP_GAP,
    };
  }, [hole, insets.bottom, insets.top, screenHeight]);

  const complete = useCallback(async () => {
    tapHaptic();
    await finishAppTour();
    setStopIndex(0);
    setHole(null);
    router.navigate('/');
  }, [router]);

  const goNext = useCallback(() => {
    tapHaptic();
    if (isLast) {
      void complete();
      return;
    }
    setStopIndex((current) => Math.min(current + 1, ONBOARDING_TOUR_STOPS.length - 1));
  }, [complete, isLast]);

  if (!active) return null;

  const dimColor = 'rgba(0, 0, 0, 0.72)';

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={styles.root} pointerEvents="box-none">
        {hole ? (
          <>
            <View style={[styles.dim, { top: 0, left: 0, right: 0, height: hole.y, backgroundColor: dimColor }]} />
            <View
              style={[
                styles.dim,
                {
                  top: hole.y,
                  left: 0,
                  width: hole.x,
                  height: hole.height,
                  backgroundColor: dimColor,
                },
              ]}
            />
            <View
              style={[
                styles.dim,
                {
                  top: hole.y,
                  left: hole.x + hole.width,
                  right: 0,
                  height: hole.height,
                  backgroundColor: dimColor,
                },
              ]}
            />
            <View
              style={[
                styles.dim,
                {
                  top: hole.y + hole.height,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: dimColor,
                },
              ]}
            />
            <MotiView
              key={stop.id}
              from={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'timing', duration: 220 }}
              pointerEvents="none"
              style={[
                styles.ring,
                {
                  top: hole.y,
                  left: hole.x,
                  width: hole.width,
                  height: hole.height,
                  borderColor: colors.accentGreen,
                },
              ]}
            />
          </>
        ) : (
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: dimColor }]} />
        )}

        <MotiView
          key={`tip-${stop.id}`}
          from={{ opacity: 0, translateY: 10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 240 }}
          style={[
            styles.tooltipWrap,
            {
              paddingHorizontal: PAGE_PADDING_HORIZONTAL,
              ...tooltipPlacement,
            },
          ]}
        >
          <OnyxContainer style={styles.tooltipCard}>
            <View style={styles.tooltipHeader}>
              <Text style={[styles.eyebrow, { color: colors.textMuted }]}>
                Visite guidée · {stopIndex + 1}/{ONBOARDING_TOUR_STOPS.length}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Passer la visite"
                hitSlop={10}
                onPress={() => void complete()}
                style={({ pressed }) => [pressed && { opacity: 0.7 }]}
              >
                <Text style={[styles.skip, { color: colors.textMuted }]}>Passer</Text>
              </Pressable>
            </View>

            <Text style={[styles.title, { color: colors.text }]}>{stop.title}</Text>
            <Text style={[styles.body, { color: colors.textMuted }]}>{stop.body}</Text>

            <View style={styles.dots}>
              {ONBOARDING_TOUR_STOPS.map((item, index) => {
                const isActive = index === stopIndex;
                const done = index < stopIndex;
                return (
                  <View
                    key={item.id}
                    style={[
                      styles.dot,
                      {
                        backgroundColor: isActive || done ? colors.accentGreen : colors.borderSubtle,
                        opacity: isActive ? 1 : done ? 0.5 : 1,
                        width: isActive ? 16 : 6,
                      },
                    ]}
                  />
                );
              })}
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isLast ? 'Terminer' : 'Suivant'}
              onPress={goNext}
              style={({ pressed }) => [
                styles.primaryBtn,
                { backgroundColor: colors.accentGreen },
                pressed && { opacity: 0.82 },
              ]}
            >
              <Text style={[styles.primaryLabel, { color: colors.background }]}>
                {isLast ? 'Terminer' : 'Suivant'}
              </Text>
            </Pressable>
          </OnyxContainer>
        </MotiView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  dim: {
    position: 'absolute',
  },
  ring: {
    position: 'absolute',
    borderRadius: 16,
    borderWidth: 2,
  },
  tooltipWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  tooltipCard: {
    padding: ONYX_CONTAINER.padding.card,
    gap: spacing.sm,
  },
  tooltipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  eyebrow: {
    ...jakartaMediumText,
    fontSize: 12,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  skip: {
    ...jakartaMediumText,
    fontSize: 14,
  },
  title: {
    ...jakartaExtraBoldText,
    fontSize: 22,
    letterSpacing: -0.3,
  },
  body: {
    ...jakartaRegularText,
    fontSize: 15,
    lineHeight: 22,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: spacing.xs,
  },
  dot: {
    height: 6,
    borderRadius: 999,
  },
  primaryBtn: {
    marginTop: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: ONYX_CONTAINER.borderRadius,
    paddingVertical: 14,
  },
  primaryLabel: {
    ...jakartaBoldText,
    fontSize: 16,
  },
});
