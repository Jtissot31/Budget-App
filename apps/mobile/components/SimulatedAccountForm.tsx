/**
 * Create-account sheet for Portefeuille.
 * Live preview row on top → bank (logo chips) → balance (hero) → optional details.
 * The account type is chosen beforehand in AddAccountSheet.
 */
import { type Dispatch, type SetStateAction, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChipSelectField } from '@/components/ChipSelectField';
import { DraggableSheetScrollView, DraggableSheetSurface } from '@/components/DraggableSheetSurface';
import {
  FORM_SHEET_CONTENT_PADDING_TOP,
  FormSheetChromeHeader,
  FormSheetModalBody,
  formSheetScrollContentStyle,
  formSheetScrollPaddingBottom,
  formSheetScrollViewStyle,
  useFormSheetHeight,
  useFormSheetKeyboardInset,
} from '@/lib/sheet/formSheetScroll';
import { AppIcon } from '@/components/icons/AppIcon';
import { CASH_BANKNOTES_ICON } from '@/components/icons/CashBanknotesOutlineIcon';
import { IconPickerSheet } from '@/components/IconPickerSheet';
import { LogoIconFrame } from '@/components/IconFrame';
import { PressScale } from '@/components/kit/motion';
import { NumericAmountInput } from '@/components/NumericAmountInput';
import { PrimarySaveButton } from '@/components/PrimarySaveButton';
import type { SettingsPickerOption } from '@/components/SettingsPickerSheet';
import { ThemedFormMessage } from '@/components/ThemedFormMessage';
import { UserPickedIconWell } from '@/components/UserPickedIconWell';
import { ghostCardShadow } from '@/constants/ghostUi';
import {
  FORM_SECTION_LABEL_STYLE,
  jakartaBoldText,
  jakartaMediumText,
  jakartaSemiboldText,
  radius,
  spacing,
  typography,
} from '@/constants/theme';
import { accountBalanceIconForKind } from '@/lib/accountBalancePresentation';
import { listBankInstitutions } from '@/lib/bankSync';
import { insertSimulatedAccount } from '@/lib/db';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { formValidationError, type FormFeedback, type FormSaveResult } from '@/lib/formFeedback';
import { parseFormattedNumber, sanitizeNumericInput } from '@/lib/formatNumber';
import { successHaptic, tapHaptic } from '@/lib/haptics';
import { getAccountLogoAsset, getAccountLogoUrl, getStableAccountLogoUrl } from '@/lib/merchantLogo';
import type { MdiIconName } from '@/lib/mdiIconCatalog';
import { useAppTheme } from '@/lib/themeContext';
import type { AccountKind, SimulatedAccount } from '@/types';

export type AccountForm = {
  id: string;
  name: string;
  kind: AccountKind;
  balance: string;
  institution: string;
  /** Last 4 digits of the card / account — tells similar accounts apart. */
  last4: string;
  creditLimit: string;
  dueDay: string;
  interestRate: string;
  /** Manual icon (MDI); null = auto logo / kind glyph. */
  icon: string | null;
  displayOrder: number;
  createdAt: string;
};

/** Supported account types — picker order matches Portefeuille MES COMPTES. */
export const ACCOUNT_KIND_OPTIONS: {
  id: AccountKind;
  label: string;
  description: string;
  icon: string;
}[] = [
  { id: 'cash', label: 'Espèces', description: 'Argent cash — solde manuel', icon: 'cash-outline' },
  { id: 'checking', label: 'Chèque', description: 'Compte bancaire courant', icon: 'wallet-outline' },
  { id: 'savings', label: 'Épargne', description: 'Compte d’épargne', icon: 'trending-up-outline' },
  { id: 'credit', label: 'Crédit', description: 'Carte ou ligne de crédit', icon: 'card-outline' },
];

const KIND_LABEL: Record<AccountKind, string> = {
  checking: 'Chèque',
  savings: 'Épargne',
  credit: 'Crédit',
  cash: 'Espèces',
};

const OTHER_BANK_ID = '__other';

function accountCreateFormTitle(kind: AccountKind) {
  if (kind === 'credit') return 'Nouvelle carte de crédit';
  if (kind === 'savings') return 'Nouveau compte épargne';
  if (kind === 'cash') return 'Nouvel argent comptant';
  return 'Nouveau compte chèque';
}

