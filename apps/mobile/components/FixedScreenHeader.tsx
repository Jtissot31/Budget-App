/**
 * Fixed (not sticky) page header — pinned above the scroll viewport.
 *
 * Layout rule: render OUTSIDE ScrollView / FlatList. Only body content scrolls.
 * Do not place this inside scroll content or use stickyHeaderIndices.
 */
import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '@/components/icons/AppIcon';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import { jakartaExtraBoldText, spacing, typography } from '@/constants/theme';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  title: string;
  onBack: () => void;
  /** Right-side control (overflow menu, spacer, etc.). Defaults to a 38px spacer. */
  trailing?: ReactNode;
  /** Extra top inset beyond safe area + gutter (detail screens use lg+md). */
  extraTopPadding?: number;
  style?: StyleProp<ViewStyle>;
  backAccessibilityLabel?: string;
};

export function FixedScreenHeader({
  title,
  onBack,
  trailing,
  extraTopPadding = spacing.lg + spacing.md,
  style,
  backAccessibilityLabel = 'Retour',
}: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();

  return (
    <View
      style={[
        styles.topBar,
        { paddingTop: insets.top + SCREEN_TOP_GUTTER + extraTopPadding },
        style,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={backAccessibilityLabel}
        hitSlop={12}
        style={({ pressed }) => [
          styles.backButton,
          { backgroundColor: colors.containerBackground, borderColor: colors.containerBorder },
          pressed && styles.pressed,
        ]}
        onPress={onBack}
      >
        <AppIcon family="ionicons" name="chevron-back" size={22} color={colors.text} />
      </Pressable>
      <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
        {title}
      </Text>
      {trailing ?? <View style={styles.topBarSpacer} />}
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    marginHorizontal: spacing.sm,
    ...jakartaExtraBoldText,
    fontSize: typography.body,
    letterSpacing: -0.2,
  },
  topBarSpacer: { width: 38 },
  pressed: { opacity: 0.78 },
});
