import { useCallback } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { interRegularText, PAGE_PADDING_HORIZONTAL, spacing } from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import { AIChatQuickChips } from './AIChatQuickChips';
import { useAIChatColors } from './theme';
import { AI_QUICK_CHIPS, type AIQuickChip } from './types';

export type AIChatMultimodalInputProps = {
  value: string;
  onChangeText: (text: string) => void;
  onSend: (text: string) => void;
  onChipPress: (text: string) => void;
  onAttach?: () => void;
  onCamera?: () => void;
  onMic?: () => void;
  chips?: readonly AIQuickChip[];
  disabled?: boolean;
  bottomInset?: number;
  onInputBlur?: () => void;
  /** When true, wraps chips + input in KeyboardAvoidingView (parent may already handle this). */
  wrapInKeyboardAvoidingView?: boolean;
};

function showComingSoonAlert(feature: string) {
  Alert.alert(feature, 'Bientôt disponible');
}

export function AIChatMultimodalInput({
  value,
  onChangeText,
  onSend,
  onChipPress,
  onAttach,
  onCamera,
  onMic,
  chips = AI_QUICK_CHIPS,
  disabled = false,
  bottomInset = 0,
  onInputBlur,
  wrapInKeyboardAvoidingView = false,
}: AIChatMultimodalInputProps) {
  const palette = useAIChatColors();
  const canSend = value.trim().length > 0 && !disabled;

  const handleSend = useCallback(() => {
    const text = value.trim();
    if (!text || disabled) return;
    tapHaptic();
    onSend(text);
  }, [disabled, onSend, value]);

  const handleAttach = useCallback(() => {
    tapHaptic();
    if (onAttach) {
      onAttach();
      return;
    }
    showComingSoonAlert('Pièce jointe');
  }, [onAttach]);

  const handleCamera = useCallback(() => {
    tapHaptic();
    if (onCamera) {
      onCamera();
      return;
    }
    showComingSoonAlert('Capture photo');
  }, [onCamera]);

  const handleMic = useCallback(() => {
    tapHaptic();
    if (onMic) {
      onMic();
      return;
    }
    showComingSoonAlert('Dictée vocale');
  }, [onMic]);

  const content = (
    <>
      {chips.length > 0 ? (
        <AIChatQuickChips chips={chips} onChipPress={onChipPress} disabled={disabled} />
      ) : null}

      <View
        style={[
          styles.inputWrapper,
          {
            paddingBottom:
              bottomInset > 0 ? bottomInset : Platform.OS === 'ios' ? spacing.lg : spacing.md,
          },
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
            disabled={disabled}
            onPress={handleAttach}
            style={({ pressed }) => [styles.inputIconButton, pressed && styles.pressed]}
          >
            <MaterialCommunityIcons name="plus" size={24} color={palette.textMuted} />
          </Pressable>

          <TextInput
            style={[styles.textInput, { color: palette.text }, interRegularText]}
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
            onBlur={onInputBlur}
          />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Prendre une photo"
            disabled={disabled}
            onPress={handleCamera}
            style={({ pressed }) => [styles.inputIconButton, pressed && styles.pressed]}
          >
            <MaterialCommunityIcons name="camera-outline" size={24} color={palette.textMuted} />
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
              <MaterialCommunityIcons name="send" size={20} color={palette.userBubbleText} />
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dictée vocale"
              disabled={disabled}
              onPress={handleMic}
              style={({ pressed }) => [styles.micButton, pressed && styles.pressed]}
            >
              <MaterialCommunityIcons name="microphone" size={24} color={palette.sendMuted} />
            </Pressable>
          )}
        </View>
      </View>
    </>
  );

  if (wrapInKeyboardAvoidingView) {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        style={styles.keyboardView}
      >
        {content}
      </KeyboardAvoidingView>
    );
  }

  return <View style={styles.keyboardView}>{content}</View>;
}

/** Alias for mockup / partial code naming */
export const MultimodalInputComponent = AIChatMultimodalInput;

const styles = StyleSheet.create({
  keyboardView: {
    flexShrink: 0,
    backgroundColor: 'transparent',
  },
  inputWrapper: {
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
    paddingTop: spacing.xs,
    backgroundColor: 'transparent',
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
