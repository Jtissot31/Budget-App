import { Platform } from 'react-native';

export const fontFamilies = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
  /** @deprecated Use fontFamilies.regular */
  rounded: Platform.select({
    ios: 'Inter_400Regular',
    android: 'Inter_400Regular',
    default: 'Inter_400Regular',
  }),
  /** @deprecated Use fontFamilies.bold */
  roundedHeavy: Platform.select({
    ios: 'Inter_700Bold',
    android: 'Inter_700Bold',
    default: 'Inter_700Bold',
  }),
} as const;

/** Inter presets — fontWeight: 'normal' so named font files render correctly */
export const interRegularText = {
  fontFamily: fontFamilies.regular,
  fontWeight: 'normal' as const,
};

export const interMediumText = {
  fontFamily: fontFamilies.medium,
  fontWeight: 'normal' as const,
};

export const interSemiboldText = {
  fontFamily: fontFamilies.semibold,
  fontWeight: 'normal' as const,
};

export const interBoldText = {
  fontFamily: fontFamilies.bold,
  fontWeight: 'normal' as const,
};

export const interExtraBoldText = {
  fontFamily: fontFamilies.extrabold,
  fontWeight: 'normal' as const,
};
