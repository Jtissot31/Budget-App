import { useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheet } from '@/components/BottomSheet';
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal';
import { SurfaceCard } from '@/components/SurfaceCard';
import { TransactionAvatar } from '@/components/TransactionAvatar';
import type { IconName } from '@/constants/categoryOptions';
import { radius, spacing, typography, type AppColors } from '@/constants/theme';
import { detailHeroAmount, rowTitleTextProps, rowValue, singleLineAmountProps } from '@/lib/textLayout';
import { deleteTransactionById } from '@/lib/db';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import type { Transaction } from '@/types';

type Props = {
  transaction: Transaction | null;
  onClose: () => void;
  /** Called after the transaction has been deleted from the DB, before the sheet closes. */
  onDeleted?: () => void;
};

const DETAIL_SHEET_TOP_RADIUS = 22;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function getTip(tx: Transaction): string {
  if (tx.type === 'income') {
    return `D├⌐p├┤t re├ºu. Pense ├á allouer 20% (${(tx.amount * 0.2).toFixed(0)} $) ├á ton ├⌐pargne.`;
  }
  if (tx.categoryName === 'Restaurants') {
    return `├Ç ${tx.amount.toFixed(2)} $ par visite, r├⌐duire la fr├⌐quence peut lib├⌐rer du budget mensuel.`;
  }
  return 'Transaction enregistr├⌐e. V├⌐rifie la cat├⌐gorie pour un meilleur suivi.';
}

function isPreviewableReceipt(uri?: string | null) {
  return Boolean(uri && !uri.startsWith('scan://') && /\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(uri));
}

function getSyncStatusMeta(status: Transaction['syncStatus'], colors: AppColors): { icon: IconName; label: string; color: string } {
  if (status === 'synced') {
    return { icon: 'cloud-done-outline', label: 'Synchronis├⌐', color: colors.success };
  }
  if (status === 'failed') {
    return { icon: 'cloud-offline-outline', label: '├ëchec de synchronisation', color: colors.danger };
  }
  return { icon: 'sync-outline', label: 'En attente', color: colors.warning };
}

type ItemizedNote = {
  name: string;
  price: number;
  categoryName?: string | null;
};

function parseItemizedNote(note?: string): ItemizedNote[] {
  const line = note?.split('\n').find((part) => part.startsWith('articles:'));
  if (!line) return [];

  try {
    const parsed = JSON.parse(line.slice('articles:'.length));
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item): ItemizedNote[] => {
      if (!item || typeof item !== 'object') return [];
      const record = item as Record<string, unknown>;
      const name = typeof record.name === 'string' ? record.name.trim() : '';
      const price = typeof record.price === 'number' ? record.price : Number(record.price);
      if (!name || Number.isNaN(price)) return [];
      return [{
        name,
        price,
        categoryName: typeof record.categoryName === 'string' ? record.categoryName : null,
      }];
    });
  } catch {
    return [];
  }
}

