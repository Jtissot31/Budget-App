import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type TextStyle,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';
import { Image } from 'expo-image';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AddArticleSheet } from '@/components/AddArticleSheet';
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal';
import { DetailSectionsList } from '@/components/DetailSectionRows';
import type { DetailSection } from '@/components/DetailSectionRows';
import { EditableField } from '@/components/EditableField';
import type { SettingsPickerOption } from '@/components/SettingsPickerSheet';
import type { TransactionInsight } from '@/lib/transactionInsight';
import { OverflowMenuButton } from '@/components/OverflowMenuButton';
import { SurfaceCard } from '@/components/SurfaceCard';
import { TransactionInsightCard } from '@/components/TransactionInsightCard';
import { PageTransition } from '@/components/PageTransition';
import { TransactionAvatar } from '@/components/TransactionAvatar';
import {
  TransactionAmountLabel,
  transactionAmountDirectionFromType,
} from '@/components/TransactionAmountLabel';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import { MANUAL_ENTRY_ACCOUNTS } from '@/constants/manualEntryAccounts';
import {
  accountDetailHeroBlockStyle,
  articlesReceiptTypography,
  chipSelectableShellStyle,
  detailSectionLabelStyle,
  detailSectionsCardStyle,
  detailSubSectionHeaderStyle,
  detailSubSectionsGap,
  jakartaBoldText,
  jakartaExtraBoldText,
  jakartaMediumText,
  moneyAmountTypography,
  radius,
  spacing,
  typography,
  typographyKit,
  type AppColors,
} from '@/constants/theme';
import {
  FLOATING_FAB_ICON_SIZE,
  floatingGlassButtonPressed,
  floatingGlassFabSurface,
} from '@/constants/floatingGlassButton';
import {
  findInsufficientFundsViolation,
  getReceiptStatusLabel,
  getTransactionAccountDeltas,
  insufficientFundsAlertCopy,
  parseAccountIdFromNote,
  parseMotifFromNote,
  parseRaisonFromNote,
  parseTransferAccountsFromNote,
  resolveAccountIdLabel,
  resolveEndpointLabel,
} from '@/lib/accountTransactionFlow';
import { resolveContactPhotoUriForTransaction } from '@/lib/contactHistory';
import { buildArticlesNoteLine, parseItemizedNote } from '@/lib/itemizedNote';
import type { ItemizedNote } from '@/lib/itemizedNote';
import {
  adjustSimulatedAccountBalance,
  deleteTransactionById,
  getCategories,
  getSavingsGoals,
  getSimulatedAccounts,
  getTransactionById,
  insertTransaction,
} from '@/lib/db';
import { detailHeroAmount, detailRowEditableContainer, rowValue } from '@/lib/textLayout';
import { pickReceiptFromGallery } from '@/lib/receiptCapture';
import { receiptDownloadErrorMessage, saveReceiptToPhotos, shareReceiptImage } from '@/lib/receiptDownload';
import { EMPTY_DETAIL_VALUE } from '@/lib/detailDisplay';
import { HandledSaveError } from '@/lib/editableSaveError';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { parseFormattedNumber } from '@/lib/formatNumber';
import { getTransactionInsight } from '@/lib/transactionInsight';
import { tapHaptic, successHaptic } from '@/lib/haptics';
import { dataEvents } from '@/lib/events';
import { useAppTheme } from '@/lib/themeContext';
import { useContactPhotoMap } from '@/hooks/useContactPhotoMap';
import type { Category, SavingsGoal, SimulatedAccount, Transaction } from '@/types';

type PaymentAccountOption = {
  id: string;
  label: string;
};

type TransactionFieldEditors = {
  accountId: string | null;
  accountLabel: string;
  accountOptions: SettingsPickerOption<string>[];
  categoryId: string;
  categoryLabel: string;
  categoryOptions: SettingsPickerOption<string>[];
  onSaveAccount: (accountId: string) => Promise<void>;
  onSaveCategory: (categoryId: string) => Promise<void>;
};

type AmountFieldEditor = {
  amountValue: string;
  onSaveAmount: (amountStr: string) => Promise<void>;
};

const detailRowSelectTextStyle: TextStyle = {
  ...typographyKit.metaMedium,
  ...rowValue,
  textAlign: 'right',
};

function transactionTypeLabel(type: Transaction['type']): string {
  if (type === 'income') return 'Revenu';
  if (type === 'transfer') return 'Virement';
  return 'Dépense';
}

function transactionTypeIcon(type: Transaction['type']): string {
  if (type === 'income') return 'arrow-down-outline';
  if (type === 'transfer') return 'swap-horizontal-outline';
  return 'arrow-up-outline';
}

function formatTransactionDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate.slice(0, 10);
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatTransactionTime(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function buildPaymentAccountOptions(accounts: SimulatedAccount[]): PaymentAccountOption[] {
  if (accounts.length > 0) {
    return accounts.map((account) => ({
      id: account.id,
      label: account.last4 ? `${account.name} • ${account.last4}` : account.name,
    }));
  }
  return MANUAL_ENTRY_ACCOUNTS.map((account) => ({
    id: account.id,
    label: account.label,
  }));
}

function buildCategoryPickerOptions(categories: Category[]): SettingsPickerOption<string>[] {
  return categories.map((category) => ({
    id: category.id,
    label: category.name,
  }));
}

function updateAccountInNote(note: string | undefined, newAccountId: string): string {
  const lines = (note ?? '').split('\n');
  const hasCompte = lines.some((line) => line.startsWith('compte:'));
  if (hasCompte) {
    return lines.map((line) => (line.startsWith('compte:') ? `compte:${newAccountId}` : line)).join('\n');
  }
  const trimmed = (note ?? '').trim();
  return trimmed ? `compte:${newAccountId}\n${trimmed}` : `compte:${newAccountId}`;
}

function buildTransferDetailSection(
  tx: Transaction,
  accounts: SimulatedAccount[],
  savingsGoals: readonly Pick<SavingsGoal, 'id' | 'name'>[],
): DetailSection | null {
  if (tx.type !== 'transfer') return null;

  const { sourceId, destinationId } = parseTransferAccountsFromNote(tx.note);
  const sourceLabel = sourceId ? resolveEndpointLabel(sourceId, accounts, savingsGoals) : null;
  const destinationLabel = destinationId ? resolveEndpointLabel(destinationId, accounts, savingsGoals) : null;
  const motif = parseMotifFromNote(tx.note);

  const rows = [
    sourceLabel
      ? { label: 'De', value: sourceLabel, icon: 'wallet-outline' as const }
      : null,
    destinationLabel
      ? { label: 'À', value: destinationLabel, icon: 'arrow-forward-outline' as const }
      : null,
    motif
      ? { label: 'Motif', value: motif, icon: 'chatbubble-ellipses-outline' as const }
      : null,
  ].filter(Boolean) as DetailSection['rows'];

  if (rows.length === 0) return null;
  return { title: 'Virement', rows };
}

function buildTransactionDetailSections(
  tx: Transaction,
  accounts: SimulatedAccount[],
  savingsGoals: readonly Pick<SavingsGoal, 'id' | 'name'>[],
  amountColor: string,
  editors?: TransactionFieldEditors,
  amountEditor?: AmountFieldEditor,
): DetailSection[] {
  const transferSection = buildTransferDetailSection(tx, accounts, savingsGoals);
  const accountId = tx.type !== 'transfer' ? parseAccountIdFromNote(tx.note) : null;
  const accountLabel = accountId ? resolveAccountIdLabel(accountId, accounts) : null;

  const transactionSection: DetailSection = {
    title: 'Transaction',
    rows: [
      {
        label: 'Montant',
        value: formatDisplayMoneyAbsolute(tx.amount),
        icon: 'cash-outline' as const,
        valueColor: amountColor,
        valueLayout: 'amount' as const,
        ...(amountEditor
          ? {
              valueContent: (
                <EditableField
                  type="money"
                  value={amountEditor.amountValue}
                  onSave={amountEditor.onSaveAmount}
                  align="right"
                  accessibilityLabel="Modifier le montant"
                  containerStyle={detailRowEditableContainer}
                  textStyle={[moneyAmountTypography({ tier: 'row' }), { color: amountColor }]}
                />
              ),
            }
          : null),
      },
      {
        label: 'Type',
        value: transactionTypeLabel(tx.type),
        icon: transactionTypeIcon(tx.type) as any,
      },
      {
        label: 'Date',
        value: formatTransactionDate(tx.date),
        icon: 'calendar-outline',
      },
      {
        label: 'Heure',
        value: formatTransactionTime(tx.date),
        icon: 'time-outline',
      },
    ].filter((row) => row.value !== ''),
  };

  const compteSection: DetailSection = {
    title: 'Compte',
    rows:
      tx.type !== 'transfer' && editors
        ? [
            {
              label: 'Compte',
              value: editors.accountLabel,
              icon: 'wallet-outline' as const,
              valueContent: (
                <EditableField
                  type="select"
                  value={editors.accountLabel}
                  selectedId={editors.accountId ?? editors.accountOptions[0]?.id ?? ''}
                  selectOptions={editors.accountOptions}
                  pickerTitle="Compte de paiement"
                  onSave={editors.onSaveAccount}
                  align="right"
                  accessibilityLabel="Modifier le compte de paiement"
                  containerStyle={detailRowEditableContainer}
                  textStyle={detailRowSelectTextStyle}
                />
              ),
            },
          ]
        : accountLabel
          ? [{ label: 'Compte', value: accountLabel, icon: 'wallet-outline' as const }]
          : [],
  };

  const categorySection: DetailSection = {
    title: 'Catégorie',
    rows:
      tx.type !== 'transfer' && editors
        ? [
            {
              label: 'Catégorie',
              value: editors.categoryLabel,
              icon: 'pricetag-outline' as const,
              valueContent: (
                <EditableField
                  type="select"
                  value={editors.categoryLabel}
                  selectedId={editors.categoryId}
                  selectOptions={editors.categoryOptions}
                  pickerTitle="Catégorie"
                  onSave={editors.onSaveCategory}
                  align="right"
                  accessibilityLabel="Modifier la catégorie"
                  containerStyle={detailRowEditableContainer}
                  textStyle={detailRowSelectTextStyle}
                />
              ),
            },
          ]
        : [
            tx.categoryName
              ? { label: 'Catégorie', value: tx.categoryName, icon: 'pricetag-outline' as const }
              : null,
          ].filter(Boolean) as DetailSection['rows'],
  };

  const incomeReason = tx.type === 'income' ? parseRaisonFromNote(tx.note) : null;
  const incomeSection: DetailSection = {
    title: 'Revenu',
    rows: [
      incomeReason
        ? { label: 'Raison du revenu', value: incomeReason, icon: 'information-circle-outline' as const }
        : null,
    ].filter(Boolean) as DetailSection['rows'],
  };

  const sections = [transactionSection];
  if (transferSection) sections.push(transferSection);
  else if (compteSection.rows.length > 0) sections.push(compteSection);
  if (categorySection.rows.length > 0) sections.push(categorySection);
  if (incomeSection.rows.length > 0) sections.push(incomeSection);
  return sections;
}

const NOTE_METADATA_PREFIXES = [
  'compte:', 'transfert:', 'asset:', 'goal:', 'articles:',
  'raison:', 'source:', 'contact:', 'destinataire:', 'expediteur:', 'motif:',
];

function parseVisibleNoteText(note: string | undefined): string {
  if (!note) return '';
  return note
    .split('\n')
    .filter((line) => !NOTE_METADATA_PREFIXES.some((p) => line.startsWith(p)))
    .join('\n')
    .trim();
}

function buildNoteWithUpdatedVisibleText(existingNote: string | undefined, newVisibleText: string): string {
  const metadataLines = (existingNote ?? '')
    .split('\n')
    .filter((line) => NOTE_METADATA_PREFIXES.some((p) => line.startsWith(p)));
  const trimmedText = newVisibleText.trim();
  if (!trimmedText && metadataLines.length === 0) return '';
  if (!trimmedText) return metadataLines.join('\n');
  return [trimmedText, ...metadataLines].join('\n');
}

function isPreviewableReceipt(uri?: string | null) {
  const trimmed = uri?.trim();
  return Boolean(trimmed && (trimmed.startsWith('file:') || trimmed.startsWith('http')));
}

function hasAttachedReceipt(transaction: Transaction) {
  return Boolean(transaction.receiptUri?.trim() || transaction.receiptStatus);
}

type DetailCardColors = Pick<AppColors, 'text' | 'textMuted' | 'border' | 'surfaceElevated'>;

function TransactionDetailCard({
  sections,
  noteText,
  colors,
  onEditNote,
}: {
  sections: DetailSection[];
  noteText: string;
  colors: DetailCardColors;
  onEditNote?: () => void;
}) {
  const hasNote = noteText.length > 0;
  return (
    <SurfaceCard style={[detailSectionsCardStyle(), { gap: spacing.md }]}>
      <Text style={[detailSectionLabelStyle(), { color: colors.textMuted }]}>DÉTAILS</Text>
      <DetailSectionsList sections={sections} colors={colors} />
      <View style={styles.notesSection}>
        <View style={styles.notesSectionHeader}>
          <Text style={[detailSubSectionHeaderStyle(), { color: colors.textMuted }]}>Notes</Text>
          {onEditNote ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={hasNote ? 'Modifier la note' : 'Ajouter une note'}
              hitSlop={10}
              onPress={onEditNote}
              style={({ pressed }) => [styles.notesEditButton, pressed && styles.pressed]}
            >
              <Ionicons
                name={hasNote ? 'create-outline' : 'add-circle-outline'}
                size={17}
                color={colors.textMuted}
              />
            </Pressable>
          ) : null}
        </View>
        <View style={[styles.notesBlock, { borderTopColor: colors.border }]}>
          <Text
            style={[
              typographyKit.metaMedium,
              styles.noteBody,
              { color: noteText ? colors.text : colors.textMuted },
            ]}
          >
            {noteText || EMPTY_DETAIL_VALUE}
          </Text>
        </View>
      </View>
    </SurfaceCard>
  );
}

