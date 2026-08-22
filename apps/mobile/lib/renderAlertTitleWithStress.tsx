import { Text, type StyleProp, type TextStyle } from 'react-native';
import { splitAlertTitleStressSegments } from '@/lib/alertTitleStress';

type Options = {
  /** Normal title color (theme `colors.text`). */
  color: string;
  /** Stress highlight — prefer theme `colors.alertStress` (orange, not amber warning). */
  stressColor: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
};

/**
 * Alert title with orange Nested Text on stress words
 * (insuffisant(e), dépassé(e), élevé(e), bas(se)).
 */
export function renderAlertTitleWithStress(title: string, options: Options) {
  const segments = splitAlertTitleStressSegments(title);

  return (
    <Text style={[options.style, { color: options.color }]} numberOfLines={options.numberOfLines}>
      {segments.map((segment, index) =>
        segment.stress ? (
          <Text key={`stress-${index}`} style={{ color: options.stressColor }}>
            {segment.text}
          </Text>
        ) : (
          <Text key={`plain-${index}`}>{segment.text}</Text>
        ),
      )}
    </Text>
  );
}
