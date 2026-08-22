/**
 * Portefeuille progress row — OBJECTIFS D'ÉPARGNE template (Fonds d’urgence).
 * Shared by savings goals and prêts / obligations.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import { UserPickedIconWell } from '@/components/UserPickedIconWell';
import { moneyAmountTypography, typographyKit } from '@/constants/theme';
import { useAppTheme } from '@/lib/themeContext';

const CHECK = 22;

type Props = {
  icon: string;
  title: string;
  /** 0–1 progress toward completion (paid-off or saved). */
  pct: number;
  currentOverTotal: string;
  remainingLabel: string;
  done: boolean;
  /** Optional left caption under the title (e.g. goal deadline). */
  leftMeta?: string;
  managing?: boolean;
  selected?: boolean;
  showTopDivider?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  accessibilityLabel: string;
};

function SelectCheck({ selected, borderColor }: { selected: boolean; borderColor: string }) {
  return (
    <View
      style={[
        styles.checkWell,
        {
          backgroundColor: selected ? '#FFFFFF' : 'transparent',
          borderColor: selected ? '#FFFFFF' : borderColor,
        },
      ]}
    >
      {selected ? (
        <AppIcon family="ionicons" name="checkmark" size={14} color="#0D0D0F" />
      ) : null}
    </View>
  );
}

export function WalletProgressGoalRow({
  icon,
  title,
  pct,
  currentOverTotal,
  remainingLabel,
  done,
  leftMeta = '',
  managing = false,
  selected = false,
  showTopDivider = false,
  onPress,
  onLongPress,
  accessibilityLabel,
}: Props) {
  const { colors, isLight } = useAppTheme();
  const clamped = Math.max(0, Math.min(1, pct));
  const fillColor = done
    ? colors.accentGreen
    : isLight
      ? colors.text
      : 'rgba(255,255,255,0.28)';

  return (
    <Pressable
      accessibilityRole={managing ? 'checkbox' : 'button'}
      accessibilityState={managing ? { selected } : undefined}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={380}
      style={({ pressed }) => [
        styles.row,
        showTopDivider && {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.borderSubtle,
        },
        managing && selected && { backgroundColor: 'rgba(255,255,255,0.04)' },
        pressed && { opacity: 0.85 },
      ]}
    >
      <View style={styles.header}>
        {managing ? (
          <SelectCheck selected={selected} borderColor={colors.borderStrong} />
        ) : (
          <View style={[styles.iconWell, { backgroundColor: colors.surfaceElevated }]}>
            <UserPickedIconWell
              icon={icon}
              color={colors.textMuted}
              size={28}
              iconSize={15}
              noBackground
            />
          </View>
        )}
        <View style={styles.copy}>
          <View style={styles.titleRow}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
              {title}
            </Text>
            <Text
              style={[
                moneyAmountTypography({ tier: 'row', fontSize: 12 }),
                {
                  color: done ? colors.accentGreen : colors.textSecondary,
                  flexShrink: 0,
                },
              ]}
            >
              {Math.round(clamped * 100)}%
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={[styles.meta, { color: colors.textMuted }]}>{leftMeta}</Text>
            <Text
              style={[
                styles.meta,
                { color: colors.textMuted, flexShrink: 1, textAlign: 'right' },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {currentOverTotal}
            </Text>
          </View>
        </View>
      </View>
      <View style={[styles.track, { backgroundColor: colors.borderSubtle }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${clamped * 100}%`,
              backgroundColor: fillColor,
            },
          ]}
        />
      </View>
      <Text
        style={[
          styles.remaining,
          { color: done ? colors.accentGreen : colors.textMuted },
        ]}
      >
        {remainingLabel}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 16, paddingVertical: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 10 },
  iconWell: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 8,
  },
  name: { ...typographyKit.rowTitle, fontSize: 13, flex: 1, minWidth: 0, lineHeight: 17 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  meta: { ...typographyKit.micro, fontSize: 10 },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 2 },
  remaining: { ...typographyKit.micro, fontSize: 10, marginTop: 5 },
  checkWell: {
    width: CHECK,
    height: CHECK,
    borderRadius: CHECK / 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
