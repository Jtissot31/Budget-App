import { Platform } from 'react-native';

/**
 * Weight scale shifted one step heavier for readability (secondary text was too thin):
 * regular → 500, medium (secondary copy) → 600, semibold (titles) → 700.
 * Secondary text stays one step lighter than titles. Font files load in app/_layout.
 */
export const fontFamilies = {
  regular: 'PlusJakartaSans_500Medium',
  medium: 'PlusJakartaSans_600SemiBold',
  semibold: 'PlusJakartaSans_700Bold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
  /** @deprecated Use fontFamilies.regular */
  rounded: Platform.select({
    ios: 'PlusJakartaSans_400Regular',
    android: 'PlusJakartaSans_400Regular',
    default: 'PlusJakartaSans_400Regular',
  }),
  /** @deprecated Use fontFamilies.bold */
  roundedHeavy: Platform.select({
    ios: 'PlusJakartaSans_700Bold',
    android: 'PlusJakartaSans_700Bold',
    default: 'PlusJakartaSans_700Bold',
  }),
} as const;

/** Plus Jakarta Sans presets — fontWeight: 'normal' so named font files render correctly */
export const jakartaRegularText = {
  fontFamily: fontFamilies.regular,
  fontWeight: 'normal' as const,
};

export const jakartaMediumText = {
  fontFamily: fontFamilies.medium,
  fontWeight: 'normal' as const,
};

export const jakartaSemiboldText = {
  fontFamily: fontFamilies.semibold,
  fontWeight: 'normal' as const,
};

export const jakartaBoldText = {
  fontFamily: fontFamilies.bold,
  fontWeight: 'normal' as const,
};

export const jakartaExtraBoldText = {
  fontFamily: fontFamilies.extrabold,
  fontWeight: 'normal' as const,
};
