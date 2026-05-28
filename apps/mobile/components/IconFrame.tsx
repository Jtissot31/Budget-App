import type { ReactNode } from 'react';

import type { ImageContentFit } from 'expo-image';

import { Image } from 'expo-image';

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import {
  logoIconWellStyle,
  userPickedIconLogoSize,
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

  const logoSize = userPickedIconLogoSize(size);



  return (

    <View style={[logoIconWellStyle(size, isLight), style]}>

      <Image

        source={{ uri }}

        style={{ width: logoSize, height: logoSize }}

        contentFit={contentFit}

        transition={150}

        cachePolicy="memory-disk"

        recyclingKey={recyclingKey ?? uri}

        onError={onError}

      />

    </View>

  );

}



const styles = StyleSheet.create({

  center: {

    alignItems: 'center',

    justifyContent: 'center',

    flexShrink: 0,

  },

});



export { styles as iconFrameStyles };


