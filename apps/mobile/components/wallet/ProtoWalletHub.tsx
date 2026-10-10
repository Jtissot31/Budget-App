/**
 * Portefeuille — patrimoine net, comptes, prêts et objectifs, au style de l'historique.
 *
 * Comptes : liste groupée (liquidités puis crédit). « Modifier » active la sélection
 * et le glisser-déposer pour réordonner.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Sortable, { type SortableGridRenderItem } from 'react-native-sortables';
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal';
import { AppIcon } from '@/components/icons/AppIcon';
import {
  HeaderIconButton,
  IconWell,
  ListCard,
  ListRow,
  PageHeader,
  SECTION_GAP,
  SectionLabel,
  AreaSparkline,
  SummaryCard,
} from '@/components/kit';
import { PageTransition } from '@/components/PageTransition';
import {
  ACCOUNT_KIND_OPTIONS,
  createNewAccountForm,
  saveSimulatedAccountForm,
  SimulatedAccountFormModal,
  type AccountForm,
} from '@/components/SimulatedAccountForm';
import { SettingsPickerSheet, type SettingsPickerOption } from '@/components/SettingsPickerSheet';
import {
  createNewGoalForm,
  SavingsGoalFormModal,
  saveSavingsGoalForm,
  type GoalForm,
} from '@/components/SavingsGoalsForm';
import { UserPickedIconWell } from '@/components/UserPickedIconWell';
import { InstitutionMark } from '@/components/wallet/AccountCardPrototypes';
import {
  destructiveIconColor,
  destructiveTextActionStyle,
  FLOATING_NAV_CONTENT_PADDING,
  PAGE_PADDING_HORIZONTAL,
  spacing,
  subtleDeleteButtonStyle,
  typographyKit,
} from '@/constants/theme';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { accountBalanceDisplayName, accountKindTypeLabel } from '@/lib/accountBalancePresentation';
import { ensureDbReady } from '@/lib/init';
import {
  deleteSavingsGoal,
  deleteSimulatedAccount,
  getCategoryBudgets,
  getDashboard,
  getLoans,
  getRecurringPayments,
  getSavingsGoals,
  getSimulatedAccounts,
  getTransactionsSince,
  persistSimulatedAccountsDisplayOrder,
} from '@/lib/db';
import { dataEvents } from '@/lib/events';
import type { FormFeedback } from '@/lib/formFeedback';
import { isFormSaveSuccess } from '@/lib/formFeedback';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { formatCompactCurrency } from '@/lib/formatCompactGainDollars';
import { buildNetWorthDailySeries } from '@/lib/buildNetWorthTrendSeries';
import { formatNumberDisplay } from '@/lib/formatNumber';
import { resolveSavingsGoalDisplayIcon } from '@/lib/getAutomaticGoalIcon';
import { successHaptic, tapHaptic } from '@/lib/haptics';
import { resolveLoanIcon } from '@/lib/loanIcons';
import { formatLoanObligationName, formatWalletLoanGoalRow } from '@/lib/loanPresentation';
import { useAppTheme } from '@/lib/themeContext';
import type {
  AccountKind,
  CategoryBudget,
  DashboardSummary,
  Loan,
  RecurringPayment,
  SavingsGoal,
  SimulatedAccount,
  Transaction,
} from '@/types';

const ACCOUNT_TYPE_PICKER_OPTIONS: SettingsPickerOption<AccountKind>[] = ACCOUNT_KIND_OPTIONS.map(
  ({ id, label, description, icon }) => ({ id, label, description, icon }),
);

const ACCOUNT_DRAG_ACTIVATION_MS = 220;
const MASK = '••••';

function isLiquid(kind: AccountKind): boolean {
  return kind === 'checking' || kind === 'savings' || kind === 'cash';
}

function accountMeta(account: SimulatedAccount): string {
  const kind = accountKindTypeLabel(account.kind);
  const digits = (account.last4 ?? '').replace(/\D/g, '').slice(-4);
  return digits ? `${kind} ··${digits}` : kind;
}

function signedMoney(value: number): string {
  return `${value < 0 ? '−' : ''}${formatDisplayMoneyAbsolute(Math.abs(value))}`;
}

function mergeVisibleAccountsOrder(
  fullOrdered: readonly SimulatedAccount[],
  nextVisible: readonly SimulatedAccount[],
): SimulatedAccount[] {
  const visibleIds = new Set(nextVisible.map((account) => account.id));
  return [...nextVisible, ...fullOrdered.filter((account) => !visibleIds.has(account.id))];
}

function SelectWell({ selected }: { selected: boolean }) {
  const { colors } = useAppTheme();
  return (
    <IconWell
      icon={selected ? 'checkmark-circle' : 'ellipse-outline'}
      color={selected ? colors.text : colors.textMuted}
    />
  );
}

export function ProtoWalletHub() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isLight } = useAppTheme();
  const [accounts, setAccounts] = useState<SimulatedAccount[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [trendTx, setTrendTx] = useState<Transaction[]>([]);
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [categoryBudgets, setCategoryBudgets] = useState<CategoryBudget[]>([]);
  const [recurringPayments, setRecurringPayments] = useState<RecurringPayment[]>([]);
  const [hideBalances, setHideBalances] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [managingAccounts, setManagingAccounts] = useState(false);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [confirmDeleteAccountsVisible, setConfirmDeleteAccountsVisible] = useState(false);
  const [deletingAccounts, setDeletingAccounts] = useState(false);
  const [accountsDragging, setAccountsDragging] = useState(false);

  const [managingGoals, setManagingGoals] = useState(false);
  const [selectedGoalIds, setSelectedGoalIds] = useState<string[]>([]);
  const [confirmDeleteGoalsVisible, setConfirmDeleteGoalsVisible] = useState(false);
  const [deletingGoals, setDeletingGoals] = useState(false);

  const [goalForm, setGoalForm] = useState<GoalForm | null>(null);
  const [savingGoal, setSavingGoal] = useState(false);
  const [goalFormFeedback, setGoalFormFeedback] = useState<FormFeedback | null>(null);

  const [accountTypePickerVisible, setAccountTypePickerVisible] = useState(false);
  const [accountForm, setAccountForm] = useState<AccountForm | null>(null);
  const [accountFormLockedType, setAccountFormLockedType] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [accountFormFeedback, setAccountFormFeedback] = useState<FormFeedback | null>(null);

  const load = useCallback(async () => {
    await ensureDbReady();
    const since = new Date();
    since.setDate(since.getDate() - 31);
    const [nextAccounts, nextGoals, nextDashboard, nextBudgets, nextPayments, nextLoans, nextTrend] =
      await Promise.all([
        getSimulatedAccounts(),
        getSavingsGoals(),
        getDashboard(),
        getCategoryBudgets(),
        getRecurringPayments(),
        getLoans(),
        getTransactionsSince(since.toISOString()),
      ]);
    setAccounts(nextAccounts);
    setGoals(nextGoals);
    setDashboard(nextDashboard);
    setCategoryBudgets(nextBudgets);
    setRecurringPayments(nextPayments);
    setLoans(nextLoans);
    setTrendTx(nextTrend);
  }, []);

  useEffect(() => {
    void load();
    return dataEvents.subscribe(() => {
      void load();
    });
  }, [load]);

  useRefreshOnFocus(load, { minIntervalMs: 5_000 });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  /* ── Accounts: create ── */

  const openAddAccount = useCallback(() => {
    setAccountFormFeedback(null);
    setAccountTypePickerVisible(true);
  }, []);

  const handleSelectAccountType = useCallback(
    (kind: AccountKind) => {
      setAccountFormFeedback(null);
      setAccountFormLockedType(true);
      // Let the type picker Modal dismiss before presenting the form sheet.
      setTimeout(() => {
        setAccountForm(createNewAccountForm(accounts.length, kind));
      }, 280);
    },
    [accounts.length],
  );

  const closeAccountForm = useCallback(() => {
    setAccountForm(null);
    setAccountFormLockedType(false);
    setAccountFormFeedback(null);
  }, []);

  const saveAccount = useCallback(async () => {
    if (!accountForm) return;
    setSavingAccount(true);
    setAccountFormFeedback(null);
    try {
      await ensureDbReady();
      const result = await saveSimulatedAccountForm(accountForm);
      if (isFormSaveSuccess(result)) {
        const accountId = accountForm.id;
        closeAccountForm();
        dataEvents.emit();
        await load();
        router.push({ pathname: '/account-detail', params: { accountId } });
        return;
      }
      setAccountFormFeedback(result);
    } finally {
      setSavingAccount(false);
    }
  }, [accountForm, closeAccountForm, load, router]);

  /* ── Manage modes (one section at a time) ── */

  const toggleManagingAccounts = useCallback(() => {
    tapHaptic();
    setManagingGoals(false);
    setSelectedGoalIds([]);
    setManagingAccounts((prev) => {
      if (prev) setSelectedAccountIds([]);
      return !prev;
    });
  }, []);

  const toggleManagingGoals = useCallback(() => {
    tapHaptic();
    setManagingAccounts(false);
    setSelectedAccountIds([]);
    setManagingGoals((prev) => {
      if (prev) setSelectedGoalIds([]);
      return !prev;
    });
  }, []);

  const toggleIn = (setter: typeof setSelectedAccountIds) => (id: string) => {
    tapHaptic();
    setter((prev) => (prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id]));
  };

  const handleConfirmDeleteAccounts = useCallback(async () => {
    if (deletingAccounts || selectedAccountIds.length === 0) return;
    const ids = [...selectedAccountIds];
    setConfirmDeleteAccountsVisible(false);
    setDeletingAccounts(true);
    try {
      await Promise.all(ids.map((id) => deleteSimulatedAccount(id)));
      setSelectedAccountIds([]);
      setManagingAccounts(false);
      successHaptic();
      dataEvents.emit();
      await load();
    } finally {
      setDeletingAccounts(false);
    }
  }, [deletingAccounts, load, selectedAccountIds]);

  const handleConfirmDeleteGoals = useCallback(async () => {
    if (deletingGoals || selectedGoalIds.length === 0) return;
    const ids = [...selectedGoalIds];
    setConfirmDeleteGoalsVisible(false);
    setDeletingGoals(true);
    try {
      await Promise.all(ids.map((id) => deleteSavingsGoal(id)));
      setSelectedGoalIds([]);
      setManagingGoals(false);
      successHaptic();
      dataEvents.emit();
      await load();
    } finally {
      setDeletingGoals(false);
    }
  }, [deletingGoals, load, selectedGoalIds]);

  const handleAccountsDragEnd = useCallback(({ data }: { data: SimulatedAccount[] }) => {
    setAccountsDragging(false);
    setAccounts((prev) => {
      const next = mergeVisibleAccountsOrder(prev, data);
      if (next.length === prev.length && next.every((a, i) => a.id === prev[i]?.id)) return prev;
      void persistSimulatedAccountsDisplayOrder(next);
      return next;
    });
  }, []);

  /* ── Goals: create ── */

  const openNewGoalForm = useCallback(() => {
    setGoalFormFeedback(null);
    setGoalForm(createNewGoalForm());
  }, []);

  const closeGoalForm = useCallback(() => {
    setGoalForm(null);
    setGoalFormFeedback(null);
  }, []);

  const saveGoal = useCallback(async () => {
    if (!goalForm) return;
    setSavingGoal(true);
    setGoalFormFeedback(null);
    try {
      const result = await saveSavingsGoalForm(goalForm, isLight);
      if (isFormSaveSuccess(result)) {
        closeGoalForm();
        await load();
        return;
      }
      setGoalFormFeedback(result);
    } finally {
      setSavingGoal(false);
    }
  }, [closeGoalForm, goalForm, isLight, load]);

  /* ── Derived numbers ── */

  const listedAccounts = useMemo(() => accounts.filter((a) => !a.hidden), [accounts]);
  const liquidAccounts = useMemo(() => listedAccounts.filter((a) => isLiquid(a.kind)), [listedAccounts]);
  const creditAccounts = useMemo(() => listedAccounts.filter((a) => !isLiquid(a.kind)), [listedAccounts]);

  const liquidCash = liquidAccounts.reduce((sum, a) => sum + a.balance, 0);
  const creditTotal = creditAccounts.reduce((sum, a) => sum + a.balance, 0);
  const netWorth = liquidCash + creditTotal;
  const availableNow = liquidAccounts
    .filter((a) => a.kind === 'checking' || a.kind === 'cash')
    .reduce((sum, a) => sum + a.balance, 0);
  const savingsTotal = liquidAccounts.filter((a) => a.kind === 'savings').reduce((sum, a) => sum + a.balance, 0);
  const creditUsed = creditAccounts.reduce((sum, a) => sum + Math.max(0, -a.balance), 0);
  const creditLimitTotal = creditAccounts.reduce(
    (sum, a) => sum + (typeof a.creditLimit === 'number' && a.creditLimit > 0 ? a.creditLimit : 0),
    0,
  );
  const creditUtilization = creditLimitTotal > 0 ? creditUsed / creditLimitTotal : 0;
  const netWorthSeries = useMemo(
    () =>
      listedAccounts.length === 0
        ? []
        : buildNetWorthDailySeries('accounts_only', netWorth, listedAccounts, 0, trendTx, new Date(), 30).map(
            (point) => point.value,
          ),
    [listedAccounts, netWorth, trendTx],
  );
  const netWorthPct = useMemo(() => {
    if (netWorthSeries.length < 2) return null;
    const first = netWorthSeries[0] ?? 0;
    const last = netWorthSeries[netWorthSeries.length - 1] ?? 0;
    if (first === 0 || Math.abs(last - first) < 0.01) return null;
    const pct = ((last - first) / Math.abs(first)) * 100;
    return Number.isFinite(pct) ? pct : null;
  }, [netWorthSeries]);

  const money = (value: number) => (hideBalances ? MASK : signedMoney(value));

  /* ── Rows ── */

  const renderAccountRow = (account: SimulatedAccount, isLast: boolean, interactive = true) => {
    const selected = selectedAccountIds.includes(account.id);
    const title = accountBalanceDisplayName(account) || 'Compte';
    return (
      <ListRow
        key={account.id}
        leading={managingAccounts ? <SelectWell selected={selected} /> : <View style={styles.logoSlot}><InstitutionMark account={account} size={36} tile /></View>}
        title={title}
        subtitle={accountMeta(account)}
        value={money(account.balance)}
        valueColor={account.balance < 0 && !hideBalances ? colors.danger : colors.text}
        trailing={
          managingAccounts && listedAccounts.length > 1 ? (
            <View style={styles.dragHandle}>
              <Text style={[styles.manageValue, { color: colors.textMuted }]}>{money(account.balance)}</Text>
              <AppIcon family="ionicons" name="reorder-two" size={20} color={colors.textMuted} />
            </View>
          ) : undefined
        }
        isLast={isLast}
        onPress={
          interactive
            ? () => router.push({ pathname: '/account-detail', params: { accountId: account.id } })
            : undefined
        }
      />
    );
  };

  const renderSortableAccount = useCallback<SortableGridRenderItem<SimulatedAccount>>(
    ({ item, index }) => (
      <Sortable.Touchable onTap={() => toggleIn(setSelectedAccountIds)(item.id)}>
        {renderAccountRow(item, index === listedAccounts.length - 1, false)}
      </Sortable.Touchable>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [colors, hideBalances, listedAccounts.length, managingAccounts, selectedAccountIds],
  );

  const addAccountRow = (
    <ListRow
      leading={<IconWell icon="add" color={colors.text} />}
      title="Ajouter un compte"
      subtitle="Chèque, épargne, carte de crédit…"
      isLast
      onPress={openAddAccount}
    />
  );

  return (
    <PageTransition animate={false}>
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <ScrollView
          style={styles.screen}
          contentContainerStyle={{
            paddingBottom: insets.bottom + FLOATING_NAV_CONTENT_PADDING,
            paddingHorizontal: PAGE_PADDING_HORIZONTAL,
          }}
          scrollEnabled={!accountsDragging}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          showsVerticalScrollIndicator={false}
        >
          <PageHeader
            topInset={insets.top}
            title="Wallet"
            trailing={
              <HeaderIconButton
                icon={hideBalances ? 'eye-off-outline' : 'eye-outline'}
                active={hideBalances}
                accessibilityLabel={hideBalances ? 'Afficher les soldes' : 'Masquer les soldes'}
                onPress={() => {
                  tapHaptic();
                  setHideBalances((value) => !value);
                }}
              />
            }
          />

          <View style={styles.section}>
            <SummaryCard
              label="Valeur nette"
              amount={hideBalances ? '••••••' : signedMoney(netWorth)}
              amountValue={hideBalances ? undefined : netWorth}
              formatAmount={signedMoney}
              amountColor={netWorth < 0 && !hideBalances ? colors.danger : colors.text}
              badge={
                netWorthPct != null && !hideBalances
                  ? {
                      label: `${netWorthPct >= 0 ? '+' : '−'}${Math.abs(netWorthPct).toFixed(1).replace('.', ',')} % · 30 j`,
                      color: netWorthPct >= 0 ? colors.accentGreen : colors.danger,
                    }
                  : undefined
              }
              stats={[
                { label: 'Disponible', value: money(availableNow) },
                { label: 'Épargne', value: money(savingsTotal) },
                creditLimitTotal > 0
                  ? {
                      label: 'Crédit utilisé',
                      value: `${Math.round(creditUtilization * 100)} %`,
                      color: creditUtilization >= 0.7 ? colors.danger : undefined,
                    }
                  : { label: 'Crédit', value: money(creditTotal) },
              ]}
            >
              {!hideBalances && netWorthSeries.length > 1 ? (
                <AreaSparkline
                  data={netWorthSeries}
                  color={(netWorthPct ?? 0) >= 0 ? colors.accentGreen : colors.danger}
                  height={48}
                />
              ) : null}
              {!hideBalances && (liquidCash > 0 || creditUsed > 0) ? (
                <View style={styles.balanceBlock}>
                  <View style={styles.balanceLabels}>
                    <Text style={[styles.balanceLabel, { color: colors.textMuted }]}>
                      Liquidités <Text style={{ color: colors.text }}>{formatCompactCurrency(liquidCash)}</Text>
                    </Text>
                    <Text style={[styles.balanceLabel, { color: colors.textMuted }]}>
                      Dettes de carte <Text style={{ color: colors.danger }}>{formatCompactCurrency(creditUsed)}</Text>
                    </Text>
                  </View>
                  <View style={styles.balanceBar}>
                    <View style={{ flex: Math.max(liquidCash, 0.0001), backgroundColor: colors.text, borderRadius: 4 }} />
                    {creditUsed > 0 ? (
                      <View style={{ flex: creditUsed, backgroundColor: colors.danger, borderRadius: 4, marginLeft: 3 }} />
                    ) : null}
                  </View>
                </View>
              ) : null}
            </SummaryCard>
          </View>

          <View style={styles.section}>
            <SectionLabel
              title="Comptes"
              trailing={
                listedAccounts.length > 0 ? (
                  <TextAction
                    label={managingAccounts ? 'Terminé' : 'Modifier'}
                    onPress={toggleManagingAccounts}
                  />
                ) : undefined
              }
            />
            {managingAccounts ? (
              <>
                <ListCard>
                  <Sortable.Grid
                    columns={1}
                    data={listedAccounts}
                    keyExtractor={(item) => item.id}
                    renderItem={renderSortableAccount}
                    rowGap={0}
                    itemEntering={null}
                    sortEnabled={listedAccounts.length > 1}
                    dragActivationDelay={ACCOUNT_DRAG_ACTIVATION_MS}
                    activeItemScale={1.02}
                    activeItemOpacity={0.96}
                    inactiveItemOpacity={1}
                    inactiveItemScale={1}
                    overDrag="vertical"
                    onDragStart={() => {
                      tapHaptic();
                      setAccountsDragging(true);
                    }}
                    onDragEnd={handleAccountsDragEnd}
                  />
                </ListCard>
                <Text style={[styles.hint, { color: colors.textMuted }]}>
                  Touche pour sélectionner · maintiens pour réordonner
                </Text>
                <DeleteButton
                  isLight={isLight}
                  count={selectedAccountIds.length}
                  busy={deletingAccounts}
                  noun="compte"
                  onPress={() => setConfirmDeleteAccountsVisible(true)}
                />
              </>
            ) : (
              <>
                {liquidAccounts.length > 0 ? (
                  <ListCard style={styles.cardGap}>
                    {liquidAccounts.map((account, index) =>
                      renderAccountRow(account, index === liquidAccounts.length - 1),
                    )}
                  </ListCard>
                ) : null}
                {creditAccounts.length > 0 ? (
                  <>
                    <Text style={[styles.subLabel, { color: colors.textMuted }]}>Crédit</Text>
                    <ListCard style={styles.cardGap}>
                      {creditAccounts.map((account, index) =>
                        renderAccountRow(account, index === creditAccounts.length - 1),
                      )}
                    </ListCard>
                  </>
                ) : null}
                <ListCard>{addAccountRow}</ListCard>
              </>
            )}
          </View>

          {loans.length > 0 ? (
            <View style={styles.section}>
              <SectionLabel title="Prêts" />
              <ListCard>
                {loans.map((loan, index) => {
                  const row = formatWalletLoanGoalRow(loan, hideBalances);
                  return (
                    <ListRow
                      key={loan.id}
                      leading={<UserPickedIconWell icon={resolveLoanIcon(loan)} size={40} />}
                      title={formatLoanObligationName(loan)}
                      subtitle={row.remainingLabel}
                      value={`${formatNumberDisplay(Math.round(row.pct * 100))} %`}
                      valueSub="remboursé"
                      valueColor={row.done ? colors.accentGreen : colors.text}
                      progress={row.pct}
                      isLast={index === loans.length - 1}
                      onPress={() => router.push({ pathname: '/loan-detail', params: { loanId: loan.id } })}
                    />
                  );
                })}
              </ListCard>
            </View>
          ) : null}

          <View style={styles.section}>
            <SectionLabel
              title="Objectifs d’épargne"
              trailing={
                <View style={styles.sectionActions}>
                  {!managingGoals ? <TextAction label="Ajouter" onPress={openNewGoalForm} /> : null}
                  {goals.length > 0 ? (
                    <TextAction label={managingGoals ? 'Terminé' : 'Modifier'} onPress={toggleManagingGoals} />
                  ) : null}
                </View>
              }
            />
            <ListCard>
              {goals.length === 0 ? (
                <ListRow
                  leading={<IconWell icon="flag-outline" />}
                  title="Créer un objectif"
                  subtitle="Fonds d’urgence, voyage, mise de fonds…"
                  isLast
                  onPress={openNewGoalForm}
                />
              ) : (
                goals.map((goal, index) => {
                  const saved = goal.currentAmount ?? 0;
                  const target = goal.targetAmount ?? 0;
                  const progress = target > 0 ? Math.min(1, saved / target) : 0;
                  const selected = selectedGoalIds.includes(goal.id);
                  return (
                    <ListRow
                      key={goal.id}
                      leading={
                        managingGoals ? (
                          <SelectWell selected={selected} />
                        ) : (
                          <UserPickedIconWell icon={resolveSavingsGoalDisplayIcon(goal)} size={40} />
                        )
                      }
                      title={goal.name}
                      subtitle={
                        hideBalances
                          ? `${MASK} sur ${MASK}`
                          : `${formatDisplayMoneyAbsolute(saved)} sur ${formatDisplayMoneyAbsolute(target)}`
                      }
                      value={`${formatNumberDisplay(Math.round(progress * 100))} %`}
                      valueColor={colors.accentGreen}
                      progress={progress}
                      isLast={index === goals.length - 1}
                      onPress={() =>
                        managingGoals
                          ? toggleIn(setSelectedGoalIds)(goal.id)
                          : router.push({ pathname: '/goal-detail', params: { goalId: goal.id } })
                      }
                    />
                  );
                })
              )}
            </ListCard>
            {managingGoals ? (
              <DeleteButton
                isLight={isLight}
                count={selectedGoalIds.length}
                busy={deletingGoals}
                noun="objectif"
                onPress={() => setConfirmDeleteGoalsVisible(true)}
              />
            ) : null}
          </View>

          <View style={styles.section}>
            <SectionLabel title="Patrimoine" />
            <ListCard>
              <ListRow
                leading={<IconWell icon="home-outline" />}
                title="Placements et biens"
                subtitle="Actions, immobilier, véhicules"
                chevron
                isLast
                onPress={() => router.push('/patrimoine')}
              />
            </ListCard>
          </View>
        </ScrollView>

        <ConfirmDeleteModal
          visible={confirmDeleteAccountsVisible}
          title={
            selectedAccountIds.length === 1
              ? 'Supprimer ce compte ?'
              : `Supprimer ${selectedAccountIds.length} comptes ?`
          }
          message="Les transactions existantes restent dans l'historique général."
          confirmLabel={selectedAccountIds.length === 1 ? 'Supprimer' : 'Supprimer la sélection'}
          onConfirm={() => void handleConfirmDeleteAccounts()}
          onCancel={() => setConfirmDeleteAccountsVisible(false)}
        />

        <ConfirmDeleteModal
          visible={confirmDeleteGoalsVisible}
          title={
            selectedGoalIds.length === 1
              ? 'Supprimer cet objectif d’épargne ?'
              : `Supprimer ${selectedGoalIds.length} objectifs d’épargne ?`
          }
          message="Les transactions liées restent dans l’historique."
          confirmLabel={selectedGoalIds.length === 1 ? 'Supprimer' : 'Supprimer la sélection'}
          onConfirm={() => void handleConfirmDeleteGoals()}
          onCancel={() => setConfirmDeleteGoalsVisible(false)}
        />

        <SettingsPickerSheet
          visible={accountTypePickerVisible}
          title="Type de compte"
          options={ACCOUNT_TYPE_PICKER_OPTIONS}
          selectedId={'' as AccountKind}
          onClose={() => setAccountTypePickerVisible(false)}
          onSelect={handleSelectAccountType}
        />

        <SimulatedAccountFormModal
          form={accountForm}
          setForm={setAccountForm}
          saving={savingAccount}
          onDismiss={closeAccountForm}
          onSave={() => void saveAccount()}
          feedback={accountFormFeedback}
          lockedType={accountFormLockedType}
        />

        <SavingsGoalFormModal
          form={goalForm}
          setForm={setGoalForm}
          goals={goals}
          dashboard={dashboard}
          categoryBudgets={categoryBudgets}
          recurringPayments={recurringPayments}
          saving={savingGoal}
          onDismiss={closeGoalForm}
          onSave={() => void saveGoal()}
          feedback={goalFormFeedback}
        />
      </View>
    </PageTransition>
  );
}