function ReceiptPreviewModal({
  visible,
  receiptUri,
  onClose,
}: {
  visible: boolean;
  receiptUri: string;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { colors, isLight } = useAppTheme();
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const receiptFabBottom = Math.max(insets.bottom, 20) + 100;
  const previewFrame = useMemo(() => {
    const horizontalPadding = spacing.lg * 2;
    const chromeHeight =
      insets.top
      + insets.bottom
      + spacing.sm
      + 34
      + spacing.md
      + 52
      + spacing.md
      + spacing.xl;
    return {
      width: Math.max(0, windowWidth - horizontalPadding),
      height: Math.max(240, windowHeight - chromeHeight),
    };
  }, [insets.bottom, insets.top, windowHeight, windowWidth]);

  const handleDownload = async () => {
    if (downloading || sharing) return;
    tapHaptic();
    setDownloading(true);
    try {
      const result = await saveReceiptToPhotos(receiptUri);
      successHaptic();
      if (result.method === 'photos') {
        Alert.alert('Enregistré', 'Le reçu a été ajouté à votre photothèque.');
      } else {
        Alert.alert(
          'Enregistrer le reçu',
          'Choisissez « Enregistrer l’image » ou une app de fichiers dans le menu de partage.',
        );
      }
    } catch (error) {
      Alert.alert(
        'Erreur',
        receiptDownloadErrorMessage(error, 'Impossible d’enregistrer le reçu dans la photothèque.'),
      );
    } finally {
      setDownloading(false);
    }
  };

  const handleShareReceipt = async () => {
    if (sharing || downloading) return;
    tapHaptic();
    setSharing(true);
    try {
      await shareReceiptImage(receiptUri);
      successHaptic();
    } catch (error) {
      Alert.alert(
        'Erreur',
        receiptDownloadErrorMessage(error, 'Impossible de partager le reçu.'),
      );
    } finally {
      setSharing(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={[
          styles.receiptPreviewBackdrop,
          {
            backgroundColor: isLight ? 'rgba(13, 17, 23, 0.94)' : colors.screenCanvas,
            paddingTop: insets.top + spacing.sm,
            paddingBottom: Math.max(insets.bottom + spacing.md, spacing.xl),
          },
        ]}
      >
        <View style={styles.receiptPreviewHeader}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fermer"
            hitSlop={16}
            onPress={onClose}
            style={({ pressed }) => [
              styles.receiptPreviewCloseButton,
              {
                backgroundColor: colors.surfaceElevated,
                borderColor: colors.border,
              },
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="close" size={19} color={colors.textMuted} />
          </Pressable>
        </View>

        <View style={styles.receiptPreviewImageWrap}>
          <Image
            source={{ uri: receiptUri, cacheKey: `${receiptUri}#fullscreen` }}
            style={previewFrame}
            contentFit="contain"
            allowDownscaling={false}
            recyclingKey={`${receiptUri}#fullscreen`}
            transition={0}
            priority="high"
            accessibilityLabel="Reçu en plein écran"
          />
        </View>

        <View style={[styles.receiptFabRow, { bottom: receiptFabBottom }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Partager le reçu"
            disabled={sharing || downloading}
            onPress={() => void handleShareReceipt()}
            style={({ pressed }) => [
              styles.receiptActionButton,
              floatingGlassFabSurface(colors, isLight),
              (pressed || sharing) && floatingGlassButtonPressed,
            ]}
          >
            {sharing ? (
              <ActivityIndicator color={colors.text} size="small" />
            ) : (
              <Ionicons name="share-outline" size={FLOATING_FAB_ICON_SIZE} color={colors.text} />
            )}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Télécharger le reçu"
            disabled={downloading || sharing}
            onPress={() => void handleDownload()}
            style={({ pressed }) => [
              styles.receiptActionButton,
              {
                backgroundColor: colors.primary,
                shadowColor: colors.primary,
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.35,
                shadowRadius: 16,
                elevation: 12,
              },
              (pressed || downloading) && floatingGlassButtonPressed,
            ]}
          >
            {downloading ? (
              <ActivityIndicator color="#000000" size="small" />
            ) : (
              <Ionicons name="download-outline" size={FLOATING_FAB_ICON_SIZE} color="#000000" />
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function updateArticlesInNote(note: string | undefined, articles: ItemizedNote[]): string {
  const lines = (note ?? '').split('\n').filter(Boolean);
  const withoutArticles = lines.filter((l) => !l.startsWith('articles:'));
  if (articles.length === 0) return withoutArticles.join('\n');
  const articleLine = buildArticlesNoteLine(articles);
  return [...withoutArticles, articleLine].join('\n');
}

function NoteEditSheet({
  visible,
  initialText,
  onSave,
  onClose,
}: {
  visible: boolean;
  initialText: string;
  onSave: (text: string) => void;
  onClose: () => void;
}) {
  const { colors, isLight } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState(initialText);
  const hasExisting = initialText.length > 0;

  useEffect(() => {
    if (visible) setText(initialText);
  }, [visible, initialText]);

  const handleSave = () => {
    onSave(text);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.sheetBackdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.containerBackground,
              borderColor: colors.containerBorder,
              paddingBottom: Math.max(insets.bottom + spacing.lg, spacing.xl),
            },
          ]}
        >
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
          <Text style={[styles.sheetTitle, { color: colors.text }]}>
            {hasExisting ? 'Modifier la note' : 'Ajouter une note'}
          </Text>

          <TextInput
            style={[
              styles.sheetInput,
              styles.noteTextInput,
              { color: colors.text, backgroundColor: colors.input, borderColor: colors.border },
            ]}
            placeholder="Votre note…"
            placeholderTextColor={colors.textMuted}
            value={text}
            onChangeText={setText}
            multiline
            autoFocus
            textAlignVertical="top"
          />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Enregistrer la note"
            onPress={handleSave}
            style={({ pressed }) => [
              styles.sheetSaveButton,
              {
                backgroundColor: colors.primary,
                borderColor: colors.surfaceSolid,
                shadowColor: colors.primary,
              },
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.sheetSaveButtonText,
                { color: isLight ? '#FFFFFF' : colors.background },
              ]}
            >
              Enregistrer
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Annuler"
            onPress={onClose}
            style={({ pressed }) => [
              styles.sheetCancelButton,
              { borderColor: colors.border },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.sheetCancelButtonText, { color: colors.textMuted }]}>Annuler</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ReceiptImportSheet({
  visible,
  onScan,
  onImport,
  onClose,
}: {
  visible: boolean;
  onScan: () => void;
  onImport: () => void;
  onClose: () => void;
}) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.containerBackground,
              borderColor: colors.containerBorder,
              paddingBottom: Math.max(insets.bottom + spacing.lg, spacing.xl),
            },
          ]}
        >
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Scanner un reçu"
            onPress={() => { onClose(); onScan(); }}
            style={({ pressed }) => [
              styles.importMenuRow,
              styles.importMenuRowBorder,
              { borderBottomColor: colors.border },
              pressed && styles.pressed,
            ]}
          >
            <View style={[styles.importMenuIconWell, { backgroundColor: colors.surfaceElevated }]}>
              <Ionicons name="scan-outline" size={20} color={colors.text} />
            </View>
            <Text style={[styles.importMenuRowText, { color: colors.text }]}>Scanner un reçu</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Importer un reçu"
            onPress={() => { onClose(); onImport(); }}
            style={({ pressed }) => [styles.importMenuRow, pressed && styles.pressed]}
          >
            <View style={[styles.importMenuIconWell, { backgroundColor: colors.surfaceElevated }]}>
              <Ionicons name="image-outline" size={20} color={colors.text} />
            </View>
            <Text style={[styles.importMenuRowText, { color: colors.text }]}>Importer un reçu</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Annuler"
            onPress={onClose}
            style={({ pressed }) => [
              styles.sheetCancelButton,
              { borderColor: colors.border, marginTop: spacing.sm },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.sheetCancelButtonText, { color: colors.textMuted }]}>Annuler</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/** Fixed card width for the shareable screenshot — standard content width */
const SHARE_CARD_WIDTH = 360;

const SHARE_THEME = {
  screenBg: '#0a0a0a',
  surface: '#111111',
  surfaceElevated: '#181818',
  border: '#1c1c1c',
  text: '#FFFFFF',
  textMuted: '#666666',
  success: '#00e664',
  successMuted: 'rgba(0, 230, 100, 0.12)',
} as const;

type ShareRichSegment = { text: string; bold?: boolean };

function parseShareRichText(text: string): ShareRichSegment[] {
  const segments: ShareRichSegment[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index) });
    }
    segments.push({ text: match[1], bold: true });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex) });
  }

  return segments.length ? segments : [{ text }];
}

function ShareInsightText({ text }: { text: string }) {
  const segments = parseShareRichText(text);

  return (
    <Text style={[shareCardStyles.insightText, { color: SHARE_THEME.text }]}>
      {segments.map((segment, index) => (
        <Text key={`share-insight-${index}`} style={segment.bold ? jakartaBoldText : undefined}>
          {segment.text}
        </Text>
      ))}
    </Text>
  );
}

/**
 * Off-screen card captured as a PNG for sharing.
 * Mirrors the transaction detail screen content without chrome (nav bar, status bar, menus).
 * Height is fully dynamic — no fixed height so captureRef includes all content.
 */
