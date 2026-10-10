/**
 * Accueil « Aujourd'hui » — the daily logging habit loop.
 *
 * Today's spend, a 7-day check row (Duolingo-style), the current streak and
 * one-tap shortcuts to the merchants the user logs most. Tapping a shortcut
 * opens the add form pre-filled (merchant + category), so logging is 2 taps.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppIcon } from '@/components/icons/AppIcon';
import { FitText, ListCard, PressScale } from '@/components/kit';
import { TransactionAvatar } from '@/components/TransactionAvatar';
import { moneyAmountTypography, spacing, typographyKit } from '@/constants/theme';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { getTransactionsSince } from '@/lib/db';
import { dataEvents } from '@/lib/events';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { tapHaptic } from '@/lib/haptics';
import { ensureDbReady } from '@/lib/init';
import {
  computeLoggingStreak,
  todaySpend,
  topQuickAddMerchants,
} from '@/lib/loggingStreak';
import { getLocalDayKey } from '@/lib/transactionListUtils';
import { useAppTheme } from '@/lib/themeContext';
import type { Transaction } from '@/types';

const HISTORY_DAYS = 120;
const FLAME = '#F97316';
const WEEK_LETTERS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

function sinceIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function streakMessage(days: number, loggedToday: boolean, count: number): string {
  if (loggedToday) {
    return days > 1
      ? `${count} saisie${count > 1 ? 's' : ''} aujourd’hui · série de ${days} jours`
      : `${count} saisie${count > 1 ? 's' : ''} aujourd’hui · reviens demain`;
  }
  if (days > 0) return `Note une dépense pour garder ta série de ${days} jour${days > 1 ? 's' : ''}`;
  return 'Note ta première dépense du jour';
}

export function TodayCard() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const load = useCallback(async () => {
    await ensureDbReady();
    setTransactions(await getTransactionsSince(sinceIso(HISTORY_DAYS)));
  }, []);

  useEffect(() => {
    void load();
    return dataEvents.subscribe(() => {
      void load();
    });
  }, [load]);
  useRefreshOnFocus(load, { minIntervalMs: 5_000 });

  const streak = useMemo(() => computeLoggingStreak(transactions), [transactions]);
  const today = useMemo(() => todaySpend(transactions), [transactions]);
  const shortcuts = useMemo(() => topQuickAddMerchants(transactions, 6), [transactions]);

  const week = useMemo(() => {
    const logged = new Set(transactions.map((tx) => getLocalDayKey(tx.date)));
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const key = getLocalDayKey(d.toISOString());
      return { key, letter: WEEK_LETTERS[d.getDay()] ?? '', done: logged.has(key), isToday: i === 6 };
    });
  }, [transactions]);

  const openAdd = (params?: Record<string, string>) => {
    tapHaptic();
    router.push({ pathname: '/add-transaction', params: { type: 'expense', ...params } });
  };

  const flameColor = streak.days > 0 ? FLAME : colors.textMuted;

  return (
    <ListCard padding={16} style={styles.card}>
      <View style={styles.top}>
        <View style={styles.topCopy}>
          <Text style={[styles.label, { color: colors.textMuted }]}>Dépensé aujourd’hui</Text>
          <FitText
            style={[moneyAmountTypography({ tier: 'stat', fontSize: 24 }), { color: colors.text }]}
            fontSize={24}
            lineHeight={30}
            minScale={0.6}
          >
            {formatDisplayMoneyAbsolute(today.total)}
          </FitText>
        </View>
        <View
          style={[
            styles.streakPill,
            { backgroundColor: colors.surfaceElevated },
          ]}
          accessibilityLabel={`Série de ${streak.days} jours`}
        >
          <AppIcon family="ionicons" name="flame" size={16} color={flameColor} />
          <Text style={[styles.streakCount, { color: flameColor }]}>{streak.days}</Text>
        </View>
      </View>

      <View style={styles.week}>
        {week.map((day) => (
          <View key={day.key} style={styles.weekCell}>
            <View
              style={[
                styles.weekDot,
                day.done
                  ? { backgroundColor: colors.text }
                  : { borderWidth: 1.5, borderColor: day.isToday ? colors.text : colors.borderStrong },
              ]}
            >
              {day.done ? <AppIcon family="ionicons" name="checkmark" size={12} color={colors.background} /> : null}
            </View>
            <Text
              style={[
                styles.weekLetter,
                { color: day.isToday ? colors.text : colors.textMuted },
              ]}
            >
              {day.letter}
            </Text>
          </View>
        ))}
      </View>

      <Text style={[styles.message, { color: streak.atRisk ? FLAME : colors.textSecondary }]}>
        {streakMessage(streak.days, streak.loggedToday, today.count)}
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        style={styles.chipScroll}
      >
        <PressScale
          accessibilityRole="button"
          accessibilityLabel="Ajouter une dépense"
          scaleTo={0.94}
          onPress={() => openAdd()}
          style={[styles.chip, styles.chipPrimary, { backgroundColor: colors.text }]}
        >
          <AppIcon family="ionicons" name="add" size={18} color={colors.background} />
          <Text style={[styles.chipText, { color: colors.background }]}>Dépense</Text>
        </PressScale>
        {shortcuts.map((merchant) => (
          <PressScale
            key={merchant.label}
            accessibilityRole="button"
            accessibilityLabel={`Ajouter ${merchant.label}`}
            scaleTo={0.94}
            onPress={() =>
              openAdd({
                label: merchant.label,
                ...(merchant.categoryId ? { categoryId: merchant.categoryId } : {}),
              })
            }
            style={[styles.chip, { backgroundColor: colors.surfaceElevated }]}
          >
            <TransactionAvatar
              transaction={{
                id: `quick-${merchant.label}`,
                label: merchant.label,
                amount: -merchant.typicalAmount,
                type: 'expense',
                date: new Date().toISOString(),
                categoryId: merchant.categoryId ?? '',
                categoryIcon: merchant.categoryIcon,
                syncStatus: 'synced',
              }}
              size={22}
            />
            <Text style={[styles.chipText, { color: colors.text }]} numberOfLines={1}>
              {merchant.label}
            </Text>
          </PressScale>
        ))}
      </ScrollView>
    </ListCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: 14 },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  topCopy: { flex: 1, minWidth: 0, gap: 2 },
  label: { ...typographyKit.metaMedium, fontSize: 12 },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  streakCount: { ...typographyKit.metaSemibold, fontSize: 15 },
  week: { flexDirection: 'row', justifyContent: 'space-between' },
  weekCell: { alignItems: 'center', gap: 5, flex: 1 },
  weekDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekLetter: { ...typographyKit.metaMedium, fontSize: 10 },
  message: { ...typographyKit.metaMedium, fontSize: 12.5 },
  chipScroll: { marginHorizontal: -16 },
  chips: { gap: 8, paddingHorizontal: 16 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 999,
    paddingLeft: 8,
    paddingRight: 14,
    height: 38,
    maxWidth: 180,
  },
  chipPrimary: { paddingLeft: 10 },
  chipText: { ...typographyKit.metaSemibold, fontSize: 13 },
});
