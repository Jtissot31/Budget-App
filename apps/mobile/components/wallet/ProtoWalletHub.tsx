/**
 * Budget Proto — Portefeuille / Comptes hub (Figma wallet).
 * Syncs live accounts + savings goals; keeps existing detail/create routes.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Sortable, { type SortableGridRenderItem } from 'react-native-sortables';
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal';
import { AppIcon } from '@/components/icons/AppIcon';
import { PageTransition } from '@/components/PageTransition';
import {
  ACCOUNT_KIND_OPTIONS,
  createNewAccountForm,
  saveSimulatedAccountForm,
  SimulatedAccountFormModal,
  type AccountForm,
} from '@/components/SimulatedAccountForm';
import {
  SettingsPickerSheet,
  type SettingsPickerOption,
} from '@/components/SettingsPickerSheet';
import {
  createNewGoalForm,
  SavingsGoalFormModal,
  saveSavingsGoalForm,
  type GoalForm,
} from '@/components/SavingsGoalsForm';
import { BalanceAccountAddTile, BalanceAccountTile } from '@/components/wallet/BalanceAccountTile';
import { BalanceGoalRow } from '@/components/wallet/BalanceGoalRow';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import {
  BALANCE_ACCOUNT_TILE,
  balanceAccountGridColumnStyle,
  onyxContainerPressedStyle,
} from '@/constants/planFinanceKit';
import {
  destructiveIconColor,
  destructiveTextActionStyle,
  FLOATING_NAV_CONTENT_PADDING,
  moneyAmountTypography,
  PAGE_PADDING_HORIZONTAL,
  PAGE_TITLE_STYLE,
  radius,
  spacing,
  subtleDeleteButtonStyle,
  typographyKit,
} from '@/constants/theme';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { ensureDbReady } from '@/lib/init';
import {
  deleteSavingsGoal,
  deleteSimulatedAccount,
  getCategoryBudgets,
  getDashboard,
  getRecurringPayments,
  getSavingsGoals,
  getSimulatedAccounts,
  persistSimulatedAccountsDisplayOrder,
} from '@/lib/db';
import { dataEvents } from '@/lib/events';
import type { FormFeedback } from '@/lib/formFeedback';
import { isFormSaveSuccess } from '@/lib/formFeedback';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { resolveSavingsGoalDisplayIcon } from '@/lib/getAutomaticGoalIcon';
import { successHaptic, tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';
import type {
  AccountKind,
  CategoryBudget,
  DashboardSummary,
  RecurringPayment,
  SavingsGoal,
  SimulatedAccount,
} from '@/types';

const ACCOUNT_TYPE_PICKER_OPTIONS: SettingsPickerOption<AccountKind>[] =
  ACCOUNT_KIND_OPTIONS.map(({ id, label, description, icon }) => ({
    id,
    label,
    description,
    icon,
  }));

const CHECK = 22;
/** Hold-to-drag accounts — only while manage mode (avoids long-press select conflict). */
const ACCOUNT_DRAG_ACTIVATION_MS = 220;

function SelectCheck({ selected, borderColor }: { selected: boolean; borderColor: string }) {
  const { colors } = useAppTheme();
  return (
    <View
      style={[
        styles.checkWell,
        {
          backgroundColor: selected ? colors.text : 'transparent',
          borderColor: selected ? colors.text : borderColor,
        },
      ]}
    >
      {selected ? (
        <AppIcon family="ionicons" name="checkmark" size={14} color={colors.background} />
      ) : null}
    </View>
  );
}

function mergeVisibleAccountsOrder(
  fullOrdered: readonly SimulatedAccount[],
  nextVisible: readonly SimulatedAccount[],
): SimulatedAccount[] {
  const visibleIds = new Set(nextVisible.map((account) => account.id));
  const hiddenTail = fullOrdered.filter((account) => !visibleIds.has(account.id));
  return [...nextVisible, ...hiddenTail];
}