function TransactionShareCard({
  transaction,
  noteText,
  accounts,
  savingsGoals,
  insight,
  articles,
  contactPhotoUri,
  innerRef,
}: {
  transaction: Transaction;
  noteText: string;
  accounts: SimulatedAccount[];
  savingsGoals: readonly Pick<SavingsGoal, 'id' | 'name'>[];
  insight: TransactionInsight | null;
  articles: ItemizedNote[];
  contactPhotoUri: string | null;
  innerRef: React.RefObject<View | null>;
}) {
  const isIncome = transaction.type === 'income';
  const isTransfer = transaction.type === 'transfer';
  const shareAmountColor = isIncome ? SHARE_THEME.success : isTransfer ? SHARE_THEME.textMuted : SHARE_THEME.text;
  const amountPrefix = isIncome ? '+' : isTransfer ? '' : '−';
  const detailSections = buildTransactionDetailSections(transaction, accounts, savingsGoals, shareAmountColor);
  const shareColors = {
    text: SHARE_THEME.text,
    textMuted: SHARE_THEME.textMuted,
    border: SHARE_THEME.border,
  };
  const articlesTotal = articles.reduce((sum, article) => sum + article.price, 0);
  const receiptAttached = hasAttachedReceipt(transaction);
  const receiptLabel = receiptAttached
    ? getReceiptStatusLabel(transaction.receiptStatus, transaction.receiptUri)
    : null;
  const canPreviewReceipt = isPreviewableReceipt(transaction.receiptUri);

  return (
    <View
      ref={innerRef}
      collapsable={false}
      style={[shareCardStyles.root, { width: SHARE_CARD_WIDTH, backgroundColor: SHARE_THEME.screenBg }]}
    >
      <View style={shareCardStyles.heroBlock}>
        <View style={shareCardStyles.heroIdentityRow}>
          <TransactionAvatar
            transaction={transaction}
            contactPhotoUri={contactPhotoUri}
            size={isTransfer ? 46 : 56}
          />
          <Text style={[shareCardStyles.heroLabel, { color: SHARE_THEME.text }]}>
            {transaction.label}
          </Text>
        </View>

        <Text style={[shareCardStyles.heroAmount, { color: shareAmountColor }]}>
          {amountPrefix}{formatDisplayMoneyAbsolute(transaction.amount)}
        </Text>
      </View>

      {insight ? (
        <View style={[shareCardStyles.surfaceCard, { backgroundColor: SHARE_THEME.surface, borderColor: SHARE_THEME.border }]}>
          <View style={shareCardStyles.insightHeader}>
            <View
              style={[
                shareCardStyles.insightIconWell,
                { backgroundColor: SHARE_THEME.successMuted, borderColor: `${SHARE_THEME.success}33` },
              ]}
            >
              <Ionicons name="sparkles-outline" size={14} color={SHARE_THEME.success} />
            </View>
            <Text style={[detailSectionLabelStyle(), shareCardStyles.insightEyebrow, { color: SHARE_THEME.textMuted }]}>
              {insight.title}
            </Text>
          </View>
          <ShareInsightText text={insight.tip} />
        </View>
      ) : null}

      <View style={[shareCardStyles.surfaceCard, { backgroundColor: SHARE_THEME.surface, borderColor: SHARE_THEME.border }]}>
        <Text style={[detailSectionLabelStyle(), { color: SHARE_THEME.textMuted }]}>DÉTAILS</Text>
        <DetailSectionsList sections={detailSections} colors={shareColors} />
        <View style={shareCardStyles.shareNotesSection}>
          <Text style={[detailSubSectionHeaderStyle(), { color: SHARE_THEME.textMuted }]}>Notes</Text>
          <View style={[shareCardStyles.shareNotesBlock, { borderTopColor: SHARE_THEME.border }]}>
            <Text
              style={[
                typographyKit.metaMedium,
                shareCardStyles.shareNoteBody,
                { color: noteText ? SHARE_THEME.text : SHARE_THEME.textMuted },
              ]}
            >
              {noteText || EMPTY_DETAIL_VALUE}
            </Text>
          </View>
        </View>
      </View>

      {transaction.type === 'expense' ? (
        <View style={[shareCardStyles.surfaceCard, { backgroundColor: SHARE_THEME.surface, borderColor: SHARE_THEME.border }]}>
          <View style={shareCardStyles.articlesHeader}>
            <Ionicons name="receipt-outline" size={12} color={SHARE_THEME.textMuted} />
            <Text style={[detailSectionLabelStyle(), { color: SHARE_THEME.textMuted }]}>ARTICLES</Text>
          </View>

          <View style={[shareCardStyles.articlesTearLine, { borderColor: SHARE_THEME.border }]} />

          {articles.length > 0 ? (
            <View>
              {articles.map((article, index) => (
              <View
                key={`${article.name}-${index}`}
                style={[
                  shareCardStyles.shareArticleRow,
                  index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: SHARE_THEME.border },
                ]}
              >
                <View style={shareCardStyles.shareArticleCopy}>
                  <Text style={[shareCardStyles.shareArticleName, articlesReceiptTypography('regular'), { color: SHARE_THEME.text }]}>
                    {article.name}
                  </Text>
                  {article.categoryName ? (
                    <Text style={[shareCardStyles.shareArticleCategory, articlesReceiptTypography('regular'), { color: SHARE_THEME.textMuted }]}>
                      {article.categoryName}
                    </Text>
                  ) : null}
                </View>
                <Text style={[shareCardStyles.shareArticlePrice, articlesReceiptTypography('medium'), { color: SHARE_THEME.text }]}>
                  {formatDisplayMoneyAbsolute(article.price)}
                </Text>
              </View>
              ))}
              {articlesTotal > 0 ? (
                <View style={[shareCardStyles.shareArticleTotalRow, { borderTopColor: SHARE_THEME.border }]}>
                  <Text style={[shareCardStyles.shareArticleTotalLabel, articlesReceiptTypography('medium'), { color: SHARE_THEME.textMuted }]}>TOTAL</Text>
                  <Text style={[shareCardStyles.shareArticleTotalValue, articlesReceiptTypography('medium'), { color: SHARE_THEME.text }]}>
                    {formatDisplayMoneyAbsolute(articlesTotal)}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : (
            <Text style={[shareCardStyles.shareArticlesEmpty, articlesReceiptTypography('regular'), { color: SHARE_THEME.textMuted }]}>Aucun article</Text>
          )}

          {receiptLabel ? (
            <>
              <View style={[shareCardStyles.articlesTearLine, { borderColor: SHARE_THEME.border }]} />
              <View style={shareCardStyles.shareReceiptRow}>
                {canPreviewReceipt ? (
                  <Image
                    source={{ uri: transaction.receiptUri ?? '', cacheKey: `${transaction.receiptUri}#share-thumb` }}
                    style={shareCardStyles.shareReceiptThumbnail}
                    contentFit="cover"
                    recyclingKey={`${transaction.receiptUri}#share-thumb`}
                  />
                ) : (
                  <View style={[shareCardStyles.shareReceiptThumbnailFallback, { backgroundColor: SHARE_THEME.surfaceElevated }]}>
                    <Ionicons name="receipt-outline" size={16} color={SHARE_THEME.textMuted} />
                  </View>
                )}
                <View style={shareCardStyles.shareReceiptCopy}>
                  <Text style={[shareCardStyles.shareReceiptLabel, articlesReceiptTypography('medium'), { color: SHARE_THEME.text }]}>{receiptLabel}</Text>
                </View>
              </View>
            </>
          ) : null}
        </View>
      ) : null}

      <View style={shareCardStyles.footer}>
        <Ionicons name="wallet-outline" size={13} color={SHARE_THEME.textMuted} />
        <Text style={[shareCardStyles.footerText, { color: SHARE_THEME.textMuted }]}>Budget OS</Text>
      </View>
    </View>
  );
}

/** Receipt paper zigzag edge — SVG path tiling zigzag teeth across full width */
function ReceiptZigzagEdge({ width, color, position }: { width: number; color: string; position: 'top' | 'bottom' }) {
  const toothWidth = 10;
  const toothDepth = 7;
  const height = toothDepth;

  if (width <= 0) return null;

  const count = Math.max(1, Math.ceil(width / toothWidth));
  const totalWidth = width;
  const step = totalWidth / count;

  // Build zigzag path — for 'top': teeth point upward (cut into card from top)
  // For 'bottom': teeth point downward (cut into card from bottom)
  let d = '';
  if (position === 'top') {
    // Start at bottom-left, go up to peaks
    d = `M 0,${height}`;
    for (let i = 0; i < count; i++) {
      const x0 = i * step;
      const xMid = x0 + step / 2;
      const x1 = x0 + step;
      d += ` L ${xMid},0 L ${x1},${height}`;
    }
    d += ` L ${totalWidth},${height} Z`;
  } else {
    // Start at top-left, go down to valleys
    d = `M 0,0`;
    for (let i = 0; i < count; i++) {
      const x0 = i * step;
      const xMid = x0 + step / 2;
      const x1 = x0 + step;
      d += ` L ${xMid},${height} L ${x1},0`;
    }
    d += ` L ${totalWidth},0 Z`;
  }

  return (
    <Svg
      width={totalWidth}
      height={height}
      style={[
        styles.receiptZigzag,
        position === 'top' ? { top: 0 } : { bottom: 0 },
      ]}
      pointerEvents="none"
    >
      <Path d={d} fill={color} />
    </Svg>
  );
}

function TransactionReceiptCard({
  transaction,
  colors,
  articles,
  onAddArticle,
  onRemoveArticle,
  onOpenReceiptMenu,
  onViewReceipt,
}: {
  transaction: Transaction;
  colors: DetailCardColors;
  articles: ItemizedNote[];
  onAddArticle: () => void;
  onRemoveArticle: (index: number) => void;
  onOpenReceiptMenu: () => void;
  onViewReceipt: () => void;
}) {
  const { isLight } = useAppTheme();
  const { width: windowWidth } = useWindowDimensions();
  const [measuredCardWidth, setMeasuredCardWidth] = useState(0);
  const receiptAttached = hasAttachedReceipt(transaction);
  const receiptLabel = receiptAttached
    ? getReceiptStatusLabel(transaction.receiptStatus, transaction.receiptUri)
    : null;
  const canPreviewReceipt = isPreviewableReceipt(transaction.receiptUri);
  const total = articles.reduce((sum, a) => sum + a.price, 0);

  // Monochrome palette — BankAccountCard shell language, no colour accents
  const cardFill = isLight ? '#FAFAFA' : '#0F0F10';
  const tearColor = isLight ? 'rgba(0,0,0,0.11)' : 'rgba(255,255,255,0.11)';
  const rowDivider = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)';
  const ghostBorder = isLight ? 'rgba(0,0,0,0.11)' : 'rgba(255,255,255,0.11)';
  const receiptWell = isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)';
  // Zigzag teeth filled with card's own background color — blends edges into card face
  const zigzagColor = cardFill;

  // Fallback until onLayout fires; content area matches scroll container width
  const cardWidth = measuredCardWidth > 0 ? measuredCardWidth : windowWidth - spacing.lg * 2;
  // Tooth depth used for extra padding so content doesn't sit under the zigzag
  const zigzagDepth = 7;

  return (
    <View
      style={styles.receiptCard}
      onLayout={(event) => {
        const nextWidth = event.nativeEvent.layout.width;
        if (nextWidth > 0 && nextWidth !== measuredCardWidth) {
          setMeasuredCardWidth(nextWidth);
        }
      }}
    >
      {/* Top zigzag — sits over screen canvas so teeth read as torn paper */}
      <ReceiptZigzagEdge width={cardWidth} color={zigzagColor} position="top" />

      <View
        style={[
          styles.receiptCardBody,
          {
            backgroundColor: cardFill,
            marginTop: zigzagDepth,
            marginBottom: zigzagDepth,
          },
        ]}
      >
      {/* Header: receipt icon + "ARTICLES" eyebrow + add-article pill */}
      <View style={styles.receiptHeaderRow}>
        <View style={styles.receiptHeaderLeft}>
          <Ionicons name="receipt-outline" size={12} color={colors.textMuted} />
          <Text style={[detailSectionLabelStyle(), { color: colors.textMuted }]}>ARTICLES</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ajouter un article"
          hitSlop={8}
          onPress={onAddArticle}
          style={({ pressed }) => [
            styles.receiptAddButton,
            chipSelectableShellStyle(ghostBorder),
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="add" size={13} color={colors.textMuted} />
          <Text style={[styles.receiptAddButtonText, { color: colors.textMuted }]}>Ajouter</Text>
        </Pressable>
      </View>

      {/* Dashed tear-line — receipt paper separation effect */}
      <View style={[styles.receiptTearLine, { borderColor: tearColor }]} />

      {/* Article list */}
      {articles.length > 0 ? (
        <View style={styles.receiptArticlesBlock}>
          <View style={styles.receiptTableHead}>
            <Text style={[detailSubSectionHeaderStyle(), styles.receiptTableHeadLabel, { color: colors.textMuted }]}>
              Article
            </Text>
            <Text style={[detailSubSectionHeaderStyle(), styles.receiptTableHeadAmount, { color: colors.textMuted }]}>
              Montant
            </Text>
            <View style={styles.receiptTableHeadAction} />
          </View>
          {articles.map((article, index) => (
            <View
              key={`${article.name}-${index}`}
              style={[
                styles.receiptArticleRow,
                index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: rowDivider },
              ]}
            >
              <View style={styles.receiptArticleCopy}>
                <Text
                  style={[styles.receiptArticleName, articlesReceiptTypography('regular'), { color: colors.text }]}
                  numberOfLines={1}
                >
                  {article.name}
                </Text>
                {article.categoryName ? (
                  <Text
                    style={[styles.receiptArticleCategory, articlesReceiptTypography('regular'), { color: colors.textMuted }]}
                    numberOfLines={1}
                  >
                    {article.categoryName}
                  </Text>
                ) : null}
              </View>
              <Text style={[styles.receiptArticlePrice, articlesReceiptTypography('medium'), { color: colors.text }]}>
                {formatDisplayMoneyAbsolute(article.price)}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Retirer ${article.name}`}
                hitSlop={8}
                onPress={() => onRemoveArticle(index)}
                style={({ pressed }) => [styles.receiptArticleRemoveBtn, pressed && styles.pressed]}
              >
                <Ionicons name="close" size={13} color={colors.textMuted} />
              </Pressable>
            </View>
          ))}
          {total > 0 ? (
            <View style={[styles.receiptArticleTotalRow, { borderTopColor: tearColor }]}>
              <Text style={[styles.receiptArticleTotalLabel, articlesReceiptTypography('medium'), { color: colors.textMuted }]}>
                TOTAL
              </Text>
              <Text style={[styles.receiptArticleTotalValue, articlesReceiptTypography('medium'), { color: colors.text }]}>
                {formatDisplayMoneyAbsolute(total)}
              </Text>
            </View>
          ) : null}
        </View>
      ) : (
        <Text style={[styles.receiptEmptyText, articlesReceiptTypography('regular'), { color: colors.textMuted }]}>
          Aucun article
        </Text>
      )}

      {/* Receipt attachment section */}
      {receiptLabel ? (
        <>
          <View style={[styles.receiptTearLine, { borderColor: tearColor }]} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={canPreviewReceipt ? 'Voir le reçu' : receiptLabel}
            disabled={!canPreviewReceipt}
            onPress={onViewReceipt}
            style={({ pressed }) => [
              styles.receiptAttachmentRow,
              canPreviewReceipt && pressed && styles.pressed,
            ]}
          >
            {canPreviewReceipt ? (
              <Image
                source={{ uri: transaction.receiptUri ?? '', cacheKey: `${transaction.receiptUri}#thumb` }}
                style={styles.receiptThumbnail}
                contentFit="cover"
                recyclingKey={`${transaction.receiptUri}#thumb`}
                accessibilityLabel="Aperçu du reçu"
              />
            ) : (
              <View style={[styles.receiptThumbnailFallback, { backgroundColor: receiptWell }]}>
                <Ionicons name="receipt-outline" size={16} color={colors.textMuted} />
              </View>
            )}
            <View style={styles.receiptStatusCopy}>
              <Text style={[styles.receiptStatusLabel, typographyKit.caption, { color: colors.text }]}>{receiptLabel}</Text>
              <Text style={[styles.receiptStatusHint, typographyKit.metaMedium, { color: colors.textMuted }]}>
                {canPreviewReceipt ? 'Appuyer pour voir' : 'Remplacer via Ajouter'}
              </Text>
            </View>
            {canPreviewReceipt ? (
              <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
            ) : null}
          </Pressable>
        </>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Joindre un reçu"
          onPress={onOpenReceiptMenu}
          style={({ pressed }) => [
            styles.receiptJoinButton,
            { borderColor: ghostBorder },
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="scan-outline" size={14} color={colors.textMuted} />
          <Text style={[styles.receiptJoinButtonText, typographyKit.metaMedium, { color: colors.textMuted }]}>
            Joindre un reçu
          </Text>
        </Pressable>
      )}
      </View>

      {/* Bottom zigzag — sits over screen canvas below the card body */}
      <ReceiptZigzagEdge width={cardWidth} color={zigzagColor} position="bottom" />
    </View>
  );
}

export default function TransactionDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ transactionId?: string }>();
  const transactionId = typeof params.transactionId === 'string' ? params.transactionId.trim() : '';
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [accounts, setAccounts] = useState<SimulatedAccount[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
  const [receiptPreviewVisible, setReceiptPreviewVisible] = useState(false);
  const [addArticleSheetVisible, setAddArticleSheetVisible] = useState(false);
  const [receiptMenuSheetVisible, setReceiptMenuSheetVisible] = useState(false);
  const [noteEditSheetVisible, setNoteEditSheetVisible] = useState(false);
  const [sharing, setSharing] = useState(false);
  const shareCardRef = useRef<View>(null);

  const load = useCallback(async () => {
    if (!transactionId) {
      setTransaction(null);
      setAccounts([]);
      setCategories([]);
      setSavingsGoals([]);
      return;
    }
    const [nextTransaction, nextAccounts, nextCategories, nextSavingsGoals] = await Promise.all([
      getTransactionById(transactionId),
      getSimulatedAccounts(),
      getCategories(),
      getSavingsGoals(),
    ]);
    setTransaction(nextTransaction);
    setAccounts(nextAccounts);
    setCategories(nextCategories);
    setSavingsGoals(nextSavingsGoals);
  }, [transactionId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => dataEvents.subscribe(load), [load]);

  const isIncome = transaction?.type === 'income';
  const isTransfer = transaction?.type === 'transfer';
  const amountColor = isIncome ? colors.success : isTransfer ? colors.textMuted : colors.text;

  const contactPhotoByKey = useContactPhotoMap();
  const contactPhotoUri = useMemo(
    () => (transaction ? resolveContactPhotoUriForTransaction(transaction, contactPhotoByKey) : null),
    [transaction, contactPhotoByKey],
  );

  const accountOptions = useMemo(() => buildPaymentAccountOptions(accounts), [accounts]);
  const categoryOptions = useMemo(() => buildCategoryPickerOptions(categories), [categories]);

  const persistTransactionUpdate = useCallback(
    async (
      updates: Partial<
        Pick<Transaction, 'label' | 'note' | 'amount' | 'categoryId' | 'categoryName' | 'categoryIcon' | 'categoryColor'>
      >,
      options?: { previousTx?: Transaction; adjustAccountBalances?: boolean },
    ) => {
      if (!transaction) return;
      const previousTx = options?.previousTx ?? transaction;
      const nextTx: Transaction = { ...transaction, ...updates };
      setTransaction(nextTx);

      try {
        await insertTransaction({
          id: nextTx.id,
          label: nextTx.label,
          amount: nextTx.amount,
          type: nextTx.type,
          date: nextTx.date,
          categoryId: nextTx.categoryId,
          transactionIcon: nextTx.transactionIcon,
          receiptUri: nextTx.receiptUri,
          receiptStatus: nextTx.receiptStatus,
          note: nextTx.note,
          wealthAssetId: nextTx.wealthAssetId,
          savingsGoalId: nextTx.savingsGoalId,
          syncStatus: 'pending',
        });

        if (
          options?.adjustAccountBalances
          && (updates.note !== undefined || updates.amount !== undefined)
        ) {
          const previousDeltas = getTransactionAccountDeltas(previousTx);
          const nextDeltas = getTransactionAccountDeltas(nextTx);
          for (const delta of previousDeltas) {
            await adjustSimulatedAccountBalance(delta.id, -delta.delta, { emit: false });
          }
          for (const delta of nextDeltas) {
            await adjustSimulatedAccountBalance(delta.id, delta.delta, { emit: false });
          }
          dataEvents.emit();
        }

        successHaptic();
      } catch {
        setTransaction(previousTx);
        throw new Error('save failed');
      }
    },
    [transaction],
  );

  const handleSaveAccount = useCallback(
    async (newAccountId: string) => {
      if (!transaction || transaction.type === 'transfer') return;
      const newNote = updateAccountInNote(transaction.note, newAccountId);
      const violation = findInsufficientFundsViolation(
        accounts,
        getTransactionAccountDeltas({ ...transaction, note: newNote }),
        transaction,
      );
      if (violation) {
        const { title, message } = insufficientFundsAlertCopy(violation);
        Alert.alert(title, message);
        throw new HandledSaveError();
      }

      await persistTransactionUpdate(
        { note: newNote },
        { previousTx: transaction, adjustAccountBalances: true },
      );
    },
    [accounts, persistTransactionUpdate, transaction],
  );

  const handleSaveCategory = useCallback(
    async (newCategoryId: string) => {
      if (!transaction || transaction.type === 'transfer') return;
      const category = categories.find((item) => item.id === newCategoryId);
      if (!category) throw new Error('category not found');
      await persistTransactionUpdate({
        categoryId: category.id,
        categoryName: category.name,
        categoryIcon: category.icon,
        categoryColor: category.color,
      });
    },
    [categories, persistTransactionUpdate, transaction],
  );

  const handleSaveAmount = useCallback(
    async (newAmountStr: string) => {
      if (!transaction) return;
      const parsed = parseFormattedNumber(newAmountStr);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        Alert.alert('Montant invalide', 'Le montant doit être supérieur à 0.');
        throw new HandledSaveError();
      }
      if (parsed === transaction.amount) return;

      const nextTx = { ...transaction, amount: parsed };
      const violation = findInsufficientFundsViolation(
        accounts,
        getTransactionAccountDeltas(nextTx),
        transaction,
      );
      if (violation) {
        const { title, message } = insufficientFundsAlertCopy(violation);
        Alert.alert(title, message);
        throw new HandledSaveError();
      }

      await persistTransactionUpdate(
        { amount: parsed },
        { previousTx: transaction, adjustAccountBalances: true },
      );
    },
    [accounts, persistTransactionUpdate, transaction],
  );

  const fieldEditors = useMemo<TransactionFieldEditors | undefined>(() => {
    if (!transaction || transaction.type === 'transfer') return undefined;
    const accountId = parseAccountIdFromNote(transaction.note);
    const accountLabel = accountId
      ? resolveAccountIdLabel(accountId, accounts)
      : accountOptions[0]?.label ?? EMPTY_DETAIL_VALUE;
    const categoryLabel = transaction.categoryName?.trim() || EMPTY_DETAIL_VALUE;
    const resolvedCategoryOptions =
      categoryOptions.length > 0
        ? categoryOptions
        : transaction.categoryId && transaction.categoryName
          ? [{ id: transaction.categoryId, label: transaction.categoryName }]
          : [];
    return {
      accountId,
      accountLabel,
      accountOptions: accountOptions.map((option) => ({ id: option.id, label: option.label })),
      categoryId: transaction.categoryId,
      categoryLabel,
      categoryOptions: resolvedCategoryOptions,
      onSaveAccount: handleSaveAccount,
      onSaveCategory: handleSaveCategory,
    };
  }, [
    accountOptions,
    accounts,
    categoryOptions,
    handleSaveAccount,
    handleSaveCategory,
    transaction,
  ]);

  const amountEditor = useMemo<AmountFieldEditor | undefined>(() => {
    if (!transaction) return undefined;
    return {
      amountValue: String(transaction.amount),
      onSaveAmount: handleSaveAmount,
    };
  }, [handleSaveAmount, transaction]);

  const detailSections = useMemo(
    () =>
      transaction
        ? buildTransactionDetailSections(
            transaction,
            accounts,
            savingsGoals,
            amountColor,
            fieldEditors,
            amountEditor,
          )
        : [],
    [transaction, accounts, savingsGoals, amountColor, fieldEditors, amountEditor],
  );

  const insight = useMemo(
    () => (transaction ? getTransactionInsight(transaction, parseItemizedNote(transaction.note)) : null),
    [transaction],
  );

  const navigateToEdit = () => {
    if (!transaction) return;
    tapHaptic();
    router.push({ pathname: '/add-transaction', params: { editId: transaction.id } });
  };

  const persistReceiptAttachment = useCallback(
    async (uri: string) => {
      if (!transaction) return;
      await insertTransaction({
        id: transaction.id,
        label: transaction.label,
        amount: transaction.amount,
        type: transaction.type,
        date: transaction.date,
        categoryId: transaction.categoryId,
        transactionIcon: transaction.transactionIcon,
        receiptUri: uri,
        receiptStatus: 'attached',
        note: transaction.note,
        wealthAssetId: transaction.wealthAssetId,
        savingsGoalId: transaction.savingsGoalId,
        syncStatus: 'pending',
      });
      successHaptic();
      await load();
    },
    [load, transaction],
  );

  const persistNoteUpdate = useCallback(
    async (newNote: string) => {
      if (!transaction) return;
      await insertTransaction({
        id: transaction.id,
        label: transaction.label,
        amount: transaction.amount,
        type: transaction.type,
        date: transaction.date,
        categoryId: transaction.categoryId,
        transactionIcon: transaction.transactionIcon,
        receiptUri: transaction.receiptUri,
        receiptStatus: transaction.receiptStatus,
        note: newNote,
        wealthAssetId: transaction.wealthAssetId,
        savingsGoalId: transaction.savingsGoalId,
        syncStatus: 'pending',
      });
      successHaptic();
      await load();
    },
    [load, transaction],
  );

  const handleAddArticle = useCallback(
    async (name: string, price: string, categoryId: string | null, categoryName: string | null) => {
      if (!transaction) return;
      const priceValue = Number(price) || 0;
      const existing = parseItemizedNote(transaction.note);
      const updated: ItemizedNote[] = [
        ...existing,
        {
          name,
          price: priceValue,
          categoryId,
          categoryName,
        },
      ];
      const newNote = updateArticlesInNote(transaction.note, updated);
      await persistNoteUpdate(newNote);
    },
    [persistNoteUpdate, transaction],
  );

  const handleRemoveArticle = useCallback(
    async (index: number) => {
      if (!transaction) return;
      tapHaptic();
      const existing = parseItemizedNote(transaction.note);
      const updated = existing.filter((_, i) => i !== index);
      const newNote = updateArticlesInNote(transaction.note, updated);
      await persistNoteUpdate(newNote);
    },
    [persistNoteUpdate, transaction],
  );

  const handleScanReceipt = useCallback(() => {
    if (!transaction) return;
    router.push({
      pathname: '/scan',
      params: {
        editId: transaction.id,
        merchant: transaction.label,
        amount: String(transaction.amount),
      },
    });
  }, [router, transaction]);

  const attachReceiptFromGallery = useCallback(async () => {
    try {
      const result = await pickReceiptFromGallery();
      if (result.cancelled || !result.uri) return;
      await persistReceiptAttachment(result.uri);
    } catch {
      Alert.alert('Erreur', 'Impossible d’accéder à la galerie.');
    }
  }, [persistReceiptAttachment]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _deadCode = useCallback(async () => {
    try {
      const result = await pickReceiptFromGallery();
      if (result.cancelled || !result.uri) return;
      await persistReceiptAttachment(result.uri);
    } catch {
      Alert.alert('Erreur', 'Impossible d’accéder à la caméra.');
    }
  }, [persistReceiptAttachment]);

  const openReceiptMenu = useCallback(() => {
    if (!transaction || transaction.type !== 'expense') return;
    tapHaptic();
    setReceiptMenuSheetVisible(true);
  }, [transaction]);

  const handleSaveNote = useCallback(
    async (newVisibleText: string) => {
      if (!transaction) return;
      tapHaptic();
      const newNote = buildNoteWithUpdatedVisibleText(transaction.note, newVisibleText);
      await persistNoteUpdate(newNote);
    },
    [persistNoteUpdate, transaction],
  );

  const handleShareTransaction = useCallback(async () => {
    if (!transaction || sharing) return;
    tapHaptic();
    setSharing(true);
    try {
      const uri = await captureRef(shareCardRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'Partager la transaction',
          UTI: 'public.png',
        });
      } else {
        await Share.share({
          message: `${transaction.label} — ${formatDisplayMoneyAbsolute(transaction.amount)} — ${formatTransactionDate(transaction.date)}`,
        });
      }
    } catch {
      Alert.alert('Erreur', 'Impossible de partager la transaction.');
    } finally {
      setSharing(false);
    }
  }, [transaction, sharing]);

  const confirmDelete = () => {
    tapHaptic();
    setConfirmDeleteVisible(true);
  };

  return (
    <PageTransition>
      <View style={[styles.screen, { backgroundColor: 'transparent' }]}>
        <View style={[styles.topBar, { paddingTop: insets.top + SCREEN_TOP_GUTTER + spacing.lg + spacing.md }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retour"
            hitSlop={12}
            style={({ pressed }) => [
              styles.backButton,
              { backgroundColor: colors.containerBackground, borderColor: colors.containerBorder },
              pressed && styles.pressed,
            ]}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            Détail de transaction
          </Text>
          {transaction ? (
            <OverflowMenuButton
              accessibilityLabel="Options de la transaction"
              items={[
                {
                  key: 'share',
                  label: sharing ? 'Partager…' : 'Partager la transaction',
                  icon: 'share-outline',
                  onPress: () => void handleShareTransaction(),
                },
                {
                  key: 'edit',
                  label: 'Modifier',
                  onPress: navigateToEdit,
                },
                {
                  key: 'delete',
                  label: 'Supprimer',
                  icon: 'trash-outline',
                  destructive: true,
                  onPress: confirmDelete,
                },
              ]}
            />
          ) : (
            <View style={styles.topBarSpacer} />
          )}
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + spacing.xxl, 72) }]}
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
          {transaction ? (
            <View style={styles.scrollContent}>
              <View style={[accountDetailHeroBlockStyle(), { gap: spacing.lg }]}>
                <View style={styles.heroIdentityRow}>
                  <TransactionAvatar transaction={transaction} contactPhotoUri={contactPhotoUri} size={isTransfer ? 46 : 56} />
                  <View style={styles.heroIdentityCopy}>
                    <Text style={[styles.heroLabel, { color: colors.text }]} numberOfLines={2}>
                      {transaction.label}
                    </Text>
                  </View>
                </View>

                <TransactionAmountLabel
                  amount={formatDisplayMoneyAbsolute(transaction.amount)}
                  direction={transactionAmountDirectionFromType(transaction.type)}
                  color={amountColor}
                  textStyle={styles.heroAmount}
                  iconSize={16}
                  containerStyle={styles.heroAmountContainer}
                  showDirectionIcon={!isTransfer}
                />
              </View>

              {insight ? <TransactionInsightCard insight={insight} /> : null}

              <TransactionDetailCard
                sections={detailSections}
                noteText={parseVisibleNoteText(transaction.note)}
                colors={colors}
                onEditNote={() => {
                  tapHaptic();
                  setNoteEditSheetVisible(true);
                }}
              />

              {transaction.type === 'expense' ? (
                <TransactionReceiptCard
                  transaction={transaction}
                  colors={colors}
                  articles={parseItemizedNote(transaction.note)}
                  onAddArticle={() => {
                    tapHaptic();
                    setAddArticleSheetVisible(true);
                  }}
                  onRemoveArticle={(index) => void handleRemoveArticle(index)}
                  onOpenReceiptMenu={openReceiptMenu}
                  onViewReceipt={() => {
                    if (!isPreviewableReceipt(transaction.receiptUri)) return;
                    tapHaptic();
                    setReceiptPreviewVisible(true);
                  }}
                />
              ) : null}
            </View>
          ) : (
            <Text style={[styles.empty, { color: colors.textMuted }]}>
              {transactionId ? 'Transaction introuvable.' : 'Aucune transaction sélectionnée.'}
            </Text>
          )}
        </ScrollView>

        <ConfirmDeleteModal
          visible={confirmDeleteVisible}
          title="Supprimer cette transaction ?"
          message={transaction ? `Supprimer « ${transaction.label} » ? Cette action est irréversible.` : undefined}
          onConfirm={async () => {
            if (!transaction) return;
            setConfirmDeleteVisible(false);
            await deleteTransactionById(transaction.id);
            successHaptic();
            router.back();
          }}
          onCancel={() => setConfirmDeleteVisible(false)}
        />

        {transaction && isPreviewableReceipt(transaction.receiptUri) ? (
          <ReceiptPreviewModal
            visible={receiptPreviewVisible}
            receiptUri={transaction.receiptUri ?? ''}
            onClose={() => setReceiptPreviewVisible(false)}
          />
        ) : null}

        <AddArticleSheet
          visible={addArticleSheetVisible}
          defaultCategoryId={transaction?.categoryId ?? null}
          merchantHint={transaction?.label}
          onAdd={(name, price, categoryId, categoryName) => void handleAddArticle(name, price, categoryId, categoryName)}
          onClose={() => setAddArticleSheetVisible(false)}
        />

        <NoteEditSheet
          visible={noteEditSheetVisible}
          initialText={transaction ? parseVisibleNoteText(transaction.note) : ''}
          onSave={(text) => void handleSaveNote(text)}
          onClose={() => setNoteEditSheetVisible(false)}
        />

        <ReceiptImportSheet
          visible={receiptMenuSheetVisible}
          onScan={() => {
            setReceiptMenuSheetVisible(false);
            handleScanReceipt();
          }}
          onImport={() => {
            setReceiptMenuSheetVisible(false);
            void attachReceiptFromGallery();
          }}
          onClose={() => setReceiptMenuSheetVisible(false)}
        />

        {/* Off-screen share card — captured by react-native-view-shot */}
        {transaction ? (
          <View style={styles.shareCardOffscreen} pointerEvents="none">
            <TransactionShareCard
              transaction={transaction}
              noteText={parseVisibleNoteText(transaction.note)}
              accounts={accounts}
              savingsGoals={savingsGoals}
              insight={insight}
              articles={parseItemizedNote(transaction.note)}
              contactPhotoUri={contactPhotoUri}
              innerRef={shareCardRef}
            />
          </View>
        ) : null}
      </View>
    </PageTransition>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    marginHorizontal: spacing.sm,
    ...jakartaExtraBoldText,
    fontSize: typography.body,
    letterSpacing: -0.2,
  },
  heroIdentityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  heroIdentityCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  heroLabel: {
    ...jakartaExtraBoldText,
    fontSize: typography.dashboardGreeting,
    letterSpacing: -0.4,
  },
  topBarSpacer: { width: 38 },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  scrollContent: {
    gap: spacing.xl,
  },
  heroAmountContainer: {
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  heroAmount: {
    ...detailHeroAmount,
  },
  empty: {
    fontSize: typography.caption,
    lineHeight: 20,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  notesSection: {
    marginTop: detailSubSectionsGap,
  },
  notesSectionHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  notesEditButton: {
    padding: 2,
  },
  notesBlock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.md,
  },
  // ── Receipt card — same horizontal span as other cards, zigzag-only edges ──
  receiptCard: {
    position: 'relative' as const,
    overflow: 'visible' as const,
  },
  receiptCardBody: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  receiptZigzag: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
  },
  receiptCardAccentStripe: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    height: 1.5,
  },
  receiptHeaderRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  receiptHeaderLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.xs,
  },
  receiptTearLine: {
    borderTopWidth: 1,
    borderStyle: 'dashed' as const,
  },
  receiptAddButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.xs,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  receiptAddButtonText: {
    ...typographyKit.metaMedium,
    letterSpacing: 0.2,
  },
  noteBody: {
    lineHeight: 21,
  },
  receiptAttachmentRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
  },
  receiptThumbnail: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
  },
  receiptThumbnailFallback: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  receiptStatusCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  receiptJoinButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: spacing.sm,
    minHeight: 38,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  receiptJoinButtonText: {
    letterSpacing: 0.2,
  },
  receiptPreviewBackdrop: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  receiptPreviewHeader: {
    alignItems: 'flex-end',
    marginBottom: spacing.sm,
    zIndex: 10,
  },
  receiptPreviewCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  receiptPreviewImageWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptFabRow: {
    position: 'absolute',
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  receiptActionButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.78 },

  // Article rows (premium receipt layout)
  receiptArticlesBlock: {
    gap: spacing.xs,
  },
  receiptTableHead: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingBottom: spacing.xs,
  },
  receiptTableHeadLabel: {
    flex: 1,
    minWidth: 0,
    marginBottom: 0,
  },
  receiptTableHeadAmount: {
    marginBottom: 0,
    textAlign: 'right' as const,
    minWidth: 72,
  },
  receiptTableHeadAction: {
    width: 26,
    flexShrink: 0,
  },
  receiptArticleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  receiptArticleCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  receiptArticleName: {
    fontSize: 13,
    letterSpacing: 0.3,
    lineHeight: 18,
  },
  receiptArticleCategory: {
    fontSize: 10,
    letterSpacing: 0.4,
    lineHeight: 14,
  },
  receiptArticlePrice: {
    fontSize: 13,
    letterSpacing: 0.3,
    flexShrink: 0,
    minWidth: 72,
    textAlign: 'right' as const,
  },
  receiptArticleRemoveBtn: {
    width: 26,
    height: 26,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexShrink: 0,
  },
  receiptArticleTotalRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingTop: spacing.sm,
    marginTop: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  receiptArticleTotalLabel: {
    fontSize: 10,
    textTransform: 'uppercase' as const,
    letterSpacing: 1.2,
  },
  receiptArticleTotalValue: {
    fontSize: 13,
    letterSpacing: 0.4,
  },
  receiptEmptyText: {
    fontSize: 12,
    textAlign: 'center' as const,
    paddingVertical: spacing.md,
    letterSpacing: 0.4,
  },
  receiptStatusLabel: {
    lineHeight: 18,
  },
  receiptStatusHint: {
    lineHeight: 15,
  },

  // Bottom sheet (shared)
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end' as const,
  },
  sheet: {
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: radius.pill,
    alignSelf: 'center' as const,
    marginBottom: spacing.sm,
  },
  sheetTitle: {
    ...typographyKit.bodyBold,
    marginBottom: spacing.xs,
  },
  sheetFields: {
    gap: spacing.md,
  },
  sheetInput: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    ...typographyKit.bodyMedium,
  },
  noteTextInput: {
    minHeight: 110,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  sheetPriceWrap: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
  },
  sheetPriceInput: {
    flex: 1,
    textAlign: 'right' as const,
    ...typographyKit.bodyMedium,
    fontVariant: ['tabular-nums'] as const,
    paddingVertical: spacing.sm,
  },
  sheetCurrency: {
    ...jakartaBoldText,
    fontSize: typography.body,
    marginLeft: spacing.xs,
  },
  sheetSaveButton: {
    minHeight: 48,
    borderRadius: radius.lg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginTop: spacing.xs,
    paddingVertical: spacing.lg,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 6,
  },
  sheetSaveButtonText: {
    ...jakartaExtraBoldText,
    fontSize: typography.body,
    letterSpacing: 0.2,
  },
  sheetCancelButton: {
    minHeight: 44,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  sheetCancelButtonText: {
    ...typographyKit.metaMedium,
  },

  // ── AddArticleSheet ────────────────────────────────────────────────────────
  articleSheet: {
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    maxHeight: '88%',
  },
  articleSheetHandle: {
    width: 38,
    height: 4,
    borderRadius: radius.pill,
    alignSelf: 'center' as const,
    marginBottom: spacing.sm,
  },
  articleSheetHeader: {
    gap: spacing.xs,
  },
  articleSheetFixedTop: {
    gap: spacing.md,
  },
  articleSheetScroll: {
    flexShrink: 1,
    flexGrow: 0,
  },
  articleSheetScrollContent: {
    gap: spacing.md,
    paddingBottom: spacing.xs,
  },
  articleFieldGroup: {
    gap: spacing.xs,
  },
  articleSuggestionsGroup: {
    gap: spacing.xs,
  },
  articleInputShell: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 48,
    justifyContent: 'center' as const,
  },
  articleNameInput: {
    ...typographyKit.bodyMedium,
    paddingVertical: spacing.sm,
    backgroundColor: 'transparent',
  },
  articleChipsContent: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  articleCategoryShell: {
    borderRadius: radius.md,
    overflow: 'hidden' as const,
  },
  articleCategoryContent: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  articleCategoryChip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
  },
  articleCategoryChipText: {
    ...jakartaBoldText,
    fontSize: typography.micro,
    letterSpacing: 0.1,
  },
  articlePriceShell: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 56,
  },
  articleCurrencySymbol: {
    fontSize: 24,
    letterSpacing: -0.5,
  },
  articlePriceInput: {
    flex: 1,
    fontSize: 32,
    letterSpacing: -1,
    paddingVertical: spacing.sm,
    minHeight: 48,
  },
  articlePressed: {
    opacity: 0.75,
  },
  articleSheetActions: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  articleCancelButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  articleCancelButtonText: {
    ...typographyKit.metaMedium,
  },
  articleSaveButton: {
    flex: 1.35,
    minHeight: 48,
    borderRadius: radius.lg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  articleSaveButtonText: {
    ...typographyKit.caption,
    color: '#000000',
    letterSpacing: 0.1,
  },
  articleSaveButtonDisabled: {
    opacity: 0.35,
  },

  // Receipt import menu rows
  importMenuRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  importMenuRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  importMenuIconWell: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  importMenuRowText: {
    flex: 1,
    ...typographyKit.caption,
  },

  // Off-screen capture container for the share card
  shareCardOffscreen: {
    position: 'absolute' as const,
    left: -9999,
    top: 0,
  },
});

