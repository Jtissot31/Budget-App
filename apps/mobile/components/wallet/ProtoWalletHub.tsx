/**
 * Budget Proto — Portefeuille / Comptes hub (Figma wallet).
 * Syncs live accounts + savings goals; keeps existing detail/create routes.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '@/components/icons/AppIcon';
import { RemoteLogoImage } from '@/components/IconFrame';
import { PageTransition } from '@/components/PageTransition';
import { ProtoGlassCard } from '@/components/proto/ProtoGlassCard';
import { ProtoSectionHeader } from '@/components/proto/ProtoSectionHeader';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import { RADIUS, SPACING } from '@/constants/design-tokens';
import {
  FLOATING_NAV_CONTENT_PADDING,
  moneyAmountTypography,
  PAGE_PADDING_HORIZONTAL,
  PAGE_TITLE_STYLE,
  spacing,
  typographyKit,
} from '@/constants/theme';
import {
  accountKindTypeLabel,
  resolveSimulatedAccountLogoUrl,
} from '@/lib/accountBalancePresentation';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { ensureDbReady } from '@/lib/init';
import { getSavingsGoals, getSimulatedAccounts, insertSimulatedAccount } from '@/lib/db';
import { dataEvents } from '@/lib/events';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { successHaptic, tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';
import type { SavingsGoal, SimulatedAccount } from '@/types';

const ACCOUNT_ICON_SIZE = 28;

const QUICK_ACTIONS: {
  label: string;
  icon: keyof typeof import('@expo/vector-icons').Ionicons.glyphMap;
  href: '/plans/explore' | '/plans-list';
}[] = [
  { label: 'Dettes\npersonnel', icon: 'card-outline', href: '/plans/explore' },
  { label: 'Prêts &\nMarges', icon: 'business-outline', href: '/plans/explore' },
  { label: 'Obligations', icon: 'hammer-outline', href: '/plans/explore' },
  { label: 'Patrimoine', icon: 'trending-up-outline', href: '/plans-list' },
];

function accountKindIcon(kind: SimulatedAccount['kind']): keyof typeof import('@expo/vector-icons').Ionicons.glyphMap {
  switch (kind) {
    case 'savings':
      return 'wallet-outline';
    case 'credit':
      return 'card-outline';
    case 'cash':
      return 'cash-outline';
    default:
      return 'cash-outline';
  }
}

/** Institution mark for MES COMPTES tiles — same resolver as dashboard account cards. */
function AccountCardIcon({ account }: { account: SimulatedAccount }) {
  const { colors } = useAppTheme();
  const logoUrl = resolveSimulatedAccountLogoUrl(account)?.trim() || null;
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    setLogoFailed(false);
  }, [logoUrl]);

  const showLogo = Boolean(logoUrl) && !logoFailed;

  return (
    <View style={[styles.accountIcon, { backgroundColor: colors.surfaceElevated }]}>
      {showLogo && logoUrl ? (
        <RemoteLogoImage
          uri={logoUrl}
          size={ACCOUNT_ICON_SIZE}
          onError={() => setLogoFailed(true)}
        />
      ) : (
        <AppIcon
          family="ionicons"
          name={accountKindIcon(account.kind)}
          size={13}
          color={colors.textMuted}
        />
      )}
    </View>
  );
}

