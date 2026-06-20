import { Image } from 'expo-image';
import Svg, { Circle, Path } from 'react-native-svg';
import { useAppTheme } from '@/lib/themeContext';
import type { WealthMaterial } from '@/types';

const SILVER_METAL_ICON = require('@/assets/icons/silver-metal.png');

function materialIconTone(material: WealthMaterial, isLight: boolean) {
  if (material === 'gold') return { fill: isLight ? '#FDE68A' : '#FACC15', stroke: '#A16207' };
  if (material === 'silver') return { fill: isLight ? '#E5E7EB' : '#CBD5E1', stroke: '#64748B' };
  if (material === 'platinum') return { fill: isLight ? '#D8F3F0' : '#9FE7DF', stroke: '#0F766E' };
  return { fill: isLight ? '#EDE9FE' : '#C4B5FD', stroke: '#7C3AED' };
}

type WealthMaterialIconProps = {
  material: WealthMaterial;
  size: number;
  isLight?: boolean;
};

export function WealthMaterialIcon({ material, size, isLight: isLightOverride }: WealthMaterialIconProps) {
  const { isLight: themeIsLight } = useAppTheme();
  const isLight = isLightOverride ?? themeIsLight;

  if (material === 'silver') {
    return (
      <Image
        source={SILVER_METAL_ICON}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="contain"
        accessibilityLabel="Argent"
      />
    );
  }

  const tone = materialIconTone(material, isLight);

  if (material === 'diamond') {
    return (
      <Svg width={size} height={size} viewBox="0 0 40 40">
        <Path d="M9 13 L15 7 H25 L31 13 L20 33 Z" fill={tone.fill} stroke={tone.stroke} strokeWidth={2} strokeLinejoin="round" />
        <Path d="M9 13 H31 M15 7 L20 13 L25 7 M15 13 L20 33 L25 13" fill="none" stroke={tone.stroke} strokeWidth={1.4} strokeLinecap="round" />
      </Svg>
    );
  }

  if (material === 'platinum') {
    return (
      <Svg width={size} height={size} viewBox="0 0 40 40">
        <Path d="M10 28 L14 10 H24 C29 10 32 13 32 18 C32 23 28 26 22 26 H17 L16 28 Z" fill={tone.fill} stroke={tone.stroke} strokeWidth={2} strokeLinejoin="round" />
        <Path d="M18 16 H23 C25 16 26 17 26 19 C26 21 24 22 21 22 H17" fill="none" stroke={tone.stroke} strokeWidth={2} strokeLinecap="round" />
      </Svg>
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Circle cx={20} cy={20} r={14} fill={tone.fill} stroke={tone.stroke} strokeWidth={2} />
      <Path d="M25 15 C23.8 12.8 21.6 11.7 18.8 12 C15 12.5 12.6 15.5 12.6 20 C12.6 24.4 15.1 27.4 19.2 28 C22.1 28.4 24.4 27.2 25.8 24.8" fill="none" stroke={tone.stroke} strokeWidth={2.4} strokeLinecap="round" />
      <Path d="M19 17 H28 M19 23 H28" stroke={tone.stroke} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
