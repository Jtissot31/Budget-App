import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DashboardSectionLabel } from '@/components/DashboardSectionLabel';
import { GlassContainer } from '@/components/GlassContainer';
import { IconFrame, LogoIconFrame } from '@/components/IconFrame';
import { MdiIconGlyph } from '@/components/MdiIconGlyph';
import { MdiIconPicker } from '@/components/MdiIconPicker';
import { ThemedFormMessage } from '@/components/ThemedFormMessage';
import { ICON_WELL_SIZE, radius, spacing, typography } from '@/constants/theme';
import { formValidationError, type FormFeedback } from '@/lib/formFeedback';
import { getMerchantLogoUrl, POPULAR_MERCHANT_LOGO_OPTIONS } from '@/lib/merchantLogo';
import { EXPENSE_MDI_ICON, type MdiIconName } from '@/lib/mdiIconCatalog';
import { successHaptic, tapHaptic } from '@/lib/haptics';
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
  onClose,
  onSaved,
  onHidden,
}: Props) {
  const insets = useSafeAreaInsets();
  const { colors, isLight } = useAppTheme();
  const [nameDraft, setNameDraft] = useState('');
  const [logoMode, setLogoMode] = useState<LogoMode>('auto');
  const [selectedLogoUrl, setSelectedLogoUrl] = useState<string | null>(null);
  const [selectedIcon, setSelectedIcon] = useState<MdiIconName>(EXPENSE_MDI_ICON);
  const [showLogoPicker, setShowLogoPicker] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [feedback, setFeedback] = useState<FormFeedback | null>(null);

  useEffect(() => {
    if (!merchant) return;
    const override = merchant.override;
    setNameDraft(override?.displayName?.trim() || merchant.displayName);
    setLogoMode(resolveInitialLogoMode(override));
    setSelectedLogoUrl(override?.logoUrl ?? null);
    setSelectedIcon((override?.icon as MdiIconName | undefined) ?? EXPENSE_MDI_ICON);
    setShowLogoPicker(false);
    setShowDeleteConfirm(false);
    setFeedback(null);
  }, [merchant]);

  const autoLogoUrl = useMemo(() => getMerchantLogoUrl(nameDraft.trim()), [nameDraft]);
  const previewLogoUrl = logoMode === 'logo' ? selectedLogoUrl : logoMode === 'auto' ? autoLogoUrl : null;

  const logoHint = useMemo(() => {
    if (logoMode === 'auto') {
      return autoLogoUrl
        ? 'Logo automatique trouvé avec le nom.'
        : 'Automatique utilisera une icône si aucun logo exact existe.';
    }
    if (logoMode === 'logo') return 'Logo populaire sélectionné.';
    return 'Icône manuelle sélectionnée.';
  }, [autoLogoUrl, logoMode]);

  const save = async () => {
    if (!merchant) return;
    const displayName = nameDraft.trim();
    if (!displayName) {
      setFeedback(formValidationError('Nom requis', 'Entre un nom de marchand à afficher.'));
      return;
    }

    setFeedback(null);
    await upsertMerchantOverride({
      originalName: merchant.originalName,
      displayName: displayName === merchant.originalName ? null : displayName,
      logoUrl: logoMode === 'logo' ? selectedLogoUrl : null,
      icon: logoMode === 'icon' ? selectedIcon : logoMode === 'auto' ? selectedIcon : null,
      useAutoLogo: logoMode === 'auto',
      hidden: false,
      updatedAt: new Date().toISOString(),
    });
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
              backgroundColor: colors.surfaceSolid,
              paddingBottom: Math.max(bottomInset || insets.bottom, spacing.md),
            },
          ]}
        >
          <View style={styles.modalHandle} />
          <View style={styles.modalTitleRow}>
            <View style={styles.modalTitleCopy}>
              <Text style={[styles.formTitle, { color: colors.text }]}>Modifier le marchand</Text>
              <Text style={[styles.formHint, { color: colors.textMuted }]} numberOfLines={2}>
                Personnalise le nom, le logo ou l&apos;icône affichés.
              </Text>
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
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.modalContent}
          >
            <View style={[styles.logoSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.logoHeader}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Changer le logo ou l'icône"
                  onPress={() => {
                    tapHaptic();
                    setShowLogoPicker((visible) => !visible);
                  }}
                >
                  {previewLogoUrl ? (
                    <LogoIconFrame uri={previewLogoUrl} size={52} />
                  ) : (
                    <View style={userPickedIconWellStyle(52, isLight)}>
                      <MdiIconGlyph name={selectedIcon} size={22} color={colors.text} />
                    </View>
                  )}
                </Pressable>
                <View style={styles.logoCopy}>
                  <DashboardSectionLabel>Logo</DashboardSectionLabel>
                  <Text style={[styles.logoHint, { color: colors.textMuted }]}>{logoHint}</Text>
                </View>
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
                    { backgroundColor: colors.surfaceSolid, borderColor: colors.border },
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons name="pencil-outline" size={14} color={colors.textMuted} />
                </Pressable>
              </View>

              {showLogoPicker ? (
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
                          <Ionicons name="sparkles-outline" size={17} color={colors.textMuted} />
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
                              <Ionicons name="storefront-outline" size={17} color={colors.textMuted} />
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

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Nom du marchand</Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.surface, borderColor: colors.borderStrong, color: colors.text },
                ]}
                value={nameDraft}
                onChangeText={setNameDraft}
                placeholder="IGA, Metro, Tim Hortons..."
                placeholderTextColor={colors.textMuted}
              />
            </View>

            {feedback ? (
              <ThemedFormMessage
                variant={feedback.variant}
                title={feedback.title}
                message={feedback.message}
              />
            ) : null}

            <Pressable
              style={[styles.saveBtn, { backgroundColor: colors.text }]}
              onPress={() => void save()}
            >
              <Text style={[styles.saveText, { color: colors.background }]}>Enregistrer</Text>
            </Pressable>

            {showDelete ? (
              <Pressable
                style={({ pressed }) => [
                  styles.deleteBtn,
                  { backgroundColor: colors.dangerMuted, borderColor: colors.danger },
                  pressed && styles.pressed,
                ]}
                onPress={() => {
                  tapHaptic();
                  setShowDeleteConfirm(true);
                }}
              >
                <Ionicons name="trash-outline" size={16} color={colors.danger} />
                <Text style={[styles.deleteText, { color: colors.danger }]}>Supprimer de la liste</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </View>

        {showDeleteConfirm ? (
          <View style={styles.confirmOverlay}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Annuler le retrait du marchand"
              style={StyleSheet.absoluteFill}
              onPress={() => setShowDeleteConfirm(false)}
            />
            <GlassContainer style={styles.confirmCard} padding={spacing.lg} borderRadius={radius.card} innerStyle={styles.confirmCardInner}>
              <View style={[styles.confirmIcon, { backgroundColor: colors.dangerMuted }]}>
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
              </View>
              <Text style={[styles.confirmTitle, { color: colors.text }]}>Retirer ce marchand ?</Text>
              <Text style={[styles.confirmMessage, { color: colors.textMuted }]}>
                {merchant.displayName} sera retiré de la liste Marchands. Les transactions existantes restent conservées.
              </Text>
              <View style={styles.confirmActions}>
                <Pressable
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.confirmSecondaryButton,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    pressed && styles.pressed,
                  ]}
                  onPress={() => setShowDeleteConfirm(false)}
                >
                  <Text style={[styles.confirmSecondaryText, { color: colors.textSecondary }]}>Annuler</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.confirmDestructiveButton,
                    { backgroundColor: colors.danger, borderColor: colors.danger },
                    pressed && styles.pressed,
                  ]}
                  onPress={() => void hideMerchant()}
                >
                  <Text style={[styles.confirmDestructiveText, { color: colors.background }]}>Retirer</Text>
                </Pressable>
              </View>
            </GlassContainer>
          </View>
        ) : null}
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
  saveBtn: {
    borderRadius: radius.lg,
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.xs,
  },
  saveText: { fontSize: typography.body, fontWeight: '800' },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.md,
  },
  deleteText: { fontSize: typography.caption, fontWeight: '800' },
  confirmOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  confirmCard: { width: '100%' },
  confirmCardInner: { gap: spacing.md, alignItems: 'center' },
  confirmIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmTitle: { fontSize: typography.body, fontWeight: '800', textAlign: 'center' },
  confirmMessage: { fontSize: typography.caption, textAlign: 'center', lineHeight: typography.caption + 4 },
  confirmActions: { flexDirection: 'row', gap: spacing.sm, width: '100%' },
  confirmSecondaryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.md,
  },
  confirmSecondaryText: { fontSize: typography.caption, fontWeight: '800' },
  confirmDestructiveButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.md,
  },
  confirmDestructiveText: { fontSize: typography.caption, fontWeight: '800' },
  pressed: { opacity: 0.78 },
});
