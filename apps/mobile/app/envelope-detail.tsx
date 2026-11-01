/**
 * Vue détaillée d'une enveloppe : combien elle contient, sa part du compte et les raccourcis
 * Ajouter / Retirer / Transférer. Modifier et Supprimer sont dans le menu.
 */
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal';
import {
  FixedScreenHeader,
  fixedHeaderScreenStyle,
  fixedHeaderScrollStyle,
} from '@/components/FixedScreenHeader';
import { AppIcon } from '@/components/icons/AppIcon';
import { IconWell, ListCard, ListRow, RingGauge, SectionLabel, SummaryCard } from '@/components/kit';
import { PressScale } from '@/components/kit/motion';
import { OverflowMenuButton } from '@/components/OverflowMenuButton';
import { PageTransition } from '@/components/PageTransition';
import { EnvelopeEmoji, EnvelopeSheet, type EnvelopeDraft } from '@/components/wallet/AccountEnvelopes';
import { EnvelopeTransferSheet } from '@/components/wallet/EnvelopeTransferSheet';
import { jakartaMediumText, spacing, typography } from '@/constants/theme';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { deleteEnvelope, getEnvelopesByAccount, type AccountEnvelope } from '@/lib/accountEnvelopes';
import { getSavingsGoals, getSimulatedAccounts } from '@/lib/db';
import { dataEvents } from '@/lib/events';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { successHaptic, tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';
import type { SavingsGoal, SimulatedAccount } from '@/types';

const money = formatDisplayMoneyAbsolute;

/** Round quick action under the summary: icon in a well, short label below. */
function ActionShortcut({
  label,
  icon,
  disabled = false,
  onPress,
}: {
  label: string;
  icon: 'add' | 'remove' | 'swap-horizontal';
  disabled?: boolean;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      scaleTo={0.94}
      onPress={() => {
        tapHaptic();
        onPress();
      }}
      containerStyle={styles.shortcutHit}
      style={[styles.shortcut, disabled && styles.shortcutDisabled]}
    >
      <View style={[styles.shortcutWell, { backgroundColor: colors.surfaceElevated }]}>
        <AppIcon family="ionicons" name={icon} size={22} color={colors.text} />
      </View>
      <Text style={[styles.shortcutLabel, { color: colors.text }]} numberOfLines={1}>
        {label}
      </Text>
    </PressScale>
  );
}

export default function EnvelopeDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ envelopeId?: string }>();
  const envelopeId = typeof params.envelopeId === 'string' ? params.envelopeId : '';
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const [envelope, setEnvelope] = useState<AccountEnvelope | null>(null);
  const [siblings, setSiblings] = useState<AccountEnvelope[]>([]);
  const [account, setAccount] = useState<SimulatedAccount | null>(null);
  const [goal, setGoal] = useState<SavingsGoal | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [transferKind, setTransferKind] = useState<'add' | 'remove' | 'transfer' | null>(null);
  const [editDraft, setEditDraft] = useState<EnvelopeDraft | null>(null);
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);

  const load = useCallback(async () => {
    const [byAccount, accounts, goals] = await Promise.all([
      getEnvelopesByAccount(),
      getSimulatedAccounts(),
      getSavingsGoals(),
    ]);
    const next = Object.values(byAccount).flat().find((item) => item.id === envelopeId) ?? null;
    setEnvelope(next);
    setSiblings(next ? byAccount[next.accountId] ?? [] : []);
    setAccount(next ? accounts.find((item) => item.id === next.accountId) ?? null : null);
    setGoal(goals.find((item) => item.linkedEnvelopeId === envelopeId) ?? null);
    setLoaded(true);
  }, [envelopeId]);

  useEffect(() => {
    void load();
  }, [load]);
  useRefreshOnFocus(load);
  useEffect(() => dataEvents.subscribe(load), [load]);

  const handleConfirmDelete = async () => {
    setConfirmDeleteVisible(false);
    await deleteEnvelope(envelopeId);
    successHaptic();
    router.back();
  };

  const balance = account?.balance ?? 0;
  const assigned = siblings.reduce((sum, item) => sum + item.amount, 0);
  const free = Math.max(0, balance - assigned);
  const share = envelope && balance > 0 ? Math.min(1, envelope.amount / balance) : 0;

  return (
    <PageTransition>
      <View style={[fixedHeaderScreenStyle, styles.screen, { backgroundColor: colors.background }]}>
        <FixedScreenHeader
          title={envelope?.name ?? 'Enveloppe'}
          onBack={() => router.back()}
          trailing={
            envelope ? (
              <OverflowMenuButton
                accessibilityLabel="Options de l'enveloppe"
                items={[
                  {
                    key: 'edit',
                    label: 'Modifier',
                    onPress: () => setEditDraft({ envelope, isNew: false }),
                  },
                  {
                    key: 'delete',
                    label: 'Supprimer',
                    icon: 'trash-outline',
                    destructive: true,
                    onPress: () => {
                      tapHaptic();
                      setConfirmDeleteVisible(true);
                    },
                  },
                ]}
              />
            ) : undefined
          }
        />
        <ScrollView
          style={fixedHeaderScrollStyle}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + spacing.xl, 56) }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await load();
                setRefreshing(false);
              }}
              tintColor={colors.primary}
            />
          }
        >
          {envelope ? (
            <>
              <SummaryCard
                label="Dans l’enveloppe"
                amount={money(envelope.amount)}
                amountValue={envelope.amount}
                formatAmount={money}
                aside={
                  <RingGauge progress={share} color={colors.accentGreen} size={76} stroke={7}>
                    <EnvelopeEmoji icon={envelope.icon} size={40} glyphSize={24} />
                  </RingGauge>
                }
                stats={[
                  {
                    label: 'Part du solde',
                    value: share > 0 && share < 0.01 ? '< 1 %' : `${Math.round(share * 100)} %`,
                  },
                  { label: 'Libre', value: money(free) },
                ]}
              />

              <View style={styles.shortcuts}>
                <ActionShortcut label="Ajouter" icon="add" onPress={() => setTransferKind('add')} />
                <ActionShortcut
                  label="Retirer"
                  icon="remove"
                  disabled={envelope.amount <= 0}
                  onPress={() => setTransferKind('remove')}
                />
                <ActionShortcut
                  label="Transférer"
                  icon="swap-horizontal"
                  disabled={envelope.amount <= 0 || siblings.length < 2}
                  onPress={() => setTransferKind('transfer')}
                />
              </View>

              <View>
                <SectionLabel title="Détails" />
                <ListCard>
                  <ListRow
                    leading={<IconWell icon="wallet-outline" />}
                    title="Compte"
                    value={account?.name ?? '—'}
                    compactValue
                    isLast={!goal}
                  />
                  {goal ? (
                    <ListRow
                      leading={<IconWell icon="flag-outline" />}
                      title="Objectif lié"
                      subtitle={`${money(goal.currentAmount)} sur ${money(goal.targetAmount)}`}
                      value={`${Math.round(goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0)} %`}
                      compactValue
                      chevron
                      isLast
                      accessibilityLabel={`Objectif lié : ${goal.name}`}
                      onPress={() => router.push({ pathname: '/goal-detail', params: { goalId: goal.id } })}
                    />
                  ) : null}
                </ListCard>
              </View>
            </>
          ) : loaded ? (
            <Text style={[styles.empty, { color: colors.textMuted }]}>Enveloppe introuvable.</Text>
          ) : null}
        </ScrollView>

        {envelope && account ? (
          <EnvelopeTransferSheet
            visible={transferKind != null}
            accountId={account.id}
            accountName={account.name}
            balance={account.balance}
            focus={transferKind ? { kind: transferKind, envelope } : undefined}
            onClose={() => setTransferKind(null)}
          />
        ) : null}
        <EnvelopeSheet draft={editDraft} onClose={() => setEditDraft(null)} />
        <ConfirmDeleteModal
          visible={confirmDeleteVisible}
          title="Supprimer l’enveloppe ?"
          message={envelope ? `Supprimer ${envelope.name} ? Son argent redevient libre dans le compte.` : undefined}
          onConfirm={() => void handleConfirmDelete()}
          onCancel={() => setConfirmDeleteVisible(false)}
        />
      </View>
    </PageTransition>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: spacing.lg, gap: spacing.xl },
  shortcuts: { flexDirection: 'row', gap: spacing.sm },
  shortcutHit: { flexGrow: 1, flexBasis: 0 },
  shortcut: { alignItems: 'center', gap: 8 },
  shortcutDisabled: { opacity: 0.4 },
  shortcutWell: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  shortcutLabel: { ...jakartaMediumText, fontSize: 13, lineHeight: 17 },
  empty: { fontSize: typography.caption, lineHeight: 20, textAlign: 'center', paddingVertical: spacing.lg },
});
