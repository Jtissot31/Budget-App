/**
 * Shared Budget Proto section chrome — eyebrow + trailing action(s).
 */
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { typographyKit } from '@/constants/theme';
import { PillButton } from '@/components/kit/PillButton';
import { useAppTheme } from '@/lib/themeContext';

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
        <Text style={[styles.title, { color: colors.textMuted }]} numberOfLines={1}>
          {title}
        </Text>
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
        <PillButton
          label={actionLabel}
          accessibilityLabel={actionAccessibilityLabel ?? actionLabel}
          icon={/^(ajouter|nouveau|créer)/i.test(actionLabel) ? 'add' : 'chevron-forward'}
          onPress={onAction}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
    ...typographyKit.eyebrow,
    fontSize: 11,
    letterSpacing: 0.8,
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
    fontSize: 11,
  },
});