const shareCardStyles = StyleSheet.create({
  root: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    gap: spacing.xl,
  },
  heroBlock: {
    gap: spacing.lg,
  },
  heroIdentityRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
  },
  heroLabel: {
    ...jakartaExtraBoldText,
    flex: 1,
    minWidth: 0,
    fontSize: typography.dashboardGreeting,
    letterSpacing: -0.4,
    lineHeight: 28,
  },
  heroAmount: {
    ...detailHeroAmount,
    textAlign: 'center' as const,
    alignSelf: 'stretch' as const,
  },
  surfaceCard: {
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  insightHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
  },
  insightIconWell: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  insightEyebrow: {
    flex: 1,
    minWidth: 0,
  },
  insightText: {
    ...jakartaMediumText,
    ...typographyKit.metaMedium,
    lineHeight: typography.meta + 6,
    marginTop: spacing.xs,
  },
  shareNotesSection: {
    marginTop: detailSubSectionsGap,
  },
  shareNotesBlock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.md,
  },
  shareNoteBody: {
    lineHeight: 21,
  },
  articlesHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.xs,
  },
  articlesTearLine: {
    borderTopWidth: 1,
    borderStyle: 'dashed' as const,
  },
  shareArticleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 9,
    gap: spacing.sm,
  },
  shareArticleCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  shareArticleName: {
    fontSize: 13,
    letterSpacing: 0.3,
    lineHeight: 18,
  },
  shareArticleCategory: {
    fontSize: 10,
    letterSpacing: 0.4,
    lineHeight: 14,
  },
  shareArticlePrice: {
    fontSize: 13,
    letterSpacing: 0.3,
    flexShrink: 0,
  },
  shareArticleTotalRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingTop: spacing.sm,
    marginTop: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  shareArticleTotalLabel: {
    fontSize: 10,
    textTransform: 'uppercase' as const,
    letterSpacing: 1.2,
  },
  shareArticleTotalValue: {
    fontSize: 13,
    letterSpacing: 0.4,
  },
  shareArticlesEmpty: {
    fontSize: 12,
    textAlign: 'center' as const,
    paddingVertical: spacing.md,
    letterSpacing: 0.4,
  },
  shareReceiptRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
  },
  shareReceiptThumbnail: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
  },
  shareReceiptThumbnailFallback: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  shareReceiptCopy: {
    flex: 1,
    minWidth: 0,
  },
  shareReceiptLabel: {
    fontSize: 13,
    letterSpacing: 0.3,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: spacing.xs,
    paddingTop: spacing.xs,
  },
  footerText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontWeight: 'normal' as const,
    fontSize: 11,
    letterSpacing: 0.3,
  },
});
