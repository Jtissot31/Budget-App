import { useEffect, useMemo, useState } from 'react';
import { AppIcon } from '@/components/icons/AppIcon';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DashboardSectionLabel } from '@/components/DashboardSectionLabel';
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal';
import { IconFrame, LogoIconFrame } from '@/components/IconFrame';
import { MdiIconPicker } from '@/components/MdiIconPicker';
import { PrimarySaveButton } from '@/components/PrimarySaveButton';
import { ThemedFormMessage } from '@/components/ThemedFormMessage';
import {
  destructiveIconColor,
  destructiveTextActionStyle,
  ICON_WELL_SIZE,
  radius,
  spacing,
  subtleDeleteButtonStyle,
  typography,
} from '@/constants/theme';
import { formValidationError, type FormFeedback } from '@/lib/formFeedback';
import {
  getMerchantLogoUrl,
  normalizeMerchantKey,
  POPULAR_MERCHANT_LOGO_OPTIONS,
  searchMerchantNameSuggestions,
} from '@/lib/merchantLogo';
import { persistMerchantLogoUri } from '@/lib/merchantLogoStorage';
import { EXPENSE_MDI_ICON, type MdiIconName } from '@/lib/mdiIconCatalog';
import { successHaptic, tapHaptic } from '@/lib/haptics';
import { pickReceiptFromGallery } from '@/lib/receiptCapture';
import { upsertMerchantOverride } from '@/lib/db';
import { userPickedIconWellStyle } from '@/lib/userPickedIcon';
import { useAppTheme } from '@/lib/themeContext';
import type { MerchantOverride } from '@/types';

export type MerchantEditTarget = {
  originalName: string;
  displayName: string;
  override?: MerchantOverride;
};

type LogoMode = 'auto' | 'logo' | 'icon';

