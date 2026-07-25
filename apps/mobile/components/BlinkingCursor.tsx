import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

const CURSOR_COLOR = '#4ADE80';
const BLINK_MS = 500;

/** Lightweight green caret shown while an AI reply is streaming. */
export function BlinkingCursor() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const id = setInterval(() => {
      setVisible((prev) => !prev);
    }, BLINK_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <Text
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={[styles.cursor, { opacity: visible ? 1 : 0 }]}
    >
      │
    </Text>
  );
}

const styles = StyleSheet.create({
  cursor: {
    color: CURSOR_COLOR,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '300',
  },
});
