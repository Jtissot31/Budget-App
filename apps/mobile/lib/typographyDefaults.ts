import { Text, TextInput } from 'react-native';
import { fontFamilies } from '@/constants/theme';

const defaultTextStyle = {
  fontFamily: fontFamilies.regular,
  fontWeight: '400' as const,
};

const systemTextStyle = {
  fontWeight: '400' as const,
};

function applyTextDefaults(style: typeof defaultTextStyle | typeof systemTextStyle) {
  const text = Text as typeof Text & { defaultProps?: { style?: unknown } };
  text.defaultProps = text.defaultProps ?? {};
  text.defaultProps.style = [style, text.defaultProps.style];

  const textInput = TextInput as typeof TextInput & { defaultProps?: { style?: unknown } };
  textInput.defaultProps = textInput.defaultProps ?? {};
  textInput.defaultProps.style = [style, textInput.defaultProps.style];
}

export function configureTypographyDefaults() {
  applyTextDefaults(defaultTextStyle);
}

/** Used when Inter fails to load — omit fontFamily so RN uses the system face. */
export function configureSystemTypographyDefaults() {
  applyTextDefaults(systemTextStyle);
}