/** Name used when the user leaves « Nom » empty — « Chèque Desjardins », « Carte de crédit »… */
function autoAccountName(kind: AccountKind, institution: string) {
  const bank = institution.trim();
  if (kind === 'cash') return 'Espèces';
  if (kind === 'credit') return bank ? `Carte ${bank}` : 'Carte de crédit';
  if (kind === 'savings') return bank ? `Épargne ${bank}` : 'Compte épargne';
  return bank ? `Chèque ${bank}` : 'Compte chèque';
}

export function createNewAccountForm(displayOrder = 0, initialType: AccountKind = 'checking'): AccountForm {
  return {
    id: `sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: '',
    kind: initialType,
    balance: '',
    institution: '',
    last4: '',
    creditLimit: '',
    dueDay: '',
    interestRate: '',
    icon: null,
    displayOrder,
    createdAt: new Date().toISOString(),
  };
}

function parseOptionalMoney(value: string) {
  const parsed = parseFormattedNumber(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function parseOptionalInt(value: string) {
  const parsed = Number.parseInt(sanitizeNumericInput(value), 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export async function saveSimulatedAccountForm(form: AccountForm): Promise<FormSaveResult> {
  const parsedBalance = parseFormattedNumber(form.balance.trim() || '0');
  if (Number.isNaN(parsedBalance)) {
    return formValidationError('Solde invalide', 'Entre un montant valide.');
  }
  const dueDay = form.kind === 'credit' ? parseOptionalInt(form.dueDay) : undefined;
  if (dueDay != null && (dueDay < 1 || dueDay > 31)) {
    return formValidationError('Jour d’échéance invalide', 'Entre un jour entre 1 et 31.');
  }
  const last4 = form.last4.replace(/\D/g, '');
  if (last4 && last4.length !== 4) {
    return formValidationError('4 derniers chiffres', 'Entre exactement 4 chiffres, ou laisse vide.');
  }

  const name = form.name.trim() || autoAccountName(form.kind, form.institution);
  const logoSource = form.institution.trim() || name;
  const account: SimulatedAccount = {
    id: form.id,
    name,
    kind: form.kind,
    balance: form.kind === 'credit' ? -Math.abs(parsedBalance) : parsedBalance,
    institution: form.kind === 'cash' ? undefined : form.institution.trim() || undefined,
    last4: form.kind === 'cash' ? undefined : last4 || undefined,
    creditLimit: form.kind === 'credit' ? parseOptionalMoney(form.creditLimit) : undefined,
    dueDay,
    interestRate:
      form.kind === 'savings' || form.kind === 'credit' ? parseOptionalMoney(form.interestRate) : undefined,
    logoUrl: form.kind === 'cash' ? undefined : getStableAccountLogoUrl(logoSource) ?? undefined,
    icon: form.icon?.trim() || null,
    hidden: false,
    displayOrder: form.displayOrder,
    createdAt: form.createdAt,
  };

  await insertSimulatedAccount(account);
  successHaptic();
  return true;
}

export function SimulatedAccountFormModal({
  form,
  setForm,
  saving,
  onDismiss,
  onSave,
  feedback,
}: {
  form: AccountForm | null;
  setForm: Dispatch<SetStateAction<AccountForm | null>>;
  saving: boolean;
  onDismiss: () => void;
  onSave: () => void | Promise<void>;
  feedback?: FormFeedback | null;
  /** Kept for call-site compatibility — the type is always chosen beforehand now. */
  lockedType?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const sheetHeight = useFormSheetHeight(0.92);
  const keyboardInset = useFormSheetKeyboardInset();
  const { colors, isLight } = useAppTheme();
  const [iconPickerVisible, setIconPickerVisible] = useState(false);
  const [otherBank, setOtherBank] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    setIconPickerVisible(false);
    setOtherBank(false);
    setMoreOpen(false);
  }, [form?.id]);

  const banks = useMemo(() => listBankInstitutions().filter((bank) => bank.popular), []);
  const bankOptions = useMemo<SettingsPickerOption<string>[]>(
    () => [
      ...banks.map((bank) => ({ id: bank.id, label: bank.name, logoAsset: bank.logoAsset, logoUrl: bank.logoUrl })),
      { id: OTHER_BANK_ID, label: 'Autre', icon: 'ellipsis-horizontal' },
    ],
    [banks],
  );

  const kind = form?.kind ?? 'checking';
  const institution = form?.institution.trim() ?? '';
  const matchedBank = banks.find((bank) => bank.name.toLowerCase() === institution.toLowerCase()) ?? null;
  const selectedBankId = matchedBank ? matchedBank.id : otherBank || institution ? OTHER_BANK_ID : '';

  const manualIcon = form?.icon?.trim() || null;
  const displayName = form?.name.trim() || autoAccountName(kind, institution);
  const logoSource = institution || form?.name.trim() || '';
  const previewLogoAsset = useMemo(() => {
    if (manualIcon) return null;
    if (kind === 'cash') return CASH_BANKNOTES_ICON;
    return logoSource ? getAccountLogoAsset(logoSource) : null;
  }, [kind, logoSource, manualIcon]);
  const previewLogoUrl = useMemo(() => {
    if (manualIcon || previewLogoAsset || kind === 'cash' || !logoSource) return null;
    return getStableAccountLogoUrl(logoSource) ?? getAccountLogoUrl(logoSource);
  }, [kind, logoSource, manualIcon, previewLogoAsset]);

  if (!form) return null;

  const update = (patch: Partial<AccountForm>) => setForm((prev) => (prev ? { ...prev, ...patch } : prev));
  const balanceValue = parseFormattedNumber(form.balance || '0');
  const last4 = form.last4.replace(/\D/g, '');
  const previewMeta = [KIND_LABEL[kind], last4.length === 4 ? `··${last4}` : null].filter(Boolean).join(' ');
  const hasExtras = kind === 'credit' || kind === 'savings';

  const inputSurface = { backgroundColor: colors.input, borderColor: colors.border };
  const sectionLabel = [FORM_SECTION_LABEL_STYLE, { color: colors.textMuted }];

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onDismiss}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={[styles.backdrop, { backgroundColor: isLight ? 'rgba(25, 22, 18, 0.30)' : 'rgba(0, 0, 0, 0.62)' }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
          <FormSheetModalBody>
            <DraggableSheetSurface
              onClose={onDismiss}
              sheetHeight={sheetHeight}
              style={[
                styles.sheet,
                ghostCardShadow,
                { backgroundColor: colors.background, borderColor: colors.containerBorder },
              ]}
            >
              <FormSheetChromeHeader
                title={accountCreateFormTitle(kind)}
                onClose={onDismiss}
                titleColor={colors.text}
                closeIconColor={colors.textMuted}
                handleColor={colors.borderStrong}
                closeButtonStyle={{ backgroundColor: colors.surfaceElevated }}
                headerStyle={styles.headerPad}
              />

              <DraggableSheetScrollView
                style={formSheetScrollViewStyle()}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={[
                  styles.content,
                  formSheetScrollContentStyle,
                  { paddingBottom: formSheetScrollPaddingBottom(insets.bottom, keyboardInset) },
                ]}
              >
                {/* Live preview — exactly what the Wallet row will show. */}
                <View style={[styles.preview, { backgroundColor: colors.containerBackground, borderColor: colors.containerBorder }]}>
                  <PressScale
                    accessibilityRole="button"
                    accessibilityLabel="Changer l’icône du compte"
                    onPress={() => {
                      tapHaptic();
                      setIconPickerVisible(true);
                    }}
                    scaleTo={0.9}
                    style={styles.previewIcon}
                  >
                    {previewLogoAsset || previewLogoUrl ? (
                      <LogoIconFrame asset={previewLogoAsset} uri={previewLogoUrl} size={40} />
                    ) : (
                      <UserPickedIconWell icon={manualIcon || accountBalanceIconForKind(kind)} size={40} iconSize={20} />
                    )}
                    <View style={[styles.editBadge, { backgroundColor: colors.text, borderColor: colors.containerBackground }]}>
                      <AppIcon family="ionicons" name="pencil" size={9} color={colors.background} />
                    </View>
                  </PressScale>
                  <View style={styles.previewCopy}>
                    <Text style={[styles.previewName, { color: colors.text }]} numberOfLines={1}>
                      {displayName}
                    </Text>
                    <Text style={[styles.previewMeta, { color: colors.textMuted }]} numberOfLines={1}>
                      {previewMeta}
                    </Text>
                  </View>
                  <Text style={[styles.previewBalance, { color: kind === 'credit' && balanceValue > 0 ? colors.danger : colors.text }]}>
                    {kind === 'credit' && balanceValue > 0 ? '−' : ''}
                    {formatDisplayMoneyAbsolute(Number.isNaN(balanceValue) ? 0 : balanceValue)}
                  </Text>
                </View>
                {manualIcon ? (
                  <Pressable accessibilityRole="button" onPress={() => update({ icon: null })} hitSlop={8}>
                    <Text style={[styles.link, { color: colors.textMuted }]}>Revenir au logo automatique</Text>
                  </Pressable>
                ) : null}

                {/* Bank — logo chips, « Autre » reveals a text field. */}
                {kind !== 'cash' ? (
                  <View style={styles.section}>
                    <ChipSelectField
                      label={kind === 'credit' ? 'Émetteur' : 'Banque'}
                      options={bankOptions}
                      selectedId={selectedBankId}
                      onSelect={(id) => {
                        if (id === OTHER_BANK_ID) {
                          setOtherBank(true);
                          if (matchedBank) update({ institution: '' });
                          return;
                        }
                        setOtherBank(false);
                        update({ institution: banks.find((bank) => bank.id === id)?.name ?? '' });
                      }}
                    />
                    {selectedBankId === OTHER_BANK_ID ? (
                      <TextInput
                        value={form.institution}
                        onChangeText={(value) => update({ institution: value })}
                        placeholder="Nom de l’institution"
                        placeholderTextColor={colors.textMuted}
                        autoFocus={!form.institution}
                        style={[styles.input, inputSurface, { color: colors.text }]}
                      />
                    ) : null}
                  </View>
                ) : null}

                {/* Balance — the key number, so it gets the hero treatment. */}
                <View style={styles.section}>
                  <Text style={sectionLabel}>{kind === 'credit' ? 'Solde dû' : 'Solde actuel'}</Text>
                  <View style={[styles.amountShell, inputSurface]}>
                    <NumericAmountInput
                      value={form.balance}
                      onChangeText={(balance) => update({ balance })}
                      placeholder="0"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="decimal-pad"
                      style={[styles.amountInput, { color: colors.text }]}
                      accessibilityLabel={kind === 'credit' ? 'Solde dû' : 'Solde actuel'}
                    />
                    <Text style={[styles.amountSuffix, { color: colors.textMuted }]}>$</Text>
                  </View>
                </View>

                {kind === 'credit' ? (
                  <View style={styles.pair}>
                    <LabeledInput
                      label="Limite"
                      value={form.creditLimit}
                      onChangeText={(creditLimit) => update({ creditLimit })}
                      placeholder="5 000"
                      keyboardType="decimal-pad"
                      suffix="$"
                    />
                    <LabeledInput
                      label="Échéance (jour)"
                      value={form.dueDay}
                      onChangeText={(dueDay) => update({ dueDay: dueDay.replace(/\D/g, '') })}
                      placeholder="15"
                      keyboardType="number-pad"
                      maxLength={2}
                    />
                  </View>
                ) : null}

                {kind !== 'cash' ? (
                  <View style={styles.pair}>
                    <LabeledInput
                      label="Nom (optionnel)"
                      value={form.name}
                      onChangeText={(name) => update({ name })}
                      placeholder={autoAccountName(kind, institution)}
                    />
                    <LabeledInput
                      label="4 derniers chiffres"
                      value={form.last4}
                      onChangeText={(value) => update({ last4: value.replace(/\D/g, '').slice(0, 4) })}
                      placeholder="1234"
                      keyboardType="number-pad"
                      maxLength={4}
                      narrow
                    />
                  </View>
                ) : (
                  <LabeledInput
                    label="Nom (optionnel)"
                    value={form.name}
                    onChangeText={(name) => update({ name })}
                    placeholder="Espèces"
                  />
                )}

                {/* Rarely needed details stay folded away. */}
                {hasExtras ? (
                  <View style={styles.section}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ expanded: moreOpen }}
                      onPress={() => {
                        tapHaptic();
                        setMoreOpen((open) => !open);
                      }}
                      style={styles.moreRow}
                    >
                      <Text style={[styles.moreText, { color: colors.textSecondary }]}>Plus d’options</Text>
                      <AppIcon
                        family="ionicons"
                        name={moreOpen ? 'chevron-up' : 'chevron-down'}
                        size={16}
                        color={colors.textMuted}
                      />
                    </Pressable>
                    {moreOpen ? (
                      <LabeledInput
                        label="Taux d’intérêt"
                        value={form.interestRate}
                        onChangeText={(interestRate) => update({ interestRate })}
                        placeholder={kind === 'credit' ? '19,99' : '3,25'}
                        keyboardType="decimal-pad"
                        suffix="%"
                      />
                    ) : null}
                  </View>
                ) : (
                  <Text style={[styles.hint, { color: colors.textMuted }]}>
                    Solde mis à jour à la main — pas de synchronisation bancaire.
                  </Text>
                )}

                {feedback ? (
                  <ThemedFormMessage variant={feedback.variant} title={feedback.title} message={feedback.message} />
                ) : null}

                <PrimarySaveButton label="Ajouter le compte" onPress={() => void onSave()} loading={saving} />
              </DraggableSheetScrollView>
            </DraggableSheetSurface>
          </FormSheetModalBody>
        </View>

        <IconPickerSheet
          visible={iconPickerVisible}
          selectedIcon={manualIcon}
          title="Choisir une icône"
          onClose={() => setIconPickerVisible(false)}
          onSelect={(icon: MdiIconName) => {
            update({ icon });
            setIconPickerVisible(false);
          }}
        />
      </GestureHandlerRootView>
    </Modal>
  );
}

function LabeledInput({
  label,
  suffix,
  keyboardType,
  narrow = false,
  ...inputProps
}: React.ComponentProps<typeof TextInput> & { label: string; suffix?: string; narrow?: boolean }) {
  const { colors } = useAppTheme();
  const InputComponent = keyboardType === 'decimal-pad' ? NumericAmountInput : TextInput;
  return (
    <View style={[styles.section, narrow ? styles.narrow : styles.grow]}>
      <Text style={[FORM_SECTION_LABEL_STYLE, { color: colors.textMuted }]} numberOfLines={1}>
        {label}
      </Text>
      <View style={[styles.inputShell, { backgroundColor: colors.input, borderColor: colors.border }]}>
        <InputComponent
          {...inputProps}
          keyboardType={keyboardType}
          placeholderTextColor={colors.textMuted}
          style={[styles.inputInner, { color: colors.text }]}
        />
        {suffix ? <Text style={[styles.suffix, { color: colors.textMuted }]}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    borderWidth: StyleSheet.hairlineWidth,
    paddingTop: FORM_SHEET_CONTENT_PADDING_TOP,
  },
  headerPad: { paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  content: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  section: { gap: spacing.sm },
  pair: { flexDirection: 'row', gap: spacing.sm },
  grow: { flex: 1, minWidth: 0 },
  narrow: { width: 132 },

  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
  },
  previewIcon: { width: 40, height: 40 },
  editBadge: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewCopy: { flex: 1, minWidth: 0, gap: 2 },
  previewName: { ...jakartaSemiboldText, fontSize: typography.body },
  previewMeta: { ...jakartaMediumText, fontSize: 12.5 },
  previewBalance: { ...jakartaSemiboldText, fontSize: typography.body },
  link: { ...jakartaMediumText, fontSize: 12.5, marginTop: -spacing.sm, marginLeft: 2 },

  input: {
    minHeight: 48,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    ...jakartaMediumText,
    fontSize: 15,
  },
  inputShell: {
    minHeight: 48,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inputInner: { flex: 1, minWidth: 0, paddingVertical: 10, ...jakartaMediumText, fontSize: 15 },
  suffix: { ...jakartaMediumText, fontSize: 14 },

  amountShell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 64,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
  },
  amountInput: { flex: 1, minWidth: 0, ...jakartaBoldText, fontSize: 28, letterSpacing: -0.5, paddingVertical: 8 },
  amountSuffix: { ...jakartaBoldText, fontSize: 22 },

  moreRow: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 4 },
  moreText: { ...jakartaSemiboldText, fontSize: 14 },
  hint: { ...jakartaMediumText, fontSize: 12.5, lineHeight: 17 },
});
