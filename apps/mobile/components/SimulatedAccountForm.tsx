/**
 * Create-account sheet for Portefeuille — mirrors account-detail edit fields.
 * Name + icon identity row matches add-budget-category / recurring payment forms.
 */
import { type Dispatch, type SetStateAction, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  DraggableSheetScrollView,
  DraggableSheetSurface,
} from '@/components/DraggableSheetSurface';
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
import { DashboardSectionLabel } from '@/components/DashboardSectionLabel';
import { IconPickerSheet } from '@/components/IconPickerSheet';
import { LogoIconFrame } from '@/components/IconFrame';
import { MdiIcon } from '@/components/MdiIcon';
import { NumericAmountInput } from '@/components/NumericAmountInput';
import { PrimarySaveButton } from '@/components/PrimarySaveButton';
import { ThemeSegmentedControl } from '@/components/ThemeSegmentedControl';
import { ThemedFormMessage } from '@/components/ThemedFormMessage';
import { UserPickedIconWell } from '@/components/UserPickedIconWell';
import { ghostCardShadow } from '@/constants/ghostUi';
import {
  FORM_SECTION_LABEL_STYLE,
  jakartaBoldText,
  jakartaSemiboldText,
  radius,
  spacing,
  typography,
  typographyKit,
} from '@/constants/theme';
import {
  ACCOUNT_ICON_PICKER_OPTIONS,
  accountBalanceIconForKind,
} from '@/lib/accountBalancePresentation';
import { insertSimulatedAccount } from '@/lib/db';
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
  {
    id: 'cash',
    label: 'Espèces',
    description: 'Argent cash — solde manuel',
    icon: 'cash-outline',
  },
  {
    id: 'checking',
    label: 'Chèque',
    description: 'Compte bancaire courant',
    icon: 'wallet-outline',
  },
  {
    id: 'savings',
    label: 'Épargne',
    description: 'Compte d’épargne',
    icon: 'trending-up-outline',
  },
  {
    id: 'credit',
    label: 'Crédit',
    description: 'Carte ou ligne de crédit',
    icon: 'card-outline',
  },
];

const KIND_TABS: { id: AccountKind; label: string }[] = ACCOUNT_KIND_OPTIONS.map(
  ({ id, label }) => ({ id, label }),
);

function accountCreateFormTitle(kind: AccountKind) {
  if (kind === 'credit') return 'Nouvelle carte de crédit';
  if (kind === 'savings') return 'Nouveau compte épargne';
  if (kind === 'cash') return 'Nouvel Argent Cash';
  return 'Nouveau compte chèque';
}

function defaultNameForKind(kind: AccountKind) {
  if (kind === 'credit') return 'Carte de crédit';
  if (kind === 'savings') return 'Compte épargne';
  if (kind === 'cash') return 'Espèces';
  return 'Compte chèque';
}

function identityGhostIcon(kind: AccountKind): string {
  if (kind === 'credit') return 'card-outline';
  if (kind === 'savings') return 'trending-up-outline';
  if (kind === 'cash') return 'cash-outline';
  return 'wallet-outline';
}

function namePlaceholder(kind: AccountKind) {
  if (kind === 'credit') return 'Visa Desjardins';
  if (kind === 'cash') return 'Argent Cash';
  if (kind === 'savings') return 'CELI Tangerine';
  return 'Tangerine chèque';
}

