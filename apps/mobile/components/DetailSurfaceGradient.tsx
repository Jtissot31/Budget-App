import { StyleProp, ViewStyle } from 'react-native';
import { AppBackgroundGradient } from '@/components/AppBackgroundGradient';

type Props = {
  /** @deprecated Theme is read from context — kept for call-site compatibility */
  isLight?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Detail / sheet backdrop — reuses the app-wide canvas gradient */
export function DetailSurfaceGradient({ style }: Props) {
  return <AppBackgroundGradient style={style} />;
}
