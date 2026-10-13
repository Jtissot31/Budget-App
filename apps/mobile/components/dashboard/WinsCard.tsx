/**
 * Accueil « Tes victoires » — one quiet line under the page title: the top wins, each a
 * small green icon + short label. No badge, no headline, no container. A success haptic
 * plays at most once a day when there is something to celebrate.
 * With nothing to celebrate yet, a single « Noter une dépense » link instead.
 */
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppIcon } from '@/components/icons/AppIcon';
import { Reveal } from '@/components/kit/motion';
import { jakartaMediumText, jakartaSemiboldText } from '@/constants/theme';
import { successHaptic, tapHaptic } from '@/lib/haptics';
import type { HomeWins } from '@/lib/homeWins';
import { useAppTheme } from '@/lib/themeContext';

const HAPTIC_DAY_KEY = 'home-wins-haptic-day';
/** Two wins fit on one line on a phone; more would wrap or crowd. */
const MAX_INLINE_WINS = 2;

function todayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

export function WinsCard({ wins }: { wins: HomeWins }) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const celebrate = wins.mood !== 'fresh';
  const shown = wins.wins.slice(0, MAX_INLINE_WINS);

  useEffect(() => {
    if (!celebrate) return;
    // One little « dopamine » buzz per day, not on every visit.
    void (async () => {
      try {
        const key = todayKey();
        if ((await AsyncStorage.getItem(HAPTIC_DAY_KEY)) === key) return;
        await AsyncStorage.setItem(HAPTIC_DAY_KEY, key);
        setTimeout(successHaptic, 350);
      } catch {
        // Storage unavailable — skip the haptic, never block the line.
      }
    })();
  }, [celebrate]);

  if (shown.length === 0) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Noter une dépense"
        hitSlop={8}
        onPress={() => {
          tapHaptic();
          router.push({ pathname: '/add-transaction', params: { type: 'expense' } });
        }}
        style={styles.line}
      >
        <AppIcon family="ionicons" name="add-circle" size={15} color={colors.accentGreen} />
        <Text style={[styles.text, { color: colors.textSecondary }]}>Note ta première dépense du jour</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.line} accessibilityLabel={shown.map((win) => win.label).join(', ')}>
      {shown.map((win, index) => (
        <Reveal key={win.id} index={index} style={styles.win}>
          {index > 0 ? <Text style={[styles.dot, { color: colors.textMuted }]}>·</Text> : null}
          <AppIcon family="ionicons" name={win.icon} size={14} color={colors.accentGreen} />
          <Text style={[styles.text, { color: colors.textSecondary }]} numberOfLines={1}>
            {win.label}
          </Text>
        </Reveal>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 8, rowGap: 4 },
  win: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  dot: { ...jakartaSemiboldText, fontSize: 13, marginRight: 3 },
  text: { ...jakartaMediumText, fontSize: 13, flexShrink: 1 },
});
