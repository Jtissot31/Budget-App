import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  InteractionManager,
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
  jakartaBoldText,
  jakartaExtraBoldText,
  jakartaMediumText,
  jakartaRegularText,
  PAGE_PADDING_HORIZONTAL,
  spacing,
} from '@/constants/theme';
import {
  finishAppTour,
  getAppTourStopIndex,
  isAppTourActive,
  setAppTourStopIndex,
  subscribeAppTourActive,
} from '@/lib/appTour';
import {
  getCachedAppTourTargetRect,
  measureAppTourTarget,
  revealAppTourTarget,
  subscribeAppTourTargets,
  type TourTargetRect,
} from '@/lib/appTourTargets';
import { tapHaptic } from '@/lib/haptics';
import { ONBOARDING_TOUR_STOPS } from '@/lib/onboardingTour';
import { useAppTheme } from '@/lib/themeContext';

const SPOTLIGHT_PAD = 8;
const TOOLTIP_GAP = 14;
/** Settle delays after tab nav / density-driven bar height changes. */
const MEASURE_RETRY_MS = [0, 32, 80, 160, 280, 450, 700] as const;
/** Overlay dim — light enough that the real page stays readable. */
const DIM_COLOR = 'rgba(0, 0, 0, 0.48)';

function inflateRect(rect: TourTargetRect, pad: number): TourTargetRect {
  return {
    x: Math.max(0, rect.x - pad),
    y: Math.max(0, rect.y - pad),
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  };
}

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitNextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

/** Match expo-router pathnames like `/(tabs)/transactions` to tour hrefs (`/transactions`). */
function pathMatchesTourHref(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (href === '/') {
    return (
      pathname === '/' ||
      pathname === '/index' ||
      pathname.endsWith('/(tabs)') ||
      pathname.endsWith('/(tabs)/') ||
      pathname.endsWith('/(tabs)/index')
    );
  }
  return pathname === href || pathname.endsWith(href);
}

