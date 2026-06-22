import { Platform } from 'react-native';

export const fontFamilies = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
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