function AccountSortableTile({
  account,
  hideBalance,
  managing,
  selected,
  selectBorderColor,
  canReorder,
  onPress,
  onLongPress,
}: {
  account: SimulatedAccount;
  hideBalance: boolean;
  managing: boolean;
  selected: boolean;
  selectBorderColor: string;
  canReorder: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  const title = account.name.trim() || 'Compte';

  return (
    <Sortable.Touchable
      accessibilityRole={managing ? 'checkbox' : 'button'}
      accessibilityState={managing ? { selected } : undefined}
      accessibilityLabel={
        managing
          ? `${title}${selected ? ', sélectionné' : ''}`
          : `${title}`
      }
      accessibilityHint={
        managing && canReorder
          ? 'Maintiens appuyé puis fais glisser pour changer l’ordre des comptes.'
          : managing
            ? undefined
            : 'Appui long pour gérer. Ouvre le détail au toucher.'
      }
      onTap={onPress}
      onLongPress={managing ? undefined : onLongPress}
      onTouchesDown={() => setPressed(true)}
      onTouchesUp={() => setPressed(false)}
      style={[
        styles.accountTilePressable,
        { height: BALANCE_ACCOUNT_TILE.height },
        pressed && onyxContainerPressedStyle(),
      ]}
    >
      <BalanceAccountTile
        account={account}
        hideBalance={hideBalance}
        chip={
          managing ? (
            <SelectCheck selected={selected} borderColor={selectBorderColor} />
          ) : undefined
        }
      />
    </Sortable.Touchable>
  );
}

export function ProtoWalletHub() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { colors, isLight } = useAppTheme();
  const [accounts, setAccounts] = useState<SimulatedAccount[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [categoryBudgets, setCategoryBudgets] = useState<CategoryBudget[]>([]);
  const [recurringPayments, setRecurringPayments] = useState<RecurringPayment[]>([]);
  const [hideBalances, setHideBalances] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [managingAccounts, setManagingAccounts] = useState(false);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [confirmDeleteAccountsVisible, setConfirmDeleteAccountsVisible] = useState(false);
  const [deletingAccounts, setDeletingAccounts] = useState(false);

  const [managingGoals, setManagingGoals] = useState(false);
  const [selectedGoalIds, setSelectedGoalIds] = useState<string[]>([]);
  const [confirmDeleteGoalsVisible, setConfirmDeleteGoalsVisible] = useState(false);
  const [deletingGoals, setDeletingGoals] = useState(false);
  const [accountsDragging, setAccountsDragging] = useState(false);

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
    const [nextAccounts, nextGoals, nextDashboard, nextCategoryBudgets, nextRecurringPayments] =
      await Promise.all([
        getSimulatedAccounts(),
        getSavingsGoals(),
        getDashboard(),
        getCategoryBudgets(),
        getRecurringPayments(),
      ]);
    setAccounts(nextAccounts);
    setGoals(nextGoals);
    setDashboard(nextDashboard);
    setCategoryBudgets(nextCategoryBudgets);
    setRecurringPayments(nextRecurringPayments);
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

  const openAddAccount = useCallback(() => {
    tapHaptic();
    setAccountFormFeedback(null);
    setAccountTypePickerVisible(true);
  }, []);

  const closeAccountTypePicker = useCallback(() => {
    setAccountTypePickerVisible(false);
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

  const clearGoalsManaging = useCallback(() => {
    setManagingGoals(false);
    setSelectedGoalIds([]);
  }, []);

  const clearAccountsManaging = useCallback(() => {
    setManagingAccounts(false);
    setSelectedAccountIds([]);
  }, []);

  const toggleManagingAccounts = useCallback(() => {
    tapHaptic();
    setManagingAccounts((prev) => {
      if (prev) {
        setSelectedAccountIds([]);
        return false;
      }
      clearGoalsManaging();
      return true;
    });
  }, [clearGoalsManaging]);

  const toggleAccountSelection = useCallback((id: string) => {
    setSelectedAccountIds((prev) =>
      prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id],
    );
  }, []);

  const beginManagingAccount = useCallback(
    (id: string) => {
      tapHaptic();
      clearGoalsManaging();
      setManagingAccounts(true);
      setSelectedAccountIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    },
    [clearGoalsManaging],
  );

  const openDeleteAccountsConfirm = useCallback(() => {
    if (selectedAccountIds.length === 0) return;
    tapHaptic();
    setConfirmDeleteAccountsVisible(true);
  }, [selectedAccountIds.length]);

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

  const toggleManagingGoals = useCallback(() => {
    tapHaptic();
    setManagingGoals((prev) => {
      if (prev) {
        setSelectedGoalIds([]);
        return false;
      }
      clearAccountsManaging();
      return true;
    });
  }, [clearAccountsManaging]);

  const toggleGoalSelection = useCallback((id: string) => {
    setSelectedGoalIds((prev) =>
      prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id],
    );
  }, []);

  const beginManagingGoal = useCallback(
    (id: string) => {
      tapHaptic();
      clearAccountsManaging();
      setManagingGoals(true);
      setSelectedGoalIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    },
    [clearAccountsManaging],
  );

  const openDeleteGoalsConfirm = useCallback(() => {
    if (selectedGoalIds.length === 0) return;
    tapHaptic();
    setConfirmDeleteGoalsVisible(true);
  }, [selectedGoalIds.length]);

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

  const handleAccountsDragEnd = useCallback(
    ({ data }: { data: SimulatedAccount[] }) => {
      setAccountsDragging(false);
      setAccounts((prev) => {
        const next = mergeVisibleAccountsOrder(prev, data);
        if (
          next.length === prev.length &&
          next.every((account, index) => account.id === prev[index]?.id)
        ) {
          return prev;
        }
        void persistSimulatedAccountsDisplayOrder(next);
        return next;
      });
    },
    [],
  );

  const openNewGoalForm = useCallback(() => {
    tapHaptic();
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

  const listedAccounts = useMemo(
    () => accounts.filter((account) => !account.hidden),
    [accounts],
  );

  const netWorth = useMemo(
    () => listedAccounts.reduce((sum, account) => sum + account.balance, 0),
    [listedAccounts],
  );

  const liquidCash = useMemo(
    () =>
      listedAccounts.reduce((sum, account) => {
        if (account.kind === 'checking' || account.kind === 'savings' || account.kind === 'cash') {
          return sum + account.balance;
        }
        return sum;
      }, 0),
    [listedAccounts],
  );

  const goalsSavings = useMemo(
    () => goals.reduce((sum, goal) => sum + (goal.currentAmount ?? 0), 0),
    [goals],
  );

  const canReorderAccounts = managingAccounts && listedAccounts.length >= 2;
  const [accountGridWidth, setAccountGridWidth] = useState(() =>
    Math.max(0, windowWidth - PAGE_PADDING_HORIZONTAL * 2),
  );
  const accountColumnStyle = balanceAccountGridColumnStyle(accountGridWidth);

  const renderAccountItem = useCallback<SortableGridRenderItem<SimulatedAccount>>(
    ({ item }) => {
      const selected = selectedAccountIds.includes(item.id);
      return (
        <AccountSortableTile
          account={item}
          hideBalance={hideBalances}
          managing={managingAccounts}
          selected={selected}
          selectBorderColor={colors.borderStrong}
          canReorder={canReorderAccounts}
          onPress={() => {
            tapHaptic();
            if (managingAccounts) {
              toggleAccountSelection(item.id);
              return;
            }
            router.push({ pathname: '/account-detail', params: { accountId: item.id } });
          }}
          onLongPress={() => beginManagingAccount(item.id)}
        />
      );
    },
    [
      beginManagingAccount,
      canReorderAccounts,
      colors.borderStrong,
      hideBalances,
      managingAccounts,
      router,
      selectedAccountIds,
      toggleAccountSelection,
    ],
  );

  const accountCountLabel =
    listedAccounts.length === 1 ? '1 compte' : `${listedAccounts.length} comptes`;

  const accountsSection = (
    <View style={styles.sectionBlock}>
      <View style={styles.sectionHeader}>
        <Ionicons name="business-outline" size={14} color={colors.textMuted} />
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]} numberOfLines={1}>
          Comptes et cartes
        </Text>
        {managingAccounts ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Terminer la gestion"
            hitSlop={8}
            onPress={toggleManagingAccounts}
            style={({ pressed }) => [pressed && { opacity: 0.7 }]}
          >
            <Text style={[styles.addAction, { color: colors.text }]}>Terminer</Text>
          </Pressable>
        ) : (
          <Text
            style={[
              moneyAmountTypography({ tier: 'row' }),
              styles.sectionAmount,
              { color: colors.textMuted },
            ]}
            numberOfLines={1}
          >
            {hideBalances ? '••••' : formatDisplayMoneyAbsolute(liquidCash)}
          </Text>
        )}
      </View>
      {managingAccounts ? (
        <View style={styles.accountGridManage}>
          <Sortable.Grid
            columns={BALANCE_ACCOUNT_TILE.columns}
            data={listedAccounts}
            keyExtractor={(item) => item.id}
            renderItem={renderAccountItem}
            rowGap={BALANCE_ACCOUNT_TILE.gap}
            columnGap={BALANCE_ACCOUNT_TILE.gap}
            itemEntering={null}
            sortEnabled={canReorderAccounts}
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
        </View>
      ) : (
        <View
          style={styles.accountGrid}
          onLayout={(event) => {
            const next = event.nativeEvent.layout.width;
            setAccountGridWidth((prev) => (prev === next ? prev : next));
          }}
        >
          {listedAccounts.map((account) => {
            const title = account.name.trim() || 'Compte';
            return (
              <Pressable
                key={account.id}
                accessibilityRole="button"
                accessibilityLabel={title}
                accessibilityHint="Appui long pour gérer. Ouvre le détail au toucher."
                onPress={() => {
                  tapHaptic();
                  router.push({ pathname: '/account-detail', params: { accountId: account.id } });
                }}
                onLongPress={() => beginManagingAccount(account.id)}
                style={({ pressed }) => [accountColumnStyle, pressed && onyxContainerPressedStyle()]}
              >
                <BalanceAccountTile account={account} hideBalance={hideBalances} />
              </Pressable>
            );
          })}
          <View style={accountColumnStyle}>
            <BalanceAccountAddTile onPress={openAddAccount} />
          </View>
        </View>
      )}
      {managingAccounts ? (
        <View style={styles.deleteBlock}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              selectedAccountIds.length === 0
                ? 'Sélectionne des comptes à supprimer'
                : `Supprimer ${selectedAccountIds.length} compte${selectedAccountIds.length > 1 ? 's' : ''}`
            }
            disabled={deletingAccounts || selectedAccountIds.length === 0}
            onPress={openDeleteAccountsConfirm}
            style={({ pressed }) => [
              subtleDeleteButtonStyle(isLight, { alignSelf: 'stretch' }),
              pressed && { opacity: 0.82 },
              (deletingAccounts || selectedAccountIds.length === 0) && { opacity: 0.55 },
            ]}
          >
            <AppIcon
              family="ionicons"
              name="trash-outline"
              size={16}
              color={destructiveIconColor(isLight)}
            />
            <Text style={destructiveTextActionStyle(isLight)}>
              {deletingAccounts
                ? 'Suppression…'
                : selectedAccountIds.length === 0
                  ? 'Sélectionne des comptes'
                  : selectedAccountIds.length === 1
                    ? 'Supprimer 1 compte'
                    : `Supprimer ${selectedAccountIds.length} comptes`}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );

  const goalsSection = (
    <View style={styles.sectionBlock}>
      <View style={styles.sectionHeader}>
        <Ionicons name="flag-outline" size={14} color={colors.textMuted} />
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]} numberOfLines={1}>
          Objectifs d’épargne
        </Text>
        {managingGoals ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Terminer la gestion"
            hitSlop={8}
            onPress={toggleManagingGoals}
            style={({ pressed }) => [pressed && { opacity: 0.7 }]}
          >
            <Text style={[styles.addAction, { color: colors.text }]}>Terminer</Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ajouter un objectif d'épargne"
            hitSlop={8}
            onPress={openNewGoalForm}
            style={({ pressed }) => [pressed && { opacity: 0.7 }]}
          >
            <Text style={[styles.addAction, { color: colors.textMuted }]}>+ Ajouter</Text>
          </Pressable>
        )}
      </View>
      {goals.length === 0 ? (
        <Text style={[styles.emptyGoals, { color: colors.textMuted }]}>
          Aucun objectif pour l’instant
        </Text>
      ) : (
        <View
          style={[
            styles.goalsCard,
            { backgroundColor: colors.modalSurface, borderColor: colors.border },
          ]}
        >
          {goals.map((goal, index) => {
            const selected = selectedGoalIds.includes(goal.id);
            return (
              <BalanceGoalRow
                key={goal.id}
                icon={resolveSavingsGoalDisplayIcon(goal)}
                title={goal.name}
                saved={goal.currentAmount ?? 0}
                target={goal.targetAmount ?? 0}
                managing={managingGoals}
                selected={selected}
                showTopDivider={index > 0}
                accessibilityLabel={
                  managingGoals
                    ? `${goal.name}${selected ? ', sélectionné' : ''}`
                    : `Voir l'objectif ${goal.name}`
                }
                onPress={() => {
                  tapHaptic();
                  if (managingGoals) {
                    toggleGoalSelection(goal.id);
                    return;
                  }
                  router.push({ pathname: '/goal-detail', params: { goalId: goal.id } });
                }}
                onLongPress={() => beginManagingGoal(goal.id)}
              />
            );
          })}
        </View>
      )}
      {managingGoals && goals.length > 0 ? (
        <View style={styles.deleteBlock}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              selectedGoalIds.length === 0
                ? 'Sélectionne des objectifs à supprimer'
                : `Supprimer ${selectedGoalIds.length} objectif${selectedGoalIds.length > 1 ? 's' : ''}`
            }
            disabled={deletingGoals || selectedGoalIds.length === 0}
            onPress={openDeleteGoalsConfirm}
            style={({ pressed }) => [
              subtleDeleteButtonStyle(isLight, { alignSelf: 'stretch' }),
              pressed && { opacity: 0.82 },
              (deletingGoals || selectedGoalIds.length === 0) && { opacity: 0.55 },
            ]}
          >
            <AppIcon
              family="ionicons"
              name="trash-outline"
              size={16}
              color={destructiveIconColor(isLight)}
            />
            <Text style={destructiveTextActionStyle(isLight)}>
              {deletingGoals
                ? 'Suppression…'
                : selectedGoalIds.length === 0
                  ? 'Sélectionne des objectifs'
                  : selectedGoalIds.length === 1
                    ? 'Supprimer 1 objectif'
                    : `Supprimer ${selectedGoalIds.length} objectifs`}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );

  const masked = hideBalances;

  return (
    <PageTransition animate={false}>
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{
            paddingTop: insets.top + SCREEN_TOP_GUTTER,
            paddingBottom: insets.bottom + FLOATING_NAV_CONTENT_PADDING,
            paddingHorizontal: PAGE_PADDING_HORIZONTAL,
            gap: spacing.xl,
          }}
          scrollEnabled={!accountsDragging}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          showsVerticalScrollIndicator={false}
        >
          <Text style={[PAGE_TITLE_STYLE, styles.pageTitle, { color: colors.text }]}>Portefeuille</Text>

          <View
            style={[
              styles.summaryCard,
              { backgroundColor: colors.modalSurface, borderColor: colors.border },
            ]}
          >
            <View style={styles.summaryTop}>
              <View style={styles.summaryCopy}>
                <Text style={[styles.eyebrow, { color: colors.textMuted }]}>Patrimoine net</Text>
                <View style={styles.summaryAmountRow}>
                  <Text
                    style={[
                      moneyAmountTypography({ tier: 'hero', fontSize: 32 }),
                      styles.summaryAmount,
                      { color: colors.text },
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {masked ? '••••••' : formatDisplayMoneyAbsolute(netWorth)}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={masked ? 'Afficher les soldes' : 'Masquer les soldes'}
                    hitSlop={10}
                    onPress={() => {
                      tapHaptic();
                      setHideBalances((value) => !value);
                    }}
                  >
                    <AppIcon
                      family="ionicons"
                      name={masked ? 'eye-off-outline' : 'eye-outline'}
                      size={18}
                      color={colors.textMuted}
                    />
                  </Pressable>
                </View>
              </View>
              <Text style={[styles.accountCount, { color: colors.textMuted }]} numberOfLines={1}>
                {accountCountLabel}
              </Text>
            </View>
            <View style={styles.summarySplit}>
              <View style={[styles.summarySub, { borderColor: colors.border }]}>
                <Text style={[styles.eyebrow, { color: colors.textMuted }]}>Liquidités</Text>
                <Text
                  style={[moneyAmountTypography({ tier: 'card' }), { color: colors.text }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  {masked ? '••••' : formatDisplayMoneyAbsolute(liquidCash)}
                </Text>
              </View>
              <View style={[styles.summarySub, { borderColor: colors.border }]}>
                <Text style={[styles.eyebrow, { color: colors.textMuted }]} numberOfLines={1}>
                  Objectifs et épargne
                </Text>
                <Text
                  style={[moneyAmountTypography({ tier: 'card' }), { color: colors.success }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  {masked ? '••••' : formatDisplayMoneyAbsolute(goalsSavings)}
                </Text>
              </View>
            </View>
          </View>

          {accountsSection}
          {goalsSection}
        </ScrollView>

        <ConfirmDeleteModal
          visible={confirmDeleteAccountsVisible}
          title={
            selectedAccountIds.length === 1
              ? 'Supprimer ce compte ?'
              : `Supprimer ${selectedAccountIds.length} comptes ?`
          }
          message="Les transactions existantes restent dans l'historique général."
          confirmLabel={
            selectedAccountIds.length === 1 ? 'Supprimer' : 'Supprimer la sélection'
          }
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
          confirmLabel={
            selectedGoalIds.length === 1 ? 'Supprimer' : 'Supprimer la sélection'
          }
          onConfirm={() => void handleConfirmDeleteGoals()}
          onCancel={() => setConfirmDeleteGoalsVisible(false)}
        />

        <SettingsPickerSheet
          visible={accountTypePickerVisible}
          title="Type de compte"
          options={ACCOUNT_TYPE_PICKER_OPTIONS}
          selectedId={'' as AccountKind}
          onClose={closeAccountTypePicker}
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

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  pageTitle: {
    marginBottom: -spacing.sm,
  },
  summaryCard: {
    borderRadius: BALANCE_ACCOUNT_TILE.radius,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    gap: spacing.md,
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  summaryCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  summaryAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  summaryAmount: {
    flexShrink: 1,
  },
  accountCount: {
    ...typographyKit.microMedium,
    flexShrink: 0,
    marginTop: 2,
  },
  eyebrow: {
    ...typographyKit.eyebrow,
    fontSize: 11,
    letterSpacing: 0.6,
  },
  summarySplit: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  summarySub: {
    flex: 1,
    minWidth: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  sectionBlock: { width: '100%', alignSelf: 'stretch', gap: spacing.sm },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionLabel: {
    ...typographyKit.eyebrow,
    fontSize: 11,
    letterSpacing: 0.8,
    flex: 1,
    minWidth: 0,
  },
  sectionAmount: {
    flexShrink: 0,
  },
  addAction: {
    ...typographyKit.metaMedium,
    flexShrink: 0,
  },
  accountGrid: {
    width: '100%',
    alignSelf: 'stretch',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: BALANCE_ACCOUNT_TILE.gap,
  },
  accountGridManage: {
    width: '100%',
    alignSelf: 'stretch',
  },
  accountTilePressable: {
    width: '100%',
    height: BALANCE_ACCOUNT_TILE.height,
    overflow: 'hidden',
  },
  goalsCard: {
    borderRadius: BALANCE_ACCOUNT_TILE.radius,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  checkWell: {
    width: CHECK,
    height: CHECK,
    borderRadius: CHECK / 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  emptyGoals: { ...typographyKit.metaMedium, paddingVertical: spacing.sm },
  deleteBlock: { marginTop: spacing.sm },
});