export function TransactionDetailSheet({ transaction: tx, onClose, onDeleted }: Props) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const [confirmVisible, setConfirmVisible] = useState(false);

  if (!tx) return null;

  const isIncome = tx.type === 'income';
  const visible = !!tx;
  const itemizedNote = parseItemizedNote(tx.note);
  const syncStatus = getSyncStatusMeta(tx.syncStatus, colors);
  const editTransaction = () => {
    tapHaptic();
    onClose();
    router.push({ pathname: '/add-transaction', params: { editId: tx.id } });
  };

  const handleDelete = () => {
    tapHaptic();
    setConfirmVisible(true);
  };

  return (
    <>
    <BottomSheet
      visible={visible}
      onClose={onClose}
      sheetStyle={styles.sheet}
      scrollContentContainerStyle={{ paddingBottom: Math.max(insets.bottom, spacing.xl) }}
    >
      <View style={styles.header}>
        <TransactionAvatar transaction={tx} size={48} />
        <View style={styles.headerText}>
          <Text style={styles.name} {...rowTitleTextProps}>
            {tx.label}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Modifier la transaction"
          hitSlop={10}
          onPress={editTransaction}
          style={({ pressed }) => [styles.editButton, pressed && styles.closeButtonPressed]}
        >
          <Ionicons name="pencil-outline" size={17} color={colors.text} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fermer les d├⌐tails"
          hitSlop={10}
          onPress={onClose}
          style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
        >
          <Ionicons name="close" size={18} color={colors.text} />
        </Pressable>
      </View>

      <Text style={[styles.amount, isIncome && styles.amountIncome]} {...singleLineAmountProps}>
        {isIncome ? '+' : 'ΓêÆ'}
        {formatDisplayMoneyAbsolute(tx.amount)}
      </Text>

      <View style={styles.detailGrid}>
        <SurfaceCard style={styles.detailCardShell} innerStyle={styles.detailCardInner} padding={spacing.md}>
          <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
          <View style={styles.detailCopy}>
            <Text style={styles.detailLabel}>Date</Text>
            <Text style={styles.detailValue} numberOfLines={2}>
              {formatDate(tx.date)}
            </Text>
          </View>
        </SurfaceCard>
        <SurfaceCard style={styles.detailCardShell} innerStyle={styles.detailCardInner} padding={spacing.md}>
          <Ionicons name="pricetag-outline" size={14} color={colors.textMuted} />
          <View style={styles.detailCopy}>
            <Text style={styles.detailLabel}>Cat├⌐gorie</Text>
            <Text style={styles.detailValue} numberOfLines={2}>
              {tx.categoryName}
            </Text>
          </View>
        </SurfaceCard>
      </View>

      <SurfaceCard style={styles.syncCardShell} innerStyle={styles.syncCardInner} padding={spacing.md}>
        <View style={[styles.syncIconWrap, { backgroundColor: syncStatus.color + '1F' }]}>
          <Ionicons name={syncStatus.icon} size={15} color={syncStatus.color} />
        </View>
        <View style={styles.detailCopy}>
          <Text style={styles.detailLabel}>Synchronisation</Text>
          <Text style={[styles.detailValue, { color: syncStatus.color }]} numberOfLines={1}>
            {syncStatus.label}
          </Text>
        </View>
      </SurfaceCard>

      {itemizedNote.length > 0 ? (
        <SurfaceCard style={styles.itemsCardShell} innerStyle={styles.itemsCardInner} padding={spacing.md}>
          <View style={styles.itemsHeader}>
            <Ionicons name="receipt-outline" size={15} color={colors.textMuted} />
            <Text style={styles.itemsTitle} numberOfLines={1}>
              Articles saisis
            </Text>
          </View>
          {itemizedNote.map((item, index) => (
            <View key={`${item.name}-${index}`} style={styles.itemRow}>
              <View style={styles.itemCopy}>
                <Text style={styles.itemName} {...rowTitleTextProps}>{item.name}</Text>
                {item.categoryName ? <Text style={styles.itemCategory} numberOfLines={2}>{item.categoryName}</Text> : null}
              </View>
              <Text style={styles.itemPrice}>
                {formatDisplayMoneyAbsolute(item.price)}
              </Text>
            </View>
          ))}
        </SurfaceCard>
      ) : null}

      {tx.receiptUri || tx.receiptStatus ? (
        <SurfaceCard style={styles.receiptCardShell} innerStyle={styles.receiptCardInner} padding={spacing.md}>
          <View style={styles.receiptHeader}>
            <View style={styles.receiptTitleRow}>
              <Ionicons name="receipt-outline" size={15} color={colors.textMuted} />
              <Text style={styles.itemsTitle} numberOfLines={1}>
                Re├ºu joint
              </Text>
            </View>
            {tx.receiptStatus === 'scan_pending' ? (
              <Text style={styles.receiptStatus} numberOfLines={1}>
                Scan ├á compl├⌐ter
              </Text>
            ) : null}
          </View>
          {isPreviewableReceipt(tx.receiptUri) ? (
            <Image source={{ uri: tx.receiptUri ?? '' }} style={styles.receiptPreview} contentFit="cover" />
          ) : null}
          {tx.receiptUri && !tx.receiptUri.startsWith('scan://') ? (
            <Pressable style={styles.receiptLink} onPress={() => void Linking.openURL(tx.receiptUri ?? '')}>
              <Ionicons name="open-outline" size={14} color={colors.textMuted} />
              <Text style={styles.receiptLinkText} numberOfLines={1}>
                Ouvrir le re├ºu
              </Text>
            </Pressable>
          ) : (
            <Text style={styles.receiptMeta}>
              {tx.receiptStatus === 'scan_pending' ? 'Re├ºu marqu├⌐ pour scan.' : 'Re├ºu disponible.'}
            </Text>
          )}
        </SurfaceCard>
      ) : null}

      <SurfaceCard padding={spacing.md}>
        <View style={styles.tipRow}>
          <Ionicons name="sparkles" size={14} color={colors.purple} />
          <Text style={styles.tip}>{getTip(tx)}</Text>
        </View>
      </SurfaceCard>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Supprimer la transaction"
        style={({ pressed }) => [
          styles.deleteButton,
          { backgroundColor: colors.dangerMuted, borderColor: colors.danger },
          pressed && styles.deleteButtonPressed,
        ]}
        onPress={handleDelete}
      >
        <Ionicons name="trash-outline" size={16} color={colors.danger} />
        <Text style={[styles.deleteText, { color: colors.danger }]}>Supprimer la transaction</Text>
      </Pressable>
    </BottomSheet>
    <ConfirmDeleteModal
      visible={confirmVisible}
      title="Supprimer la transaction ?"
      message="Cette action est irr├⌐versible."
      onConfirm={async () => {
        setConfirmVisible(false);
        await deleteTransactionById(tx.id);
        onDeleted?.();
        onClose();
      }}
      onCancel={() => setConfirmVisible(false)}
    />
    </>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    sheet: {
      backgroundColor: colors.surfaceSolid,
      borderTopLeftRadius: DETAIL_SHEET_TOP_RADIUS,
      borderTopRightRadius: DETAIL_SHEET_TOP_RADIUS,
    },
    header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
    headerText: { flex: 1, minWidth: 0, flexShrink: 1 },
    name: { minWidth: 0, flexShrink: 1, flex: 1, color: colors.text, fontSize: typography.caption, fontWeight: '800', lineHeight: typography.caption + 4 },
    editButton: {
      flexShrink: 0,
      alignItems: 'center',
      justifyContent: 'center',
      width: 36,
      height: 36,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceSolid,
      borderWidth: 1,
      borderColor: colors.borderStrong,
    },
    closeButton: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 36,
      height: 36,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceSolid,
      borderWidth: 1,
      borderColor: colors.borderStrong,
    },
    closeButtonPressed: {
      opacity: 0.72,
    },
    amount: {
      ...detailHeroAmount,
      color: colors.text,
      marginBottom: spacing.lg,
    },
    amountIncome: { color: colors.success },
    detailGrid: { flexDirection: 'row', gap: spacing.sm,  marginBottom: spacing.md },
    detailCardShell: { flex: 1, minWidth: 0 },
    detailCardInner: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
    detailCopy: { flex: 1, minWidth: 0 },
    detailLabel: { color: colors.textMuted, fontSize: typography.micro },
    detailValue: { color: colors.text, fontSize: typography.meta, fontWeight: '700', marginTop: 2 },
    syncCardShell: { marginBottom: spacing.md },
    syncCardInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    syncIconWrap: {
      width: 30,
      height: 30,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    itemsCardShell: { marginBottom: spacing.md },
    itemsCardInner: { gap: spacing.sm },
    itemsHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minWidth: 0 },
    itemsTitle: { flex: 1, color: colors.textMuted, fontSize: typography.micro, fontWeight: '800', letterSpacing: 0.2 },
    itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minWidth: 0 },
    itemCopy: { flex: 1, minWidth: 0 },
    itemName: { color: colors.text, fontSize: typography.caption, fontWeight: '800' },
    itemCategory: { color: colors.textMuted, fontSize: typography.micro, marginTop: 2 },
    itemPrice: { ...rowValue, flexShrink: 0, color: colors.text },
    receiptCardShell: { marginBottom: spacing.md },
    receiptCardInner: { gap: spacing.sm },
    receiptHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
    receiptTitleRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    receiptStatus: { flexShrink: 1, color: colors.textMuted, fontSize: typography.micro, fontWeight: '800' },
    receiptPreview: { width: '100%', height: 132, borderRadius: 14, backgroundColor: colors.surface },
    receiptLink: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minWidth: 0 },
    receiptLinkText: { flex: 1, minWidth: 0, color: colors.text, fontSize: typography.caption, fontWeight: '800' },
    receiptMeta: { color: colors.textMuted, fontSize: typography.caption, fontWeight: '700' },
    tipRow: { flexDirection: 'row', gap: spacing.sm, minWidth: 0 },
    tip: { flex: 1, minWidth: 0, color: colors.textMuted, fontSize: typography.caption, lineHeight: typography.caption + 7 },
    deleteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      marginTop: spacing.lg,
    },
    deleteButtonPressed: { opacity: 0.72 },
    deleteText: {
      fontSize: typography.meta,
      fontWeight: '800',
    },
  });
}
