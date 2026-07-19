import { useEffect, useState } from 'react';
import { AppIcon } from '@/components/icons/AppIcon';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DashboardSectionLabel } from '@/components/DashboardSectionLabel';
import { PremiumSwitch } from '@/components/PremiumSwitch';
import { PrimarySaveButton } from '@/components/PrimarySaveButton';
import { ThemedFormMessage } from '@/components/ThemedFormMessage';
import { radius, spacing, typography } from '@/constants/theme';
import { formValidationError, type FormFeedback } from '@/lib/formFeedback';
import { successHaptic, tapHaptic } from '@/lib/haptics';
import { upsertContactByName } from '@/lib/db';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  visible: boolean;
  bottomInset?: number;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
};

export function ContactFormModal({ visible, bottomInset = 0, onClose, onSaved }: Props) {
  const insets = useSafeAreaInsets();
  const { colors, isLight } = useAppTheme();
  const [nameDraft, setNameDraft] = useState('');
  const [isEmployer, setIsEmployer] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<FormFeedback | null>(null);

  useEffect(() => {
    if (!visible) return;
    setNameDraft('');
    setIsEmployer(false);
    setFeedback(null);
  }, [visible]);

  const save = async () => {
    const name = nameDraft.trim();
    if (!name) {
      setFeedback(formValidationError('Nom requis', 'Entre un nom pour ce contact.'));
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      await upsertContactByName(name, { isEmployer });
      successHaptic();
      onClose();
      await onSaved();
    } catch {
      setFeedback(formValidationError('Erreur', 'Impossible de créer ce contact.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Fermer"
        style={[styles.backdrop, { backgroundColor: isLight ? 'rgba(25, 22, 18, 0.30)' : 'rgba(0, 0, 0, 0.62)' }]}
        onPress={onClose}
      />
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.containerBackground,
            borderColor: colors.containerBorder,
            paddingBottom: Math.max(insets.bottom, bottomInset, spacing.lg),
          },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Ajouter un contact</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fermer"
            hitSlop={12}
            onPress={onClose}
            style={[styles.closeButton, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
          >
            <AppIcon family="ionicons" name="close" size={19} color={colors.textMuted} />
          </Pressable>
        </View>

        <View style={styles.section}>
          <DashboardSectionLabel>Nom</DashboardSectionLabel>
          <TextInput
            style={[
              styles.input,
              {
                color: colors.text,
                backgroundColor: colors.input,
                borderColor: colors.border,
              },
            ]}
            placeholder="Ex. Marie, Employeur Inc."
            placeholderTextColor={colors.textMuted}
            value={nameDraft}
            onChangeText={setNameDraft}
            autoFocus
          />
        </View>

        <View style={[styles.employerRow, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <View style={styles.employerCopy}>
            <Text style={[styles.employerLabel, { color: colors.text }]}>Employeur</Text>
            <Text style={[styles.employerHint, { color: colors.textMuted }]}>
              Suggéré en priorité lors de la saisie d'un revenu.
            </Text>
          </View>
          <PremiumSwitch
            value={isEmployer}
            onValueChange={(enabled) => {
              tapHaptic();
              setIsEmployer(enabled);
            }}
          />
        </View>

        {feedback ? (
          <ThemedFormMessage
            variant={feedback.variant}
            title={feedback.title}
            message={feedback.message}
          />
        ) : null}

        <PrimarySaveButton
          label={saving ? 'Création...' : 'Créer le contact'}
          onPress={() => void save()}
          disabled={saving}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: radius.pill,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  title: {
    flex: 1,
    fontSize: typography.title,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    gap: spacing.sm,
  },
  input: {
    minHeight: 50,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.body,
    fontWeight: '700',
  },
  employerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  employerCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  employerLabel: {
    fontSize: typography.caption,
    fontWeight: '700',
    lineHeight: 18,
  },
  employerHint: {
    fontSize: typography.micro,
    lineHeight: 15,
  },
});