export function createNewAccountForm(
  displayOrder = 0,
  initialType: AccountKind = 'checking',
): AccountForm {
  return {
    id: `sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: '',
    kind: initialType,
    balance: '',
    institution: '',
    creditLimit: '',
    dueDay: '',
    interestRate: '',
    icon: null,
    displayOrder,
    createdAt: new Date().toISOString(),
  };
}

function parseMoney(value: string) {
  return parseFormattedNumber(value);
}

function parseOptionalMoney(value: string) {
  const parsed = parseMoney(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function parseOptionalInt(value: string) {
  const parsed = Number.parseInt(sanitizeNumericInput(value), 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export async function saveSimulatedAccountForm(form: AccountForm): Promise<FormSaveResult> {
  const parsedBalance = parseMoney(form.balance.trim() || '0');
  const name = form.name.trim() || defaultNameForKind(form.kind);
  if (Number.isNaN(parsedBalance)) {
    return formValidationError('Solde invalide', 'Entre un montant valide.');
  }

  const logoSource = form.institution.trim() || name;
  const manualIcon = form.icon?.trim() || null;
  const account: SimulatedAccount = {
    id: form.id,
    name,
    kind: form.kind,
    balance: form.kind === 'credit' ? -Math.abs(parsedBalance) : parsedBalance,
    institution: form.kind === 'cash' ? undefined : form.institution.trim() || undefined,
    creditLimit: form.kind === 'credit' ? parseOptionalMoney(form.creditLimit) : undefined,
    dueDay: form.kind === 'credit' ? parseOptionalInt(form.dueDay) : undefined,
    interestRate:
      form.kind === 'savings' || form.kind === 'credit'
        ? parseOptionalMoney(form.interestRate)
        : undefined,
    logoUrl: form.kind === 'cash' ? undefined : getStableAccountLogoUrl(logoSource) ?? undefined,
    icon: manualIcon,
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
  lockedType = false,
}: {
  form: AccountForm | null;
  setForm: Dispatch<SetStateAction<AccountForm | null>>;
  saving: boolean;
  onDismiss: () => void;
  onSave: () => void | Promise<void>;
  feedback?: FormFeedback | null;
  /** When true, hide the type segmented control — type was chosen in a prior step. */
  lockedType?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const sheetHeight = useFormSheetHeight(0.92);
  const keyboardInset = useFormSheetKeyboardInset();
  const { colors, isLight, ghost } = useAppTheme();
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [fullIconPickerVisible, setFullIconPickerVisible] = useState(false);
  const sectionLabelStyle = [FORM_SECTION_LABEL_STYLE, { color: colors.text }];

  useEffect(() => {
    setShowIconPicker(false);
    setFullIconPickerVisible(false);
  }, [form?.id]);

  const themed = useMemo(
    () => ({
      modalBackdrop: { backgroundColor: isLight ? 'rgba(25, 22, 18, 0.30)' : 'rgba(0, 0, 0, 0.62)' },
      sheet: {
        backgroundColor: colors.background,
        borderColor: colors.containerBorder,
        borderWidth: StyleSheet.hairlineWidth,
      },
      handle: { backgroundColor: colors.borderStrong },
      closeButton: {
        backgroundColor: colors.surfaceElevated,
        borderColor: colors.border,
        borderWidth: StyleSheet.hairlineWidth,
      },
      control: {
        backgroundColor: ghost.obsidianSoft,
        borderColor: colors.borderStrong,
        borderWidth: StyleSheet.hairlineWidth,
      },
      text: { color: colors.text },
      textSecondary: { color: colors.textSecondary },
      textMuted: { color: colors.textMuted },
    }),
    [colors, ghost, isLight],
  );

  const kind = form?.kind ?? 'checking';
  const trimmedName = form?.name.trim() ?? '';
  const trimmedInstitution = form?.institution.trim() ?? '';
  const manualIcon = form?.icon?.trim() || null;
  const logoSource = (trimmedInstitution || trimmedName).trim();
  const previewLogoAsset = useMemo(() => {
    if (manualIcon) return null;
    if (kind === 'cash') return CASH_BANKNOTES_ICON;
    if (!logoSource) return null;
    return getAccountLogoAsset(logoSource);
  }, [kind, logoSource, manualIcon]);
  const previewLogo = useMemo(() => {
    if (manualIcon || previewLogoAsset) return null;
    if (kind === 'cash') return null;
    if (!logoSource) return null;
    return getStableAccountLogoUrl(logoSource) ?? getAccountLogoUrl(logoSource);
  }, [kind, logoSource, manualIcon, previewLogoAsset]);
  const previewIcon = manualIcon || accountBalanceIconForKind(kind);
  const hasIdentityContent = Boolean(
    manualIcon || previewLogoAsset || previewLogo || trimmedName || trimmedInstitution,
  );

  if (!form) return null;

  const setManualIcon = (icon: string | null) => {
    setForm((prev) => (prev ? { ...prev, icon } : prev));
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onDismiss}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={[styles.modalBackdrop, themed.modalBackdrop]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
          <FormSheetModalBody>
            <DraggableSheetSurface
              onClose={onDismiss}
              sheetHeight={sheetHeight}
              style={[styles.modalSheet, ghostCardShadow, themed.sheet]}
            >
              <FormSheetChromeHeader
                title={accountCreateFormTitle(kind)}
                onClose={onDismiss}
                titleColor={colors.text}
                closeIconColor={colors.textMuted}
                handleColor={colors.borderStrong}
                closeButtonStyle={themed.closeButton}
                headerStyle={styles.modalHeaderPad}
              />

              <DraggableSheetScrollView
                style={formSheetScrollViewStyle()}
                contentContainerStyle={[
                  styles.modalContent,
                  formSheetScrollContentStyle,
                  { paddingBottom: formSheetScrollPaddingBottom(insets.bottom, keyboardInset) },
                ]}
              >
                {lockedType ? null : (
                  <ThemeSegmentedControl
                    size="sm"
                    tabs={KIND_TABS}
                    active={kind}
                    onChange={(next) => {
                      tapHaptic();
                      setForm((prev) => (prev ? { ...prev, kind: next } : prev));
                    }}
                  />
                )}

                <View style={styles.section}>
                  <DashboardSectionLabel style={sectionLabelStyle}>
                    Nom du compte
                  </DashboardSectionLabel>
                  <View style={styles.identityRow}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Changer l'icône du compte"
                      onPress={() => {
                        tapHaptic();
                        setShowIconPicker((open) => !open);
                      }}
                      style={({ pressed }) => [styles.iconAffordance, pressed && styles.pressed]}
                    >
                      {previewLogoAsset || previewLogo ? (
                        <LogoIconFrame
                          asset={previewLogoAsset}
                          uri={previewLogo}
                          size={28}
                        />
                      ) : hasIdentityContent ? (
                        <UserPickedIconWell icon={previewIcon} size={28} iconSize={16} />
                      ) : (
                        <View style={styles.iconGhostSlot} accessibilityElementsHidden>
                          <AppIcon
                            family="ionicons"
                            name={identityGhostIcon(kind)}
                            size={20}
                            color={colors.textMuted}
                          />
                        </View>
                      )}
                    </Pressable>
                    <TextInput
                      value={form.name}
                      onChangeText={(name) => setForm((prev) => (prev ? { ...prev, name } : prev))}
                      placeholder={namePlaceholder(kind)}
                      placeholderTextColor={colors.textMuted}
                      style={[
                        styles.nameInput,
                        {
                          color: colors.text,
                          borderBottomColor: colors.border,
                          borderBottomWidth: StyleSheet.hairlineWidth,
                        },
                      ]}
                      returnKeyType="next"
                      accessibilityLabel="Nom du compte"
                    />
                  </View>
                  <Text style={[styles.fieldHint, themed.textMuted]}>
                    {manualIcon
                      ? 'Icône manuelle · toucher pour changer'
                      : previewLogo
                        ? 'Logo auto · toucher pour choisir une icône'
                        : 'Icône auto · toucher pour choisir'}
                  </Text>
                </View>

                {showIconPicker ? (
                  <View style={styles.section}>
                    <DashboardSectionLabel style={sectionLabelStyle}>
                      Logo / icône
                    </DashboardSectionLabel>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.iconOptionRow}
                      keyboardShouldPersistTaps="handled"
                    >
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Utiliser le logo automatique"
                        onPress={() => {
                          tapHaptic();
                          setManualIcon(null);
                          setShowIconPicker(false);
                        }}
                        style={[
                          styles.iconOption,
                          {
                            borderColor: manualIcon == null ? colors.primary : colors.border,
                            backgroundColor: colors.surfaceElevated,
                          },
                        ]}
                      >
                        <AppIcon
                          family="ionicons"
                          name="sparkles-outline"
                          size={18}
                          color={manualIcon == null ? colors.primary : colors.textMuted}
                        />
                      </Pressable>
                      {ACCOUNT_ICON_PICKER_OPTIONS.map((option) => {
                        const selected = manualIcon === option.icon;
                        return (
                          <Pressable
                            key={option.id}
                            accessibilityRole="button"
                            accessibilityLabel={option.label}
                            onPress={() => {
                              tapHaptic();
                              setManualIcon(option.icon);
                              setShowIconPicker(false);
                            }}
                            style={[
                              styles.iconOption,
                              {
                                borderColor: selected ? colors.primary : colors.border,
                                backgroundColor: colors.surfaceElevated,
                              },
                            ]}
                          >
                            <MdiIcon
                              name={option.icon}
                              size={18}
                              color={selected ? colors.primary : colors.textSecondary}
                            />
                          </Pressable>
                        );
                      })}
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Voir toutes les icônes"
                        onPress={() => {
                          tapHaptic();
                          setFullIconPickerVisible(true);
                        }}
                        style={[
                          styles.iconOption,
                          {
                            borderColor: colors.border,
                            backgroundColor: colors.surfaceElevated,
                          },
                        ]}
                      >
                        <AppIcon
                          family="ionicons"
                          name="grid-outline"
                          size={18}
                          color={colors.textMuted}
                        />
                      </Pressable>
                    </ScrollView>
                  </View>
                ) : null}

                {kind !== 'cash' ? (
                  <AccountInput
                    label="Institution"
                    value={form.institution}
                    onChangeText={(institution) =>
                      setForm((prev) => (prev ? { ...prev, institution } : prev))
                    }
                    placeholder="Desjardins, Tangerine, BMO…"
                  />
                ) : null}
                <AccountInput
                  label={kind === 'credit' ? 'Solde dû actuel' : 'Solde actuel'}
                  value={form.balance}
                  onChangeText={(balance) => setForm((prev) => (prev ? { ...prev, balance } : prev))}
                  placeholder={kind === 'credit' ? '580.42' : kind === 'cash' ? '120.00' : '3240.50'}
                  keyboardType="decimal-pad"
                  suffix="$"
                />

                {kind === 'credit' ? (
                  <>
                    <AccountInput
                      label="Limite de crédit"
                      value={form.creditLimit}
                      onChangeText={(creditLimit) =>
                        setForm((prev) => (prev ? { ...prev, creditLimit } : prev))
                      }
                      placeholder="5000"
                      keyboardType="decimal-pad"
                    />
                    <AccountInput
                      label="Jour d’échéance"
                      value={form.dueDay}
                      onChangeText={(dueDay) =>
                        setForm((prev) => (prev ? { ...prev, dueDay } : prev))
                      }
                      placeholder="15"
                      keyboardType="number-pad"
                      maxLength={2}
                    />
                    <AccountInput
                      label="Taux d’intérêt (%)"
                      value={form.interestRate}
                      onChangeText={(interestRate) =>
                        setForm((prev) => (prev ? { ...prev, interestRate } : prev))
                      }
                      placeholder="19.99"
                      keyboardType="decimal-pad"
                    />
                  </>
                ) : null}

                {kind === 'savings' ? (
                  <AccountInput
                    label="Taux d’intérêt (%)"
                    value={form.interestRate}
                    onChangeText={(interestRate) =>
                      setForm((prev) => (prev ? { ...prev, interestRate } : prev))
                    }
                    placeholder="3.25"
                    keyboardType="decimal-pad"
                  />
                ) : null}

                {kind === 'cash' ? (
                  <Text style={[styles.fieldHint, themed.textMuted]}>
                    Solde manuel — pas de synchronisation bancaire.
                  </Text>
                ) : null}

                {feedback ? (
                  <ThemedFormMessage
                    variant={feedback.variant}
                    title={feedback.title}
                    message={feedback.message}
                  />
                ) : null}

                <PrimarySaveButton
                  label="Enregistrer"
                  onPress={() => void onSave()}
                  loading={saving}
                />
              </DraggableSheetScrollView>
            </DraggableSheetSurface>
          </FormSheetModalBody>
        </View>

        <IconPickerSheet
          visible={fullIconPickerVisible}
          selectedIcon={manualIcon}
          title="Choisir une icône"
          onClose={() => setFullIconPickerVisible(false)}
          onSelect={(icon: MdiIconName) => {
            setManualIcon(icon);
            setShowIconPicker(false);
            setFullIconPickerVisible(false);
          }}
        />
      </GestureHandlerRootView>
    </Modal>
  );
}

function AccountInput(
  props: React.ComponentProps<typeof TextInput> & { label: string; suffix?: string },
) {
  const { label, suffix, keyboardType, ...inputProps } = props;
  const { colors, ghost } = useAppTheme();
  const control = {
    backgroundColor: ghost.obsidianSoft,
    borderColor: colors.borderStrong,
    borderWidth: StyleSheet.hairlineWidth,
  };
  const InputComponent = keyboardType === 'decimal-pad' ? NumericAmountInput : TextInput;

  return (
    <View style={styles.inputGroup}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      {suffix ? (
        <View style={[styles.inputShell, control]}>
          <InputComponent
            {...inputProps}
            keyboardType={keyboardType}
            style={[styles.inputWithSuffix, { color: colors.text }]}
            placeholderTextColor={colors.textMuted}
          />
          <Text style={[styles.inputSuffix, { color: colors.textSecondary }]}>{suffix}</Text>
        </View>
      ) : (
        <InputComponent
          {...inputProps}
          keyboardType={keyboardType}
          style={[styles.input, control, { color: colors.text }]}
          placeholderTextColor={colors.textMuted}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalKeyboard: {
    width: '100%',
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingTop: FORM_SHEET_CONTENT_PADDING_TOP,
  },
  modalHeaderPad: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  modalContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  section: {
    gap: spacing.sm,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 48,
  },
  iconAffordance: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconGhostSlot: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.42,
  },
  nameInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: spacing.sm,
    paddingHorizontal: 0,
    fontSize: typography.body,
    borderBottomWidth: StyleSheet.hairlineWidth,
    ...jakartaSemiboldText,
  },
  fieldHint: {
    ...typographyKit.metaMedium,
    lineHeight: 16,
    opacity: 0.85,
  },
  iconOptionRow: {
    gap: spacing.sm,
    paddingVertical: 2,
  },
  iconOption: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.78,
  },
  inputGroup: { gap: spacing.sm },
  label: {
    ...jakartaBoldText,
    fontSize: 12,
    letterSpacing: -0.1,
  },
  input: {
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 15,
  },
  inputShell: {
    borderRadius: radius.md,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inputWithSuffix: {
    flex: 1,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 15,
  },
  inputSuffix: {
    ...typographyKit.metaSemibold,
    fontSize: 14,
  },
});