export function ProtoWalletHub() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const [accounts, setAccounts] = useState<SimulatedAccount[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [hideBalances, setHideBalances] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    await ensureDbReady();
    const [nextAccounts, nextGoals] = await Promise.all([getSimulatedAccounts(), getSavingsGoals()]);
    setAccounts(nextAccounts);
    setGoals(nextGoals);
  }, []);

  useEffect(() => {
    void load();
    return dataEvents.subscribe(() => {
      void load();
    });
  }, [load]);

  useRefreshOnFocus(load);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const createAccount = useCallback(
    async (kind: SimulatedAccount['kind']) => {
      await ensureDbReady();
      const id = `sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const labels: Record<SimulatedAccount['kind'], string> = {
        checking: 'Compte chèque',
        savings: 'Compte épargne',
        credit: 'Carte de crédit',
        cash: 'Espèces',
      };
      const account: SimulatedAccount = {
        id,
        name: labels[kind],
        kind,
        balance: 0,
        institution: undefined,
        hidden: false,
        displayOrder: accounts.length,
        createdAt: new Date().toISOString(),
      };
      await insertSimulatedAccount(account);
      successHaptic();
      dataEvents.emit();
      await load();
      router.push({ pathname: '/account-detail', params: { accountId: id } });
    },
    [accounts.length, load, router],
  );

  const openAddAccount = useCallback(() => {
    tapHaptic();
    Alert.alert('Ajouter un compte', 'Choisis le type de compte.', [
      { text: 'Chèque', onPress: () => void createAccount('checking') },
      { text: 'Épargne', onPress: () => void createAccount('savings') },
      { text: 'Crédit', onPress: () => void createAccount('credit') },
      { text: 'Espèces', onPress: () => void createAccount('cash') },
      { text: 'Annuler', style: 'cancel' },
    ]);
  }, [createAccount]);

  const totalBalance = useMemo(
    () => accounts.reduce((sum, account) => sum + account.balance, 0),
    [accounts],
  );

  const visibleAccounts = accounts.slice(0, 8);

  return (
    <PageTransition>
      <ScrollView
        style={[styles.screen, { backgroundColor: colors.background }]}
        contentContainerStyle={{
          paddingTop: insets.top + SCREEN_TOP_GUTTER,
          paddingBottom: insets.bottom + FLOATING_NAV_CONTENT_PADDING,
          paddingHorizontal: PAGE_PADDING_HORIZONTAL,
          gap: spacing.xl,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleBlock}>
          <Text style={[PAGE_TITLE_STYLE, { color: colors.text }]}>Portefeuille</Text>
        </View>

        <View>
          <Text style={[styles.soldeLabel, { color: colors.textMuted }]}>Solde total</Text>
          <View style={styles.soldeRow}>
            <Text
              style={[
                moneyAmountTypography({ tier: 'hero', fontSize: 34 }),
                { color: colors.text, flexShrink: 1 },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {hideBalances ? '••••••••' : formatDisplayMoneyAbsolute(totalBalance)}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={hideBalances ? 'Afficher les soldes' : 'Masquer les soldes'}
              hitSlop={10}
              onPress={() => {
                tapHaptic();
                setHideBalances((v) => !v);
              }}
            >
              <AppIcon
                family="ionicons"
                name={hideBalances ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={colors.textMuted}
              />
            </Pressable>
          </View>
        </View>

        <View style={styles.quickRow}>
          {QUICK_ACTIONS.map((action) => (
            <Pressable
              key={action.label}
              accessibilityRole="button"
              accessibilityLabel={action.label.replace('\n', ' ')}
              onPress={() => {
                tapHaptic();
                router.push(action.href);
              }}
              style={styles.quickItem}
            >
              <View style={[styles.quickWell, { backgroundColor: colors.containerBackground }]}>
                <AppIcon family="ionicons" name={action.icon} size={18} color={colors.textSecondary} />
              </View>
              <Text style={[styles.quickLabel, { color: colors.textMuted }]}>{action.label}</Text>
            </Pressable>
          ))}
        </View>

        <View>
          <ProtoSectionHeader
            title="MES COMPTES"
            actionLabel="+ Ajouter"
            onAction={openAddAccount}
          />
          <View style={styles.accountGrid}>
            {visibleAccounts.map((account) => {
              const positive = account.balance >= 0;
              return (
                <Pressable
                  key={account.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${account.name}, ${formatDisplayMoneyAbsolute(account.balance)}`}
                  onPress={() => {
                    tapHaptic();
                    router.push({ pathname: '/account-detail', params: { accountId: account.id } });
                  }}
                  style={({ pressed }) => [styles.accountPress, pressed && { opacity: 0.85 }]}
                >
                  <ProtoGlassCard style={styles.accountCard} padding={14}>
                    <View style={styles.accountTop}>
                      <AccountCardIcon account={account} />
                      <Text style={[styles.accountName, { color: colors.textSecondary }]} numberOfLines={1}>
                        {account.name}
                      </Text>
                    </View>
                    <Text
                      style={[
                        moneyAmountTypography({ tier: 'card', fontSize: 15 }),
                        {
                          color: positive ? colors.text : colors.danger,
                          textAlign: 'right',
                          marginTop: 10,
                          letterSpacing: -0.4,
                        },
                      ]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.7}
                    >
                      {hideBalances
                        ? '••••'
                        : `${positive ? '' : '−'}${formatDisplayMoneyAbsolute(Math.abs(account.balance))}`}
                    </Text>
                    <Text style={[styles.accountType, { color: colors.textMuted }]} numberOfLines={1}>
                      {accountKindTypeLabel(account.kind)}
                    </Text>
                  </ProtoGlassCard>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View>
          <ProtoSectionHeader
            title="OBJECTIFS D'ÉPARGNE"
            actionLabel="+ Nouveau"
            onAction={() => {
              router.push('/savings-goals');
            }}
          />
          <ProtoGlassCard>
            {goals.length === 0 ? (
              <Text style={[styles.emptyGoals, { color: colors.textMuted }]}>Aucun objectif pour l’instant</Text>
            ) : (
              goals.map((goal, index) => {
                const target = Math.max(goal.targetAmount ?? 0, 0);
                const saved = Math.max(goal.currentAmount ?? 0, 0);
                const pct = target > 0 ? Math.min(1, saved / target) : 0;
                const done = pct >= 1;
                const remaining = Math.max(target - saved, 0);
                const deadline =
                  goal.dueDate != null && goal.dueDate !== ''
                    ? new Date(goal.dueDate).toLocaleDateString('fr-CA', {
                        month: 'short',
                        year: 'numeric',
                      })
                    : '—';
                return (
                  <Pressable
                    key={goal.id}
                    accessibilityRole="button"
                    onPress={() => {
                      tapHaptic();
                      router.push({ pathname: '/goal-detail', params: { goalId: goal.id } });
                    }}
                    style={({ pressed }) => [
                      styles.goalRow,
                      index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderSubtle },
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <View style={styles.goalHeader}>
                      <View style={[styles.goalIcon, { backgroundColor: colors.surfaceElevated }]}>
                        <AppIcon family="ionicons" name="airplane-outline" size={15} color={colors.textMuted} />
                      </View>
                      <View style={styles.goalCopy}>
                        <View style={styles.goalTitleRow}>
                          <Text style={[styles.goalName, { color: colors.text }]}>
                            {goal.name}
                          </Text>
                          <Text
                            style={[
                              moneyAmountTypography({ tier: 'row', fontSize: 12 }),
                              { color: done ? colors.accentGreen : colors.textSecondary, flexShrink: 0 },
                            ]}
                          >
                            {Math.round(pct * 100)}%
                          </Text>
                        </View>
                        <View style={styles.goalMetaRow}>
                          <Text style={[styles.goalMeta, { color: colors.textMuted }]}>
                            {deadline}
                          </Text>
                          <Text
                            style={[styles.goalMeta, { color: colors.textMuted, flexShrink: 1, textAlign: 'right' }]}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.8}
                          >
                            {formatDisplayMoneyAbsolute(saved)} / {formatDisplayMoneyAbsolute(target)}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <View style={[styles.goalTrack, { backgroundColor: colors.borderSubtle }]}>
                      <View
                        style={[
                          styles.goalFill,
                          {
                            width: `${pct * 100}%`,
                            backgroundColor: done ? colors.accentGreen : 'rgba(255,255,255,0.28)',
                          },
                        ]}
                      />
                    </View>
                    <Text
                      style={[
                        styles.goalRemaining,
                        { color: done ? colors.accentGreen : colors.textMuted },
                      ]}
                    >
                      {done ? 'Objectif atteint !' : `${formatDisplayMoneyAbsolute(remaining)} restant`}
                    </Text>
                  </Pressable>
                );
              })
            )}
          </ProtoGlassCard>
        </View>
      </ScrollView>
    </PageTransition>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  /** Extra space under « Portefeuille » so Solde total sits lower (on top of scroll gap). */
  titleBlock: { paddingBottom: spacing.lg },
  soldeLabel: { ...typographyKit.metaMedium, fontSize: 13, marginBottom: 6 },
  soldeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  quickRow: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: 4 },
  quickItem: { alignItems: 'center', gap: 7, width: 72 },
  quickWell: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: {
    ...typographyKit.microMedium,
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 13,
  },
  accountGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  accountPress: { width: '48%', flexGrow: 1, flexBasis: '47%' },
  accountCard: { minHeight: 120, justifyContent: 'space-between' },
  accountTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  accountIcon: {
    width: ACCOUNT_ICON_SIZE,
    height: ACCOUNT_ICON_SIZE,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  accountName: { ...typographyKit.metaSemibold, fontSize: 11, flex: 1, minWidth: 0 },
  accountType: { ...typographyKit.microUpper, fontSize: 10, marginTop: 8 },
  emptyGoals: { ...typographyKit.metaMedium, padding: 16 },
  goalRow: { paddingHorizontal: 16, paddingVertical: 14 },
  goalHeader: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 10 },
  goalIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  goalCopy: { flex: 1, minWidth: 0, gap: 2 },
  goalTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  goalName: { ...typographyKit.rowTitle, fontSize: 13, flex: 1, minWidth: 0, lineHeight: 17 },
  goalMetaRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  goalMeta: { ...typographyKit.micro, fontSize: 10 },
  goalTrack: { height: 4, borderRadius: 2, overflow: 'hidden' },
  goalFill: { height: '100%', borderRadius: 2 },
  goalRemaining: { ...typographyKit.micro, fontSize: 10, marginTop: 5 },
});
