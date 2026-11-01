/**
 * Shared section header — sentence-case title + quiet text action.
 */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { typographyKit } from '@/constants/theme';
import { AppIcon } from '@/components/icons/AppIcon';
import { jakartaSemiboldText } from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';
import { FitText } from '@/components/kit/FitText';

type Props = {
  title: string;
  actionLabel?: string;
  /** Spoken label; defaults to `actionLabel`. */
  actionAccessibilityLabel?: string;
  onAction?: () => void;
  /** Leading control (e.g. section drag handle). */
  leading?: ReactNode;
  /** Custom trailing control(s). When set, replaces the text action. */
  trailing?: ReactNode;
};

export function ProtoSectionHeader({
  title,
  actionLabel,
  actionAccessibilityLabel,
  onAction,
  leading,
  trailing,
}: Props) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.row} collapsable={false} pointerEvents="box-none">
      {leading ? (
        <View style={styles.leading} collapsable={false} pointerEvents="box-none">
          {leading}
        </View>
      ) : null}
      {/*
        Wrap title — Android Text `pointerEvents` is unreliable; a View with
        pointerEvents="none" keeps the flex title from stealing header taps.
      */}
      <View style={styles.titleWrap} pointerEvents="none">
        <FitText style={[styles.title, { color: colors.text }]}>
          {title}
        </FitText>
      </View>
      {trailing ? (
        <View
          style={styles.trailing}
          collapsable={false}
          pointerEvents="auto"
          renderToHardwareTextureAndroid={false}
        >
          {trailing}
        </View>
      ) : actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionAccessibilityLabel ?? actionLabel}
          hitSlop={10}
          onPress={() => {
            tapHaptic();
            onAction();
          }}
          style={styles.actionPressable}
        >
          {({ pressed }) => (
            // Layout on an inner View: Android does not reliably apply Pressable style functions.
            <View style={[styles.action, pressed && { opacity: 0.6 }]}>
              {/^(ajouter|nouveau|créer)/i.test(actionLabel) ? (
                <AppIcon family="ionicons" name="add" size={16} color={colors.textMuted} />
              ) : null}
              <Text
                style={[styles.actionText, { color: colors.textMuted }]}
                numberOfLines={1}
                maxFontSizeMultiplier={1.3}
              >
                {actionLabel}
              </Text>
              {/^(ajouter|nouveau|créer)/i.test(actionLabel) ? null : (
                <AppIcon family="ionicons" name="chevron-forward" size={15} color={colors.textMuted} />
              )}
            </View>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  actionPressable: { flexShrink: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    overflow: 'visible',
    zIndex: 2,
  },
  leading: {
    flexGrow: 0,
    flexShrink: 0,
    marginRight: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    marginRight: 8,
  },
  title: {
    ...jakartaSemiboldText,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  trailing: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    elevation: 8,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flexGrow: 0,
    flexShrink: 0,
  },
  actionText: {
    ...typographyKit.metaSemibold,
    fontSize: 14,
    lineHeight: 18,
  },
});
