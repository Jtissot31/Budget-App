import { Image } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

export const FYN_AVATAR_SOURCE = require('@/assets/images/fyn-avatar.png');

type Props = {
  size?: number;
  showStatus?: boolean;
  statusColor?: string;
  statusBorderColor?: string;
  style?: StyleProp<ViewStyle>;
};

export function FynAvatar({
  size = 40,
  showStatus = false,
  statusColor = '#4ADE80',
  statusBorderColor = '#0E0E10',
  style,
}: Props) {
  const radius = size / 2;
  const statusSize = Math.max(10, Math.round(size * 0.3));

  return (
    <View style={[styles.container, style]}>
      <View
        style={[
          styles.frame,
          {
            width: size,
            height: size,
            borderRadius: radius,
          },
        ]}
      >
        <Image
          source={FYN_AVATAR_SOURCE}
          style={{
            width: size,
            height: size,
            borderRadius: radius,
            backgroundColor: 'transparent',
          }}
          contentFit="cover"
          accessibilityLabel="Photo de profil de Fyn"
        />
      </View>
      {showStatus ? (
        <View
          style={[
            styles.status,
            {
              width: statusSize,
              height: statusSize,
              borderRadius: statusSize / 2,
              backgroundColor: statusColor,
              borderColor: statusBorderColor,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    flexShrink: 0,
    backgroundColor: 'transparent',
  },
  frame: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  status: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderWidth: 2,
  },
});
