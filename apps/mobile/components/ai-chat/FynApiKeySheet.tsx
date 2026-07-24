import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '@/components/icons/AppIcon';
import {
  jakartaBoldText,
  jakartaMediumText,
  jakartaRegularText,
  radius,
  spacing,
  typography,
} from '@/constants/theme';
import { getUserApiKeyStorageHint } from '@/lib/ai/userApiKeys';
import { successHaptic, tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

export type FynApiKeyProvider = 'gemini' | 'anthropic';

type Props = {
  visible: boolean;
  provider: FynApiKeyProvider;
  hasKey: boolean;
  keySource: 'user' | 'env' | null;
  onClose: () => void;
  onSave: (key: string) => Promise<void>;
  onClear: () => Promise<void>;
};

const COPY: Record<
  FynApiKeyProvider,
  { title: string; placeholder: string; hint: string }
> = {
  gemini: {
    title: 'Clé API Gemini',
    placeholder: 'AIza…',
    hint: 'Colle ta clé Google AI Studio. Fyn l’utilise en priorité pour le chat (sans serveur).',
  },
  anthropic: {
    title: 'Clé API Claude',
    placeholder: 'sk-ant-…',
    hint: 'Colle ta clé Anthropic. Utilisée si Gemini est absente (repli chat).',
  },
};

export function FynApiKeySheet({
  visible,
  provider,
  hasKey,
  keySource,
  onClose,
  onSave,
  onClear,
}: Props) {
  const { colors, isLight } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const copy = COPY[provider];
  const storageHint = useMemo(() => getUserApiKeyStorageHint(), []);

  useEffect(() => {
    if (!visible) {
      setDraft('');
      setRevealed(false);
      setSaving(false);
    }
  }, [visible]);

  const handleClose = () => {
    tapHaptic();
    onClose();
  };

  const handleSave = async () => {
    const trimmed = draft.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      await onSave(trimmed);
      successHaptic();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onClear();
      successHaptic();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const sourceLabel =
    keySource === 'user'
      ? 'Clé personnelle enregistrée'
      : keySource === 'env'
        ? 'Clé fournie via .env (dev)'
        : 'Aucune clé';

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.backdrop, { backgroundColor: isLight ? 'rgba(25,22,18,0.28)' : 'rgba(0,0,0,0.58)' }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} accessibilityLabel="Fermer" />
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.containerBackground,
                borderColor: colors.containerBorder,
                paddingBottom: Math.max(insets.bottom, spacing.lg),
              },
            ]}
          >
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.text }, jakartaBoldText]}>{copy.title}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fermer"
                onPress={handleClose}
                hitSlop={12}
                style={({ pressed }) => [pressed && styles.pressed]}
              >
                <AppIcon family="ionicons" name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>

            <Text style={[styles.hint, { color: colors.textMuted }, jakartaRegularText]}>{copy.hint}</Text>
            <Text style={[styles.status, { color: colors.textSecondary }, jakartaMediumText]}>
              {sourceLabel}
            </Text>

            <View
              style={[
                styles.inputRow,
                { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
              ]}
            >
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder={hasKey ? 'Nouvelle clé (remplace l’actuelle)' : copy.placeholder}
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                textContentType="password"
                secureTextEntry={!revealed}
                style={[styles.input, { color: colors.text }, jakartaRegularText]}
                accessibilityLabel={copy.title}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={revealed ? 'Masquer la clé' : 'Afficher la clé'}
                onPress={() => {
                  tapHaptic();
                  setRevealed((prev) => !prev);
                }}
                hitSlop={8}
                style={({ pressed }) => [styles.revealButton, pressed && styles.pressed]}
              >
                <AppIcon
                  family="ionicons"
                  name={revealed ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.textMuted}
                />
              </Pressable>
            </View>

            <Text style={[styles.storageHint, { color: colors.textMuted }, jakartaRegularText]}>
              {storageHint}
            </Text>

            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Enregistrer la clé"
                disabled={!draft.trim() || saving}
                onPress={() => void handleSave()}
                style={({ pressed }) => [
                  styles.primaryButton,
                  { backgroundColor: colors.primary },
                  (!draft.trim() || saving) && styles.disabled,
                  pressed && draft.trim() && !saving && styles.pressed,
                ]}
              >
                <Text style={[styles.primaryLabel, { color: colors.background }, jakartaMediumText]}>
                  {saving ? 'Enregistrement…' : 'Enregistrer'}
                </Text>
              </Pressable>

              {hasKey && keySource === 'user' ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Supprimer la clé"
                  disabled={saving}
                  onPress={() => void handleClear()}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    pressed && !saving && styles.pressed,
                    saving && styles.disabled,
                  ]}
                >
                  <Text style={[styles.secondaryLabel, { color: colors.danger }, jakartaMediumText]}>
                    Supprimer la clé
                  </Text>
                </Pressable>
              ) : null}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Annuler"
                onPress={handleClose}
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
              >
                <Text style={[styles.secondaryLabel, { color: colors.textMuted }, jakartaMediumText]}>
                  Annuler
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  card: {
    borderTopLeftRadius: radius.card + 6,
    borderTopRightRadius: radius.card + 6,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: typography.body,
  },
  hint: {
    fontSize: typography.micro,
    lineHeight: typography.micro + 4,
  },
  status: {
    fontSize: typography.micro,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 48,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: typography.caption,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
  },
  revealButton: {
    padding: spacing.xs,
  },
  storageHint: {
    fontSize: typography.micro,
    lineHeight: typography.micro + 4,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
  },
  primaryLabel: {
    fontSize: typography.caption,
  },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: spacing.lg,
  },
  secondaryLabel: {
    fontSize: typography.caption,
  },
  pressed: {
    opacity: 0.78,
  },
  disabled: {
    opacity: 0.5,
  },
});
