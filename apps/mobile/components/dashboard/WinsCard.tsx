/**
 * Accueil « Tes victoires » — a warm, rewarding opener: headline + up to 3 wins.
 * The badge pops in, wins slide in one by one, and a success haptic plays at most once a day.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppIcon } from '@/components/icons/AppIcon';
import { PressScale, Reveal, usePopOnActive } from '@/components/kit/motion';
import { jakartaBoldText, jakartaMediumText, jakartaSemiboldText } from '@/constants/theme';
import { successHaptic, tapHaptic } from '@/lib/haptics';
import type { HomeWins } from '@/lib/homeWins';
import { useAppTheme } from '@/lib/themeContext';

const HAPTIC_DAY_KEY = 'home-wins-haptic-day';

function todayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

export function WinsCard({ wins }: { wins: HomeWins }) {
  const router = useRouter();
  const { colors, isLight } = useAppTheme();
  const [shown, setShown] = useState(false);
  const pop = usePopOnActive(shown, 1.22);
  const celebrate = wins.mood !== 'fresh';

  useEffect(() => {
    setShown(true);
    if (!celebrate) return;
    // One little « dopamine » buzz per day, not on every visit.
    void (async () => {
      try {
        const key = todayKey();
        if ((await AsyncStorage.getItem(HAPTIC_DAY_KEY)) === key) return;
        await AsyncStorage.setItem(HAPTIC_DAY_KEY, key);
        setTimeout(successHaptic, 350);
      } catch {
        // Storage unavailable — skip the haptic, never block the card.
      }
    })();
  }, [celebrate]);

  const accent = colors.accentGreen;
  // Layered « aurora » background: a wash from the top-left, a second glow from the
  // bottom-right and a faint sheen. Green/teal when celebrating, calm indigo otherwise.
  const [primary, secondary] = celebrate ? ['34,197,94', '20,184,166'] : ['99,102,241', '59,130,246'];
  const strength = isLight ? 0.16 : 0.24;

  return (
    <View style={[styles.card, { backgroundColor: colors.containerBackground, borderColor: colors.containerBorder }]}>
      <LinearGradient
        pointerEvents="none"
        colors={[`rgba(${primary},${strength})`, `rgba(${primary},0)`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.75, y: 0.9 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        pointerEvents="none"
        colors={[`rgba(${secondary},0)`, `rgba(${secondary},${strength * 0.85})`]}
        start={{ x: 0.35, y: 0.2 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        pointerEvents="none"
        colors={[isLight ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.06)', 'rgba(255,255,255,0)']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.45 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.head}>
        <Animated.View style={[styles.badge, { backgroundColor: celebrate ? `${accent}26` : colors.surfaceElevated }, pop]}>
          <AppIcon
            family="ionicons"
            name={wins.mood === 'great' ? 'trophy' : wins.mood === 'good' ? 'sparkles' : 'sunny'}
            size={22}
            color={celebrate ? accent : colors.text}
          />
        </Animated.View>
        <View style={styles.headCopy}>
          <Text style={[styles.headline, { color: colors.text }]} numberOfLines={1}>
            {wins.headline}
          </Text>
          <Text style={[styles.subline, { color: colors.textMuted }]} numberOfLines={2}>
            {wins.subline}
          </Text>
        </View>
      </View>

      {wins.wins.length > 0 ? (
        <View style={styles.wins}>
          {wins.wins.map((win, index) => (
            <Reveal key={win.id} index={index + 1} style={[styles.win, { backgroundColor: colors.surfaceElevated }]}>
              <AppIcon family="ionicons" name={win.icon} size={14} color={accent} />
              <Text style={[styles.winText, { color: colors.text }]} numberOfLines={1}>
                {win.label}
              </Text>
            </Reveal>
          ))}
        </View>
      ) : (
        <PressScale
          accessibilityRole="button"
          accessibilityLabel="Noter une dépense"
          onPress={() => {
            tapHaptic();
            router.push({ pathname: '/add-transaction', params: { type: 'expense' } });
          }}
          scaleTo={0.96}
          style={[styles.cta, { backgroundColor: colors.text }]}
        >
          <AppIcon family="ionicons" name="add" size={16} color={colors.background} />
          <Text style={[styles.ctaText, { color: colors.background }]}>Noter une dépense</Text>
        </PressScale>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 22, borderWidth: 1, padding: 16, gap: 14, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  headCopy: { flex: 1, minWidth: 0, gap: 2 },
  headline: { ...jakartaBoldText, fontSize: 18, letterSpacing: -0.3 },
  subline: { ...jakartaMediumText, fontSize: 13, lineHeight: 18 },
  wins: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  win: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingHorizontal: 11, borderRadius: 16, maxWidth: '100%' },
  winText: { ...jakartaSemiboldText, fontSize: 12.5, flexShrink: 1 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
  },
  ctaText: { ...jakartaSemiboldText, fontSize: 13.5 },
});
