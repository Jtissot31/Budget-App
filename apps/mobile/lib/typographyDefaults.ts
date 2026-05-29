import { Text, TextInput } from 'react-native';
import { fontFamilies } from '@/constants/theme';

const defaultTextStyle = {
  fontFamily: fontFamilies.regular,
  fontWeight: '400' as const,
};

export function configureTypographyDefaults() {
  const text = Text as typeof Text & { defaultProps?: { style?: unknown } };
  text.defaultProps = text.defaultProps ?? {};
  text.defaultProps.style = [defaultTextStyle, text.defaultProps.style];

  const textInput = TextInput as typeof TextInput & { defaultProps?: { style?: unknown } };
  textInput.defaultProps = textInput.defaultProps ?? {};
  textInput.defaultProps.style = [defaultTextStyle, textInput.defaultProps.style];
}
