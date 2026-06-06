import { useCallback } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  interMediumText,
  interRegularText,
  PAGE_PADDING_HORIZONTAL,
  radius,
  spacing,
  typography,
} from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';
import type { QuickSuggestion } from './types';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onSuggestionPress: (message: string) => void;
  suggestions: readonly QuickSuggestion[];
  disabled?: boolean;
  bottomInset: number;
};

export function InputBar({
  value,
  onChangeText,
  onSend,
  onSuggestionPress,
  suggestions,
  disabled = false,
  bottomInset,
}: Props) {
  const router = useRouter();
  const { colors, isLight } = useAppTheme();
  const canSend = value.trim().length > 0 && !disabled;

  const handleSendPress = useCallback(() => {
    if (!canSend) return;
    tapHaptic();
    onSend();
  }, [canSend, onSend]);

  const handleMicPress = useCallback(() => {
    tapHaptic();
    Alert.alert('Chat vocal', 'La saisie vocale arrive bientôt.', [{ text: 'OK' }]);
  }, []);

  const handleScanPress = useCallback(() => {
    tapHaptic();
    router.push('/scan');
  }, [router]);

  return (
    <View
      style={[
        styles.wrapper,
        {
          paddingBottom: Math.max(bottomInset, spacing.lg),
          borderTopColor: colors.border,
          backgroundColor: 'transparent',
        },
      ]}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScroll}
        contentContainerStyle={styles.chipsContent}
        keyboardShouldPersistTaps="handled"
      >
        {suggestions.map((suggestion) => (
          <Pressable
            key={suggestion.label}
            accessibilityRole="button"
            accessibilityLabel={suggestion.message}
            disabled={disabled}
            onPress={() => {
              tapHaptic();
              onSuggestionPress(suggestion.message);
            }}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: isLight ? colors.surface : colors.surfaceElevated,
                borderColor: colors.border,
              },
              pressed && styles.pressed,
              disabled && styles.disabled,
            ]}
          >
            <Text style={[styles.chipText, { color: colors.textMuted }, interMediumText]} numberOfLines={1}>
              {suggestion.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <View
        style={[
          styles.bar,
          { borderColor: colors.border, backgroundColor: isLight ? colors.surface : colors.surfaceElevated },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Scanner un reçu"
          onPress={handleScanPress}
          style={({ pressed }) => [
            styles.iconButton,
            { backgroundColor: isLight ? colors.input : colors.surface },
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="scan-outline" size={20} color={colors.textMuted} />
        </Pressable>

        <TextInput
          style={[
            styles.input,
            {
              color: colors.text,
              backgroundColor: isLight ? colors.input : colors.surface,
              borderColor: colors.border,
            },
            interRegularText,
          ]}
          placeholder="Posez votre question…"
          placeholderTextColor={colors.textMuted}
          value={value}
          onChangeText={onChangeText}
          multiline
          maxLength={500}
          editable={!disabled}
          returnKeyType="send"
          blurOnSubmit={false}
          onSubmitEditing={handleSendPress}
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Chat vocal"
          onPress={handleMicPress}
          style={({ pressed }) => [
            styles.iconButton,
            { backgroundColor: isLight ? colors.input : colors.surface },
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="mic-outline" size={20} color={colors.primary} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Envoyer"
          onPress={handleSendPress}
          disabled={!canSend}
          style={({ pressed }) => [
            styles.iconButton,
            {
              backgroundColor: canSend ? colors.primary : isLight ? colors.input : colors.surface,
            },
            pressed && canSend && styles.pressed,
            !canSend && styles.sendDisabled,
          ]}
        >
          <Ionicons
            name="arrow-up"
            size={20}
            color={canSend ? (isLight ? '#FFFFFF' : '#111111') : colors.textDisabled}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
    paddingTop: spacing.sm,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexShrink: 0,
  },
  chipsScroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  chipsContent: {
    gap: spacing.sm,
  },
  chip: {
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipText: {
    fontSize: typography.meta,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.xs,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 40,
    maxHeight: 120,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.body,
  },
  sendDisabled: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.78,
  },
  disabled: {
    opacity: 0.5,
  },
});
