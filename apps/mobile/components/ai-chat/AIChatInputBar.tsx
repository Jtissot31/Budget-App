import { useCallback, useState } from 'react';
import { AppIcon } from '@/components/icons/AppIcon';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { jakartaRegularText, PAGE_PADDING_HORIZONTAL, spacing } from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import { ThemedConfirmModal } from '@/components/ThemedConfirmModal';
import { useAIChatColors } from './theme';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  disabled?: boolean;
  bottomInset: number;
};

export function AIChatInputBar({ value, onChangeText, onSend, disabled = false, bottomInset }: Props) {
  const router = useRouter();
  const palette = useAIChatColors();
  const canSend = value.trim().length > 0 && !disabled;
  const [micInfoVisible, setMicInfoVisible] = useState(false);

  const handleSend = useCallback(() => {
    if (!canSend) return;
    tapHaptic();
    onSend();
  }, [canSend, onSend]);

  const handleMicPress = useCallback(() => {
    tapHaptic();
    setMicInfoVisible(true);
  }, []);

  return (
    <>
      <View
        style={[
          styles.inputWrapper,
          { paddingBottom: Math.max(bottomInset, Platform.OS === 'ios' ? 20 : 16) },
        ]}
      >
        <View
          style={[
            styles.inputContainer,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ajouter une pièce jointe"
            onPress={() => tapHaptic()}
            style={styles.inputIconButton}
          >
            <AppIcon family="material-community" name="plus" size={24} color={palette.textMuted} />
          </Pressable>

          <TextInput
            style={[styles.textInput, { color: palette.text }, jakartaRegularText]}
            placeholder="Posez une question..."
            placeholderTextColor={palette.textMuted}
            value={value}
            onChangeText={onChangeText}
            multiline
            maxLength={500}
            editable={!disabled}
            returnKeyType="send"
            blurOnSubmit={false}
            onSubmitEditing={handleSend}
          />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Scanner un reçu"
            onPress={() => {
              tapHaptic();
              router.push('/scan');
            }}
            style={styles.inputIconButton}
          >
            <AppIcon family="material-community" name="camera-outline" size={24} color={palette.textMuted} />
          </Pressable>

          {canSend ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Envoyer"
              disabled={disabled}
              onPress={handleSend}
              style={({ pressed }) => [
                styles.sendButton,
                { backgroundColor: palette.primary },
                pressed && styles.pressed,
                disabled && styles.sendDisabled,
              ]}
            >
              <AppIcon family="material-community" name="send" size={20} color={palette.userBubbleText} />
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dictée vocale"
              onPress={handleMicPress}
              style={({ pressed }) => [styles.micButton, pressed && styles.pressed]}
            >
              <AppIcon family="material-community" name="microphone" size={24} color={palette.sendMuted} />
            </Pressable>
          )}
        </View>
      </View>

      <ThemedConfirmModal
        visible={micInfoVisible}
        title="Saisie vocale"
        message="La saisie vocale arrive bientôt."
        variant="info"
        confirmLabel="OK"
        onConfirm={() => setMicInfoVisible(false)}
        onCancel={() => setMicInfoVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  inputWrapper: {
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
    paddingTop: spacing.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderWidth: 1,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: 2,
    maxHeight: 96,
    minHeight: 56,
  },
  inputIconButton: {
    padding: spacing.xs,
  },
  micButton: {
    padding: spacing.xs,
    marginLeft: 4,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginLeft: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.78,
  },
});
