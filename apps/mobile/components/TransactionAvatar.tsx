import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { getCategoryIconName, isIconName, type IconName } from '@/constants/categoryOptions';
import { getMerchantLogoUrls } from '@/lib/merchantLogo';
import {
  normalizeUserIconColor,
  resolveUserPickedIconGlyphColor,
  userPickedIconGlyphSize,
  userPickedIconLogoSize,
  userPickedIconWellStyle,
} from '@/lib/userPickedIcon';
import { useAppTheme } from '@/lib/themeContext';
import type { Transaction } from '@/types';

type Props = {
  transaction: Transaction;
  size?: number;
  iconSize?: number;
  style?: ViewStyle;
};

export function TransactionAvatar({ transaction, size = 38, iconSize, style }: Props) {
  const { colors, isLight } = useAppTheme();
  const urls = useMemo(() => getMerchantLogoUrls(transaction.label), [transaction.label]);
  const [sourceIndex, setSourceIndex] = useState(0);
  const [giveUp, setGiveUp] = useState(false);

  useEffect(() => {
    setSourceIndex(0);
    setGiveUp(false);
  }, [urls]);

  const uri = urls[sourceIndex];
  const showRemote = Boolean(uri) && !giveUp;
  const fallbackIcon = getFallbackIcon(transaction);
  const computedIconSize = userPickedIconGlyphSize(size, iconSize);
  const categoryTint = normalizeUserIconColor(transaction.categoryColor);
  const glyphColor = resolveUserPickedIconGlyphColor(categoryTint, isLight, colors);
  const logoSize = userPickedIconLogoSize(size);

  return (
    <View style={[userPickedIconWellStyle(size, isLight), styles.wrap, style]}>
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
        <Ionicons name={fallbackIcon} size={computedIconSize} color={glyphColor} />
      )}
    </View>
  );
}

export function hasMerchantLogoCandidate(label: string): boolean {
  return getMerchantLogoUrls(label).length > 0;
}

function getFallbackIcon(transaction: Transaction): IconName {
  if (isIconName(transaction.transactionIcon)) return transaction.transactionIcon;
  return getCategoryIconName(transaction);
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
