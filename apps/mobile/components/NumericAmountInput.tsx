import { forwardRef } from 'react';
import { TextInput, type TextInputProps } from 'react-native';
import { formatNumberInput, sanitizeNumericInput } from '@/lib/formatNumber';

type Props = TextInputProps;

/**
 * TextInput that formats amounts with fr-CA thousands grouping as the user types.
 * Parent state should store the sanitized raw string (no spaces); parsing uses {@link sanitizeNumericInput}.
 * Forwards its ref to the underlying TextInput so callers can programmatically focus the field.
 */
export const NumericAmountInput = forwardRef<TextInput, Props>(function NumericAmountInput(
  { value, onChangeText, keyboardType = 'decimal-pad', ...rest },
  ref,
) {
  const raw = value ?? '';
  const displayValue = raw ? formatNumberInput(raw) : raw;

  return (
    <TextInput
      ref={ref}
      {...rest}
      keyboardType={keyboardType}
      value={displayValue}
      onChangeText={(text) => onChangeText?.(sanitizeNumericInput(text))}
    />
  );
});
