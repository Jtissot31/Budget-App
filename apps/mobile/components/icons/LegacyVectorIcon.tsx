import type { ComponentProps } from 'react';
import type { StyleProp, TextStyle } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { LegacyIconFamily } from '@/lib/iconMigration/legacyIconBackup';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];
type MciName = ComponentProps<typeof MaterialCommunityIcons>['name'];
type MaterialName = ComponentProps<typeof MaterialIcons>['name'];

export type LegacyVectorIconProps = {
  family: LegacyIconFamily;
  name: string;
  size: number;
  color: string;
  style?: StyleProp<TextStyle>;
};

/** Original vector icon renderer — used when no Lucide equivalent is in the design system selection. */
export function LegacyVectorIcon({ family, name, size, color, style }: LegacyVectorIconProps) {
  switch (family) {
    case 'ionicons':
      return <Ionicons name={name as IoniconsName} size={size} color={color} style={style} />;
    case 'material-community':
      return <MaterialCommunityIcons name={name as MciName} size={size} color={color} style={style} />;
    case 'material':
      return <MaterialIcons name={name as MaterialName} size={size} color={color} style={style} />;
    default:
      return null;
  }
}
