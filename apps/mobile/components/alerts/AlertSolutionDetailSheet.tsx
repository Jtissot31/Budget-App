import { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import { BottomSheet } from '@/components/BottomSheet';
import { OnyxContainer } from '@/components/OnyxContainer';
import { ONYX_CONTAINER, planFinanceKit } from '@/constants/planFinanceKit';
import { spacing, typographyKit } from '@/constants/theme';
import {
  alertSolutionOptionIcon,
  type AlertSolution,
} from '@/lib/alertPresentation';
import { resolveUserPickedIconWellBackground } from '@/lib/userPickedIcon';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  visible: boolean;
  solution: AlertSolution | null;
  onClose: () => void;
  /** Navigate / continue when the option already has a real flow (`href`). */
  onContinue?: (solution: AlertSolution) => void;
};

/**
 * Contextual sheet for an alert OPTION — title, fuller explanation, Fermer / Continuer.
 */
export function AlertSolutionDetailSheet({
  visible,
  solution,
  onClose,
  onContinue,
}: Props) {
  const { colors, isLight } = useAppTheme();
  const wellBg = resolveUserPickedIconWellBackground(isLight);
  const heldRef = useRef<AlertSolution | null>(null);
  if (solution) heldRef.current = solution;
  const active = solution ?? heldRef.current;

  if (!active) return null;

  const optionIcon = alertSolutionOptionIcon(active);
  const detail = active.detailBody?.trim() || active.description;
  const canContinue = Boolean(active.href) && Boolean(onContinue);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Option"
      scrollable
      heightRatio={0.48}
      initialSnap="collapsed"
    >
      <View style={styles.body}>
        <OnyxContainer style={styles.card}>
          <View style={[styles.iconWell, { backgroundColor: wellBg }]}>
            <AppIcon
              family={optionIcon.family}
              name={optionIcon.name}
              size={22}
              color={colors.text}
            />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>{active.title}</Text>
          <Text style={[styles.detail, { color: colors.textMuted }]}>{detail}</Text>
        </OnyxContainer>

        <View style={styles.actions}>
          {canContinue ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={active.ctaLabel}
              onPress={() => onContinue?.(active)}
              style={({ pressed }) => [
                styles.primaryBtn,
                {
                  backgroundColor: colors.primary,
                  opacity: pressed ? ONYX_CONTAINER.pressedOpacity : 1,
                },
              ]}
            >
              <Text style={[styles.primaryLabel, { color: colors.background }]}>
                Continuer
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fermer"
            onPress={onClose}
            style={({ pressed }) => [
              styles.secondaryBtn,
              {
                backgroundColor: colors.modalAction,
                borderColor: colors.containerBorder,
                opacity: pressed ? ONYX_CONTAINER.pressedOpacity : 1,
              },
            ]}
          >
            <Text style={[styles.secondaryLabel, { color: colors.text }]}>Fermer</Text>
          </Pressable>
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: spacing.lg,
    paddingBottom: spacing.sm,
  },
  card: {
    padding: ONYX_CONTAINER.padding.card,
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  iconWell: {
    width: 48,
    height: 48,
    borderRadius: planFinanceKit.radius.small + 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typographyKit.sectionTitle,
  },
  detail: {
    ...typographyKit.bodyMedium,
  },
  actions: {
    gap: spacing.sm,
  },
  primaryBtn: {
    alignSelf: 'stretch',
    borderRadius: planFinanceKit.radius.button,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
  },
  primaryLabel: {
    ...typographyKit.caption,
  },
  secondaryBtn: {
    alignSelf: 'stretch',
    borderRadius: planFinanceKit.radius.button,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  secondaryLabel: {
    ...typographyKit.captionSemibold,
  },
});
