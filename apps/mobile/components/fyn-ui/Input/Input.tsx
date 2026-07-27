import { useState } from 'react';
import {
  StyleSheet,
  TextInput,
  type KeyboardTypeOptions,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import {
  BORDER,
  COLORS,
  RADIUS,
  SPACING,
  TYPOGRAPHY,
} from '@/constants/design-tokens';

export type InputProps = {
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  editable?: boolean;
  maxLength?: number;
  keyboardType?: KeyboardTypeOptions;
  secureTextEntry?: boolean;
  multiline?: boolean;
  style?: StyleProp<TextStyle>;
};

/**
 * Input — styled TextInput with focus border (accent green) and muted placeholder.
 */
export function Input({
  placeholder,
  value,
  onChangeText,
  editable = true,
  maxLength,
  keyboardType = 'default',
  secureTextEntry = false,
  multiline = false,
  style,
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <TextInput
      style={[styles.input, isFocused && styles.focused, style]}
      placeholder={placeholder}
      placeholderTextColor={COLORS.textMuted}
      value={value}
      onChangeText={onChangeText}
      editable={editable}
      maxLength={maxLength}
      keyboardType={keyboardType}
      secureTextEntry={secureTextEntry}
      multiline={multiline}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: COLORS.inputBackground,
    borderWidth: BORDER.width,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    color: COLORS.text,
    fontFamily: TYPOGRAPHY.body.fontFamily,
    fontSize: TYPOGRAPHY.body.fontSize,
    marginVertical: SPACING.sm,
  },
  focused: {
    borderColor: COLORS.green,
  },
});
