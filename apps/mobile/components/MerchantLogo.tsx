import { useEffect, useMemo, useState } from 'react';

import { StyleSheet, View } from 'react-native';

import { Image } from 'expo-image';

import { Ionicons } from '@expo/vector-icons';

import { getMerchantLogoUrls } from '@/lib/merchantLogo';

import {
  logoIconWellStyle,
  userPickedIconGlyphSize,
  userPickedIconLogoSize,
  userPickedIconWellStyle,
} from '@/lib/userPickedIcon';

import { useAppTheme } from '@/lib/themeContext';



type Props = {

  name: string;

  logoUrl?: string | null;

  size?: number;

};



export function MerchantLogo({ name, logoUrl, size = 36 }: Props) {

  const { colors, isLight } = useAppTheme();

  const urls = useMemo(() => (logoUrl ? [logoUrl] : getMerchantLogoUrls(name)), [logoUrl, name]);

  const [sourceIndex, setSourceIndex] = useState(0);

  const [giveUp, setGiveUp] = useState(false);



  useEffect(() => {

    setSourceIndex(0);

    setGiveUp(false);

  }, [urls]);



  const uri = urls[sourceIndex];

  const showRemote = Boolean(uri) && !giveUp;

  const logoSize = userPickedIconLogoSize(size);

  const glyphSize = userPickedIconGlyphSize(size, Math.max(18, size * 0.56));



  const wellStyle = showRemote && uri ? logoIconWellStyle(size, isLight) : userPickedIconWellStyle(size, isLight);

  return (
    <View style={[wellStyle, styles.wrap]}>
      {showRemote && uri ? (

        <Image

          source={{ uri }}

          style={{ width: logoSize, height: logoSize }}

          contentFit="contain"

          transition={150}

          cachePolicy="memory-disk"

          recyclingKey={uri}

          onError={() => {

            if (sourceIndex < urls.length - 1) {

              setSourceIndex((i) => i + 1);

            } else {

              setGiveUp(true);

            }

          }}

        />

      ) : (

        <Ionicons name="storefront-outline" size={glyphSize} color={colors.textMuted} />

      )}

    </View>

  );

}



const styles = StyleSheet.create({

  wrap: {

    alignItems: 'center',

    justifyContent: 'center',

    flexShrink: 0,

  },

});


