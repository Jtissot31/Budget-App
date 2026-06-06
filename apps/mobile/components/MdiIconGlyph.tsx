import Svg, { Path } from 'react-native-svg';
import { getMdiIconDef, resolveMdiOrLegacyIcon, type MdiIconName } from '@/lib/mdiIconCatalog';

type Props = {
  name: string;
  size: number;
  color: string;
};

export function MdiIconGlyph({ name, size, color }: Props) {
  const resolved = resolveMdiOrLegacyIcon(name) as MdiIconName;
  const def = getMdiIconDef(resolved);
  if (!def) return null;

  return (
    <Svg width={size} height={size} viewBox={def.viewBox} fill="none">
      {def.paths.map((d, index) => (
        <Path key={`${def.name}-${index}`} fill={color} d={d} />
      ))}
    </Svg>
  );
}