export function AppGuidedTour() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { colors } = useAppTheme();

  const [active, setActive] = useState(isAppTourActive);
  const [stopIndex, setStopIndex] = useState(getAppTourStopIndex);
  const [hole, setHole] = useState<TourTargetRect | null>(null);
  const refreshGen = useRef(0);

  const stop = ONBOARDING_TOUR_STOPS[stopIndex] ?? ONBOARDING_TOUR_STOPS[0];
  const isLast = stopIndex >= ONBOARDING_TOUR_STOPS.length - 1;

  const updateStopIndex = useCallback((index: number) => {
    const next = Math.max(0, Math.min(index, ONBOARDING_TOUR_STOPS.length - 1));
    setAppTourStopIndex(next);
    setStopIndex(next);
  }, []);

  useEffect(() => {
    // Auto-start after onboarding is disabled — overlay blocked the main tabs.
    // Keep subscription so an explicit `startAppTour()` still drives UI if remounted.
    const unsubActive = subscribeAppTourActive((nextActive) => {
      setActive(nextActive);
      if (nextActive) {
        setStopIndex(getAppTourStopIndex());
      }
    });
    return () => {
      unsubActive();
    };
  }, []);

  const navigateToStop = useCallback(
    (index: number) => {
      const next = ONBOARDING_TOUR_STOPS[index];
      if (!next) return;
      if (!pathMatchesTourHref(pathname, next.href)) {
        router.navigate(next.href);
      }
      if (next.targetId === 'fyn-entry') {
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

    const gen = ++refreshGen.current;
    const targetId = stop.targetId;

    // Show last known bounds immediately so the hole doesn't jump to a fixed Y.
    const cached = getCachedAppTourTargetRect(targetId);
    if (cached && gen === refreshGen.current) {
      setHole(inflateRect(cached, SPOTLIGHT_PAD));
    }

    await new Promise<void>((resolve) => {
      InteractionManager.runAfterInteractions(() => resolve());
    });
    if (gen !== refreshGen.current) return;

    let measured: TourTargetRect | null = null;
    for (const delay of MEASURE_RETRY_MS) {
      if (delay > 0) {
        await waitMs(delay);
      } else {
        await waitNextFrame();
        await waitNextFrame();
      }
      if (gen !== refreshGen.current) return;

      if (targetId === 'fyn-entry') {
        revealAppTourTarget('fyn-entry');
      }

      measured = await measureAppTourTarget(targetId);
      if (measured) break;
    }

    if (gen !== refreshGen.current) return;

    if (measured) {
      setHole(inflateRect(measured, SPOTLIGHT_PAD));
      return;
    }

    // Keep prior hole if we already painted from cache; otherwise clear.
    if (!cached) {
      setHole(null);
    }
  }, [active, stop]);

  useEffect(() => {
    if (!active) return;
    void refreshHole();
    let layoutDebounce: ReturnType<typeof setTimeout> | null = null;
    const unsub = subscribeAppTourTargets(() => {
      // Tab slots + pill often layout in a burst; coalesce before remasuring.
      if (layoutDebounce) clearTimeout(layoutDebounce);
      layoutDebounce = setTimeout(() => {
        void refreshHole();
      }, 16);
    });
    return () => {
      if (layoutDebounce) clearTimeout(layoutDebounce);
      unsub();
    };
  }, [active, pathname, refreshHole, screenHeight, screenWidth, stopIndex, insets.bottom]);

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
    updateStopIndex(0);
    setHole(null);
    router.navigate('/');
  }, [router, updateStopIndex]);

  const goNext = useCallback(() => {
    tapHaptic();
    if (isLast) {
      void complete();
      return;
    }
    updateStopIndex(Math.min(stopIndex + 1, ONBOARDING_TOUR_STOPS.length - 1));
  }, [complete, isLast, stopIndex, updateStopIndex]);

  if (!active) return null;

  const ringRadius = hole
    ? Math.max(14, Math.min(hole.width, hole.height) / 2)
    : 16;

  return (
    // Absolute overlay (not RN Modal) — avoids web Modal hit-testing bugs where
    // dim siblings sit above Suivant. Covers tabs; lives outside swipe GestureDetector.
    <View style={styles.root} accessibilityViewIsModal>
      {/* Blocks interaction with the app while the tour is active. */}
      <View style={styles.blocker} />

      {/* Visual dim + spotlight only — never steal presses from the tooltip. */}
      <View style={styles.visualLayer} pointerEvents="none">
        {hole ? (
          <>
            <View style={[styles.dim, { top: 0, left: 0, right: 0, height: hole.y, backgroundColor: DIM_COLOR }]} />
            <View
              style={[
                styles.dim,
                {
                  top: hole.y,
                  left: 0,
                  width: hole.x,
                  height: hole.height,
                  backgroundColor: DIM_COLOR,
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
                  backgroundColor: DIM_COLOR,
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
                  backgroundColor: DIM_COLOR,
                },
              ]}
            />
            <MotiView
              key={stop.id}
              from={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'timing', duration: 220 }}
              style={[
                styles.ring,
                {
                  top: hole.y,
                  left: hole.x,
                  width: hole.width,
                  height: hole.height,
                  borderRadius: ringRadius,
                  borderColor: colors.accentGreen,
                },
              ]}
            />
          </>
        ) : (
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: DIM_COLOR }]} />
        )}
      </View>

      <View
        pointerEvents="box-none"
        style={[
          styles.tooltipWrap,
          {
            paddingHorizontal: PAGE_PADDING_HORIZONTAL,
            ...tooltipPlacement,
          },
        ]}
      >
        <MotiView
          key={`tip-${stop.id}`}
          from={{ opacity: 0, translateY: 10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 240 }}
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    elevation: 100,
  },
  blocker: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  visualLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  dim: {
    position: 'absolute',
  },
  ring: {
    position: 'absolute',
    borderWidth: 2,
  },
  tooltipWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 3,
    elevation: 3,
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
