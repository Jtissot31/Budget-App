import { Text, TextInput } from 'react-native';
import { fontFamilies } from '@/constants/plusJakartaFonts';
import { APP_MAX_FONT_SIZE_MULTIPLIER } from '@/lib/displayScale';

const defaultTextStyle = {
  fontFamily: fontFamilies.regular,
  fontWeight: 'normal' as const,
};

const systemTextStyle = {
  fontWeight: 'normal' as const,
};

type TextDefaults = {
  style?: unknown;
  maxFontSizeMultiplier?: number;
  allowFontScaling?: boolean;
};

/** Bump when default props change so Fast Refresh re-applies the scale cap. */
const DEFAULTS_VERSION = `scale-cap-${APP_MAX_FONT_SIZE_MULTIPLIER}`;

let typographyDefaultsApplied: string | null = null;

function applyTextDefaults(mode: 'jakarta' | 'system') {
  const key = `${mode}:${DEFAULTS_VERSION}`;
  if (typographyDefaultsApplied === key) return;

  const style = mode === 'jakarta' ? defaultTextStyle : systemTextStyle;
  const text = Text as typeof Text & { defaultProps?: TextDefaults };
  text.defaultProps = text.defaultProps ?? {};
  text.defaultProps.style = style;
  /** Cap OS accessibility scaling so dense cards/charts stay inside their boxes. */
  text.defaultProps.maxFontSizeMultiplier = APP_MAX_FONT_SIZE_MULTIPLIER;
  text.defaultProps.allowFontScaling = true;

  const textInput = TextInput as typeof TextInput & { defaultProps?: TextDefaults };
  textInput.defaultProps = textInput.defaultProps ?? {};
  textInput.defaultProps.style = style;
  textInput.defaultProps.maxFontSizeMultiplier = APP_MAX_FONT_SIZE_MULTIPLIER;
  textInput.defaultProps.allowFontScaling = true;

  typographyDefaultsApplied = key;
}

export function configureTypographyDefaults() {
  applyTextDefaults('jakarta');
}

/** Used when Plus Jakarta Sans fails to load — omit fontFamily so RN uses the system face. */
export function configureSystemTypographyDefaults() {
  applyTextDefaults('system');
}
