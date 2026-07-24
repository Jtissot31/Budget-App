import type { ReactNode } from 'react';

import type { ImageContentFit } from 'expo-image';

import { Image } from 'expo-image';

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import {
  logoIconWellStyle,
  remoteLogoImageStyle,
  userPickedIconWellStyle,
} from '@/lib/userPickedIcon';

import { useAppTheme } from '@/lib/themeContext';



type IconFrameProps = {

  size?: number;

  style?: StyleProp<ViewStyle>;

  children: ReactNode;

};



/** Rounded-square icon well matching category icon frames. */

export function IconFrame({ size = 46, style, children }: IconFrameProps) {

  const { isLight } = useAppTheme();

  return <View style={[userPickedIconWellStyle(size, isLight), style]}>{children}</View>;

}



type RemoteLogoImageProps = {
  uri: string;
  size: number;
  contentFit?: ImageContentFit;
  /** When true, logo uses the full box (no padded inset) — for frameless calendar markers. */
  fullSize?: boolean;
  /**
   * Logo fill inside the sized box (default `USER_PICKED_ICON_LOGO_INSET_RATIO`).
   * Ignored when `fullSize` is true. Use a higher value for compact picker tiles.
   */
  insetRatio?: number;
  recyclingKey?: string;
  onError?: () => void;
  onLoad?: () => void;
};

/** Remote favicon/logo — integer box, centered contain, no stretch. */
export function RemoteLogoImage({
  uri,
  size,
  contentFit = 'contain',
  fullSize = false,
  insetRatio,
  recyclingKey,
  onError,
  onLoad,
}: RemoteLogoImageProps) {
  const imageStyle = fullSize
    ? { width: size, height: size }
    : remoteLogoImageStyle(size, insetRatio);

  return (
    <Image
      source={{ uri }}
      style={imageStyle}
      contentFit={contentFit}
      contentPosition="center"
      placeholderContentFit="contain"
      transition={size <= 46 ? 0 : 150}
      cachePolicy="memory-disk"
      recyclingKey={recyclingKey ?? uri}
      onError={onError}
      onLoad={onLoad}
    />
  );
}

type LogoIconFrameProps = {
  uri: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
  contentFit?: ImageContentFit;
  recyclingKey?: string;
  onError?: () => void;
};

/** Remote logo inside the shared rounded-square frame (no tint). */
export function LogoIconFrame({
  uri,
  size = 46,
  style,
  contentFit = 'contain',
  recyclingKey,
  onError,
}: LogoIconFrameProps) {
  const { isLight } = useAppTheme();

  return (
    <View style={[logoIconWellStyle(size, isLight), styles.logoWell, style]}>
      <RemoteLogoImage
        uri={uri}
        size={size}
        contentFit={contentFit}
        recyclingKey={recyclingKey}
        onError={onError}
      />
    </View>
  );
}



const styles = StyleSheet.create({
  logoWell: {
    position: 'relative',
    flexShrink: 0,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});



export { styles as iconFrameStyles };