function TextAction({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={8}
      onPress={() => {
        tapHaptic();
        onPress();
      }}
      style={({ pressed }) => pressed && { opacity: 0.7 }}
    >
      <Text style={[typographyKit.metaSemibold, { fontSize: 11, color: colors.textMuted }]}>{label}</Text>
    </Pressable>
  );
}

function DeleteButton({
  isLight,
  count,
  busy,
  noun,
  onPress,
}: {
  isLight: boolean;
  count: number;
  busy: boolean;
  noun: string;
  onPress: () => void;
}) {
  const disabled = busy || count === 0;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => {
        tapHaptic();
        onPress();
      }}
      style={({ pressed }) => [
        subtleDeleteButtonStyle(isLight, { alignSelf: 'stretch' }),
        styles.deleteButton,
        pressed && { opacity: 0.82 },
        disabled && { opacity: 0.55 },
      ]}
    >
      <AppIcon family="ionicons" name="trash-outline" size={16} color={destructiveIconColor(isLight)} />
      <Text style={destructiveTextActionStyle(isLight)}>
        {busy
          ? 'Suppression…'
          : count === 0
            ? `Sélectionne des ${noun}s`
            : `Supprimer ${count} ${noun}${count > 1 ? 's' : ''}`}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  section: { marginBottom: SECTION_GAP + spacing.sm },
  sectionActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  cardGap: { marginBottom: spacing.md },
  subLabel: {
    ...typographyKit.eyebrow,
    fontSize: 11,
    letterSpacing: 0.8,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  hint: { ...typographyKit.metaMedium, fontSize: 11, marginTop: spacing.sm, paddingHorizontal: 2 },
  logoSlot: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  balanceBlock: { gap: 8 },
  balanceLabels: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  balanceLabel: { ...typographyKit.metaMedium, fontSize: 12 },
  balanceBar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden' },
  dragHandle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  manageValue: { ...typographyKit.metaSemibold, fontSize: 13 },
  deleteButton: { marginTop: spacing.md },
});
