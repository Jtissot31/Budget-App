import Svg, { Path } from 'react-native-svg';
import { getMdiIconDef, type MdiIconName } from '@/lib/mdiIconCatalog';

type Props = {
  name: MdiIconName;
  size: number;
  color: string;
};

/** Renders a vector glyph from the MDI catalog (`src/icons/index.js`). */
export function MdiIcon({ name, size, color }: Props) {
  const def = getMdiIconDef(name);
  if (!def) return null;

  if (name === 'Transfer') {
    const strokePath = def.paths[0];
    return (
      <Svg width={size} height={size} viewBox={def.viewBox}>
        <Path
          d={strokePath}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  return (
    <Svg width={size} height={size} viewBox={def.viewBox}>
      {def.paths.map((d, index) => (
        <Path key={`${name}-${index}`} fill={color} d={d} />
      ))}
    </Svg>
  );
}
