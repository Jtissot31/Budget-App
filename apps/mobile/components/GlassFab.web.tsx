/**
 * Web GlassFab — CSS backdrop-filter (same language as FloatingTabBar.web pill).
 * Default neutral glass — no solid green fill disk.
 */
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type AccessibilityState,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { TRANSACTIONS_FAB_SIZE } from '@/constants/fabStyles';
import { floatingGlassButtonPressed } from '@/constants/floatingGlassButton';
import { useAppTheme } from '@/lib/themeContext';

const STYLE_ID = 'fyn-glass-fab-web-v2';

function ensureGlassFabCss() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = `
    .fyn-glass-fab {
      pointer-events: auto;
      overflow: hidden;
      border-style: solid;
      border-width: 1px;
      backdrop-filter: blur(56px) saturate(1.7);
      -webkit-backdrop-filter: blur(56px) saturate(1.7);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .fyn-glass-fab--green-dark {
      background: rgba(34, 197, 94, 0.08);
      border-color: rgba(255, 255, 255, 0.28);
      box-shadow:
        0 8px 24px rgba(0, 0, 0, 0.35),
        inset 0 0.5px 0 rgba(255, 255, 255, 0.22);
    }
    .fyn-glass-fab--green-light {
      background: rgba(34, 197, 94, 0.1);
      border-color: rgba(255, 255, 255, 0.5);
      box-shadow:
        0 8px 24px rgba(0, 0, 0, 0.18),
        inset 0 0.5px 0 rgba(255, 255, 255, 0.35);
    }
    .fyn-glass-fab--neutral-dark {
      background: rgba(12, 12, 14, 0.18);
      border-color: rgba(255, 255, 255, 0.22);
      box-shadow:
        0 8px 24px rgba(0, 0, 0, 0.35),
        inset 0 0.5px 0 rgba(255, 255, 255, 0.18);
    }
    .fyn-glass-fab--neutral-light {
      background: rgba(255, 255, 255, 0.22);
      border-color: rgba(0, 0, 0, 0.14);
      box-shadow:
        0 8px 24px rgba(0, 0, 0, 0.18),
        inset 0 0.5px 0 rgba(255, 255, 255, 0.35);
    }
  `;
  document.head.appendChild(el);
}

type Props = {
  children: ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityState?: AccessibilityState;
  style?: StyleProp<ViewStyle>;
  size?: number;
  tone?: 'accentGreen' | 'neutral';
};

export function GlassFab({
  children,
  onPress,
  accessibilityLabel,
  accessibilityState,
  style,
  size = TRANSACTIONS_FAB_SIZE,
  tone = 'neutral',
}: Props) {
  const { isLight } = useAppTheme();
  const cornerRadius = size / 2;

  useEffect(() => {
    ensureGlassFabCss();
  }, []);

  const toneClass =
    tone === 'accentGreen'
      ? isLight
        ? 'fyn-glass-fab--green-light'
        : 'fyn-glass-fab--green-dark'
      : isLight
        ? 'fyn-glass-fab--neutral-light'
        : 'fyn-glass-fab--neutral-dark';

  return (
    <Pressable
      pointerEvents="auto"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      style={({ pressed }) => [
        styles.shell,
        {
          width: size,
          height: size,
          borderRadius: cornerRadius,
        },
        style,
        pressed && floatingGlassButtonPressed,
      ]}
      // RN Web: className paints the glass disc (backdrop-filter).
      {...({ className: `fyn-glass-fab ${toneClass}` } as object)}
    >
      <View pointerEvents="none" style={styles.content}>
        {children}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  content: {
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
