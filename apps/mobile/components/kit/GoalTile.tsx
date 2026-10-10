/**
 * GoalTile — savings goal card for 2-column grids: green progress ring around the
 * goal icon, big percentage, saved / target and what's left. Visual and quick to read.
 */
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import { jakartaMediumText, jakartaSemiboldText, moneyAmountTypography } from '@/constants/theme';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';
import { RingGauge } from './charts';
import { FitText } from './FitText';
import { PressScale } from './motion';

type Props = {
  name: string;
  icon: ReactNode;
  saved: number;
  target: number;
  /** Mask amounts (Wallet œil). */
  hidden?: boolean;
  selecting?: boolean;
  selected?: boolean;
  onPress: () => void;
};

export function GoalTile({ name, icon, saved, target, hidden = false, selecting = false, selected = false, onPress }: Props) {
  const { colors } = useAppTheme();
  const progress = target > 0 ? Math.min(1, saved / target) : 0;
  const pct = Math.round(progress * 100);
  const done = progress >= 1;
  const left = Math.max(0, target - saved);

  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${pct} %`}
      scaleTo={0.96}
      onPress={() => {
        tapHaptic();
        onPress();
      }}
      style={[
        styles.tile,
        {
          backgroundColor: colors.containerBackground,
          borderColor: selected ? colors.text : done ? 'rgba(34,197,94,0.45)' : colors.containerBorder,
        },
      ]}
    >
      <View style={styles.top}>
        <RingGauge progress={progress} color={colors.accentGreen} size={54} stroke={5}>
          <View style={[styles.iconWell, { backgroundColor: colors.surfaceElevated }]}>{icon}</View>
        </RingGauge>
        {selecting ? (
          <AppIcon
            family="ionicons"
            name={selected ? 'checkmark-circle' : 'ellipse-outline'}
            size={22}
            color={selected ? colors.text : colors.textMuted}
          />
        ) : (
          <Text style={[styles.pct, jakartaSemiboldText, { color: colors.accentGreen }]}>{pct} %</Text>
        )}
      </View>
      <FitText style={[styles.name, jakartaSemiboldText, { color: colors.text }]} fontSize={14} lineHeight={18} minScale={0.75}>
        {name}
      </FitText>
      <FitText
        style={[moneyAmountTypography({ tier: 'stat', fontSize: 20 }), { color: colors.text }]}
        fontSize={20}
        lineHeight={25}
        minScale={0.6}
      >
        {hidden ? '••••' : formatDisplayMoneyAbsolute(saved)}
      </FitText>
      <Text style={[styles.meta, jakartaMediumText, { color: colors.textMuted }]} numberOfLines={1}>
        {hidden ? 'sur ••••' : `sur ${formatDisplayMoneyAbsolute(target)}`}
      </Text>
      <Text
        style={[styles.left, jakartaMediumText, { color: done ? colors.accentGreen : colors.textSecondary }]}
        numberOfLines={1}
      >
        {done ? 'Objectif atteint 🎉' : hidden ? '' : `Encore ${formatDisplayMoneyAbsolute(left)}`}
      </Text>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  tile: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 2 },
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 },
  iconWell: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  pct: { fontSize: 13 },
  name: { letterSpacing: -0.2 },
  meta: { fontSize: 11.5, marginTop: -2 },
  left: { fontSize: 11.5, marginTop: 6 },
});
