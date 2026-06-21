import { Text, TextInput } from 'react-native';
import { fontFamilies } from '@/constants/theme';

const defaultTextStyle = {
  fontFamily: fontFamilies.regular,
  fontWeight: 'normal' as const,
};

const systemTextStyle = {
  fontWeight: 'normal' as const,
};

let typographyDefaultsApplied: 'jakarta' | 'system' | null = null;

function applyTextDefaults(mode: 'jakarta' | 'system') {
  if (typographyDefaultsApplied === mode) return;

  const style = mode === 'jakarta' ? defaultTextStyle : systemTextStyle;
  const text = Text as typeof Text & { defaultProps?: { style?: unknown } };
  text.defaultProps = text.defaultProps ?? {};
  text.defaultProps.style = style;

  const textInput = TextInput as typeof TextInput & { defaultProps?: { style?: unknown } };
  textInput.defaultProps = textInput.defaultProps ?? {};
  textInput.defaultProps.style = style;

  typographyDefaultsApplied = mode;
}

export function configureTypographyDefaults() {
  applyTextDefaults('jakarta');
}

/** Used when Plus Jakarta Sans fails to load — omit fontFamily so RN uses the system face. */
export function configureSystemTypographyDefaults() {
  applyTextDefaults('system');
}