type Props = {
  visible: boolean;
  merchant: MerchantEditTarget | null;
  bottomInset?: number;
  showDelete?: boolean;
  resolveOriginalName?: (displayName: string) => string;
  /** Transaction labels merged into merchant name autocomplete (e.g. user's history). */
  transactionMerchantNames?: string[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
  onHidden?: () => void | Promise<void>;
};

function resolveInitialLogoMode(override?: MerchantOverride): LogoMode {
  if (override?.useAutoLogo === false) {
    if (override.logoUrl) return 'logo';
    if (override.icon) return 'icon';
  }
  return 'auto';
}

export function MerchantEditModal({
  visible,
  merchant,
  bottomInset = 0,
  showDelete = true,
  resolveOriginalName,
  transactionMerchantNames = [],
  onClose,
  onSaved,
  onHidden,
}: Props) {
  const insets = useSafeAreaInsets();
  const { colors, isLight } = useAppTheme();
  const [nameDraft, setNameDraft] = useState('');
  const [logoMode, setLogoMode] = useState<LogoMode>('auto');
  const [selectedLogoUrl, setSelectedLogoUrl] = useState<string | null>(null);
  const [customLogoUri, setCustomLogoUri] = useState<string | null>(null);
  const [selectedIcon, setSelectedIcon] = useState<MdiIconName>(EXPENSE_MDI_ICON);
  const [showLogoPicker, setShowLogoPicker] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [feedback, setFeedback] = useState<FormFeedback | null>(null);
  const [importingLogo, setImportingLogo] = useState(false);

  useEffect(() => {
    if (!merchant) return;
    const override = merchant.override;
    setNameDraft(override?.displayName?.trim() || merchant.displayName);
    setLogoMode(resolveInitialLogoMode(override));
    setSelectedLogoUrl(override?.logoUrl ?? null);
    setCustomLogoUri(null);
    setSelectedIcon((override?.icon as MdiIconName | undefined) ?? EXPENSE_MDI_ICON);
    setShowLogoPicker(false);
    setShowDeleteConfirm(false);
    setFeedback(null);
    setImportingLogo(false);
  }, [merchant]);

  const isCreate = merchant?.originalName === '';
  const hasEnteredName = nameDraft.trim().length > 0;
  const normalizedNameKey = useMemo(() => normalizeMerchantKey(nameDraft), [nameDraft]);
  const nameSuggestions = useMemo(
    () => searchMerchantNameSuggestions(nameDraft, transactionMerchantNames, 8),
    [nameDraft, transactionMerchantNames],
  );
  const autoLogoUrl = useMemo(
    () => (normalizedNameKey ? getMerchantLogoUrl(nameDraft.trim()) : null),
    [nameDraft, normalizedNameKey],
  );

  useEffect(() => {
    if (!isCreate) return;
    setCustomLogoUri(null);
    setLogoMode('auto');
    setSelectedLogoUrl(null);
  }, [isCreate, normalizedNameKey]);

  const createPreviewLogoUrl = customLogoUri ?? autoLogoUrl;
  const previewLogoUrl = isCreate
    ? createPreviewLogoUrl
    : logoMode === 'logo'
      ? selectedLogoUrl
      : logoMode === 'auto'
        ? autoLogoUrl
        : null;

  const createLogoHint = useMemo(() => {
    if (customLogoUri) return 'Logo importé manuellement.';
    if (autoLogoUrl) return 'Logo trouvé automatiquement pour ce marchand.';
    return 'Aucun logo trouvé pour ce marchand.';
  }, [autoLogoUrl, customLogoUri]);

  const showCreateLogoSection = !isCreate || hasEnteredName;
  const showCreateNoLogoActions = isCreate && hasEnteredName && !autoLogoUrl && !customLogoUri;

  const logoHint = useMemo(() => {
    if (isCreate) return createLogoHint;
    if (logoMode === 'auto') {
      return autoLogoUrl
        ? 'Logo automatique trouvé avec le nom.'
        : 'Automatique utilisera une icône si aucun logo exact existe.';
    }
    if (logoMode === 'logo') return 'Logo populaire sélectionné.';
    return 'Icône manuelle sélectionnée.';
  }, [autoLogoUrl, createLogoHint, isCreate, logoMode]);

  const importCustomLogo = async () => {
    try {
      setImportingLogo(true);
      const result = await pickReceiptFromGallery();
      if (result.cancelled || !result.uri) return;
      setCustomLogoUri(result.uri);
      setLogoMode('logo');
      setSelectedLogoUrl(result.uri);
      tapHaptic();
    } catch {
      Alert.alert('Erreur', 'Impossible d’accéder à la galerie.');
    } finally {
      setImportingLogo(false);
    }
  };

  const save = async () => {
    if (!merchant) return;
    const displayName = nameDraft.trim();
    if (!displayName) {
      setFeedback(formValidationError('Nom requis', 'Entre un nom de marchand à afficher.'));
      return;
    }

    setFeedback(null);

    if (isCreate) {
      const originalName = resolveOriginalName?.(displayName) ?? displayName;
      let logoUrl: string | null = null;
      let useAutoLogo = true;

      if (customLogoUri) {
        logoUrl = await persistMerchantLogoUri(customLogoUri, originalName);
        useAutoLogo = false;
      } else if (autoLogoUrl) {
        useAutoLogo = true;
      }

      await upsertMerchantOverride({
        originalName,
        displayName: originalName === displayName ? null : displayName,
        logoUrl,
        icon: null,
        useAutoLogo,
        hidden: false,
        updatedAt: new Date().toISOString(),
      });
    } else {
      await upsertMerchantOverride({
        originalName: merchant.originalName,
        displayName: displayName === merchant.originalName ? null : displayName,
        logoUrl: logoMode === 'logo' ? selectedLogoUrl : null,
        icon: logoMode === 'icon' ? selectedIcon : logoMode === 'auto' ? selectedIcon : null,
        useAutoLogo: logoMode === 'auto',
        hidden: false,
        updatedAt: new Date().toISOString(),
      });
    }

    successHaptic();
    onClose();
    await onSaved();
  };

  const hideMerchant = async () => {
    if (!merchant) return;
    const override = merchant.override;
    await upsertMerchantOverride({
      originalName: merchant.originalName,
      displayName: override?.displayName ?? null,
      logoUrl: override?.logoUrl ?? null,
      icon: override?.icon ?? null,
      useAutoLogo: override?.useAutoLogo !== false,
      hidden: true,
      updatedAt: new Date().toISOString(),
    });
    successHaptic();
    setShowDeleteConfirm(false);
    onClose();
    await onHidden?.();
    await onSaved();
  };

  const selectNameSuggestion = (name: string) => {
    tapHaptic();
    setNameDraft(name);
    setFeedback(null);
  };

  if (!merchant) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={showDeleteConfirm ? () => setShowDeleteConfirm(false) : onClose}
    >
      <View style={styles.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.containerBackground,
              paddingBottom: Math.max(bottomInset || insets.bottom, spacing.md),
            },
          ]}
        >
          <View style={styles.modalHandle} />
          <View style={styles.modalTitleRow}>
            <View style={styles.modalTitleCopy}>
              <Text style={[styles.formTitle, { color: colors.text }]}>
                {isCreate ? 'Ajouter un marchand' : 'Modifier le marchand'}
              </Text>
              {!isCreate ? (
                <Text style={[styles.formHint, { color: colors.textMuted }]} numberOfLines={2}>
                  Personnalise le nom, le logo ou l&apos;icône affichés.
                </Text>
              ) : null}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fermer"
              style={({ pressed }) => [
                styles.closeBtn,
                { backgroundColor: colors.surface, borderColor: colors.border },
                pressed && styles.pressed,
              ]}
              onPress={onClose}
            >
              <AppIcon family="ionicons" name="close" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.modalContent}
          >
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Nom du marchand</Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.surface, borderColor: colors.borderStrong, color: colors.text },
                ]}
                value={nameDraft}
                onChangeText={(value) => {
                  setNameDraft(value);
                  setFeedback(null);
                }}
                placeholder="IGA, Metro, Tim Hortons..."
                placeholderTextColor={colors.textMuted}
                autoFocus={isCreate}
                autoCorrect={false}
                autoCapitalize="words"
              />
              {nameSuggestions.length > 0 ? (
                <View
                  style={[
                    styles.suggestionsDropdown,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <ScrollView
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                    style={styles.suggestionsList}
                    showsVerticalScrollIndicator={nameSuggestions.length > 6}
                  >
                    {nameSuggestions.map((name, index) => (
                      <Pressable
                        key={name}
                        accessibilityRole="button"
                        accessibilityLabel={`Sélectionner ${name}`}
                        onPress={() => selectNameSuggestion(name)}
                        style={({ pressed }) => [
                          styles.suggestionItem,
                          index < nameSuggestions.length - 1 && {
                            borderBottomWidth: StyleSheet.hairlineWidth,
                            borderBottomColor: colors.border,
                          },
                          pressed && styles.pressed,
                        ]}
                      >
                        <AppIcon family="ionicons" name="storefront-outline" size={14} color={colors.textMuted} />
                        <Text style={[styles.suggestionText, { color: colors.text }]} numberOfLines={1}>
                          {name}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              ) : null}
            </View>

            {showCreateLogoSection ? (
            <View style={[styles.logoSection, { backgroundColor: colors.containerBackground, borderColor: colors.containerBorder }]}>
              <View style={styles.logoHeader}>
                {previewLogoUrl ? (
                  <LogoIconFrame uri={previewLogoUrl} size={52} />
                ) : (
                  <View style={userPickedIconWellStyle(52, isLight)}>
                    <AppIcon family="ionicons" name="storefront-outline" size={22} color={colors.textMuted} />
                  </View>
                )}
                <View style={styles.logoCopy}>
                  <DashboardSectionLabel>Logo</DashboardSectionLabel>
                  <Text style={[styles.logoHint, { color: colors.textMuted }]}>{logoHint}</Text>
                </View>
                {!isCreate ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Ouvrir le sélecteur de logo"
                    hitSlop={8}
                    onPress={() => {
                      tapHaptic();
                      setShowLogoPicker((visible) => !visible);
                    }}
                    style={({ pressed }) => [
                      styles.logoEditButton,
                      { backgroundColor: colors.containerBackground, borderColor: colors.containerBorder },
                      pressed && styles.pressed,
                    ]}
                  >
                    <AppIcon family="ionicons" name="pencil-outline" size={14} color={colors.textMuted} />
                  </Pressable>
                ) : null}
              </View>

              {showCreateNoLogoActions ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Importer un logo"
                  disabled={importingLogo}
                  onPress={() => void importCustomLogo()}
                  style={({ pressed }) => [
                    styles.importLogoButton,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.borderStrong,
                      opacity: importingLogo ? 0.56 : 1,
                    },
                    pressed && styles.pressed,
                  ]}
                >
                  <AppIcon family="ionicons" name="image-outline" size={16} color={colors.textSecondary} />
                  <Text style={[styles.importLogoButtonText, { color: colors.textSecondary }]}>
                    {importingLogo ? 'Ouverture…' : 'Importer un logo'}
                  </Text>
                </Pressable>
              ) : null}

              {isCreate && customLogoUri ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Retirer le logo importé"
                  onPress={() => {
                    tapHaptic();
                    setCustomLogoUri(null);
                    setSelectedLogoUrl(null);
                    setLogoMode('auto');
                  }}
                  style={({ pressed }) => [pressed && styles.pressed]}
                >
                  <Text style={[styles.removeLogoText, { color: colors.textMuted }]}>Retirer le logo importé</Text>
                </Pressable>
              ) : null}

              {!isCreate && showLogoPicker ? (
                <View style={styles.logoPicker}>
                  <View style={styles.logoPickerTitleRow}>
                    <Text style={[styles.logoPickerHint, { color: colors.textMuted }]}>Logo automatique</Text>
                    <Text style={[styles.logoPickerHint, { color: colors.textMuted }]}>Services populaires</Text>
                  </View>
                  <View style={styles.logoOptionRow}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Utiliser le logo automatique"
                      onPress={() => {
                        tapHaptic();
                        setLogoMode('auto');
                        setSelectedLogoUrl(null);
                      }}
                      style={[
                        styles.logoOption,
                        logoMode === 'auto' && styles.logoOptionActive,
                        { borderColor: logoMode === 'auto' ? colors.primary : colors.border },
                      ]}
                    >
                      {autoLogoUrl ? (
                        <LogoIconFrame uri={autoLogoUrl} size={ICON_WELL_SIZE} />
                      ) : (
                        <IconFrame size={ICON_WELL_SIZE}>
                          <AppIcon family="ionicons" name="sparkles-outline" size={17} color={colors.textMuted} />
                        </IconFrame>
                      )}
                    </Pressable>
                    {POPULAR_MERCHANT_LOGO_OPTIONS.map((option) => {
                      const selected = logoMode === 'logo' && selectedLogoUrl === option.logoUrl;
                      return (
                        <Pressable
                          key={option.id}
                          accessibilityRole="button"
                          accessibilityLabel={`Choisir le logo ${option.label}`}
                          onPress={() => {
                            tapHaptic();
                            setLogoMode('logo');
                            setSelectedLogoUrl(option.logoUrl);
                          }}
                          style={[
                            styles.logoOption,
                            selected && styles.logoOptionActive,
                            { borderColor: selected ? colors.primary : colors.border },
                          ]}
                        >
                          {option.logoUrl ? (
                            <LogoIconFrame uri={option.logoUrl} size={ICON_WELL_SIZE} />
                          ) : (
                            <IconFrame size={ICON_WELL_SIZE}>
                              <AppIcon family="ionicons" name="storefront-outline" size={17} color={colors.textMuted} />
                            </IconFrame>
                          )}
                        </Pressable>
                      );
                    })}
                  </View>

                  <Text style={[styles.logoPickerHint, { color: colors.textMuted }]}>Icônes MDI</Text>
                  <MdiIconPicker
                    selectedIcon={logoMode === 'icon' ? selectedIcon : logoMode === 'auto' ? selectedIcon : null}
                    onSelect={(icon) => {
                      setLogoMode('icon');
                      setSelectedIcon(icon);
                      setSelectedLogoUrl(null);
                    }}
                  />
                </View>
              ) : null}
            </View>
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
              onPress={() => void save()}
              disabled={!hasEnteredName}
            />

            {showDelete && !isCreate ? (
              <Pressable
                style={({ pressed }) => [
                  subtleDeleteButtonStyle(isLight, { alignSelf: 'stretch' }),
                  pressed && { opacity: 0.72 },
                ]}
                onPress={() => {
                  tapHaptic();
                  setShowDeleteConfirm(true);
                }}
              >
                <AppIcon family="ionicons" name="trash-outline" size={16} color={destructiveIconColor(isLight)} />
                <Text style={destructiveTextActionStyle(isLight)}>Supprimer de la liste</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </View>

        <ConfirmDeleteModal
          embedded
          visible={showDeleteConfirm}
          title="Retirer ce marchand ?"
          message={`${merchant.displayName} sera retiré de la liste Marchands. Les transactions existantes restent conservées.`}
          confirmLabel="Retirer"
          onConfirm={() => void hideMerchant()}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(0, 0, 0, 0.68)',
  },
  sheet: {
    maxHeight: '90%',
    borderRadius: 30,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.32,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
    marginBottom: spacing.md,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  modalTitleCopy: { flex: 1, minWidth: 0, gap: 3 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: { gap: spacing.md, paddingBottom: spacing.lg },
  formTitle: { fontSize: typography.body, fontWeight: '800' },
  formHint: { fontSize: typography.meta, lineHeight: 17 },
  logoSection: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  logoHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  logoCopy: { flex: 1, minWidth: 0, gap: 4 },
  logoHint: { fontSize: typography.meta, lineHeight: 17 },
  logoEditButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  importLogoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  importLogoButtonText: {
    fontSize: typography.meta,
    fontWeight: '700',
  },
  removeLogoText: {
    fontSize: typography.micro,
    fontWeight: '600',
    textAlign: 'center',
  },
  logoPicker: { gap: spacing.sm, marginTop: spacing.xs },
  logoPickerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  logoPickerHint: { fontSize: typography.micro, fontWeight: '700', letterSpacing: 0.2 },
  logoOptionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  logoOption: {
    width: 58,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.sm,
  },
  logoOptionActive: { backgroundColor: 'rgba(0,245,160,0.12)' },
  inputGroup: { gap: spacing.xs },
  label: { fontSize: typography.meta, fontWeight: '600', letterSpacing: 0.2 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    fontSize: typography.body,
    fontWeight: '700',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  suggestionsDropdown: {
    marginTop: spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  suggestionsList: {
    maxHeight: 240,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  suggestionText: {
    flex: 1,
    minWidth: 0,
    fontSize: typography.meta,
    fontWeight: '600',
  },
  pressed: { opacity: 0.78 },
});
