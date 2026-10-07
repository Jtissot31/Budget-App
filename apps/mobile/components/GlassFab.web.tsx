/**
 * Web GlassFab — CSS backdrop-filter (same language as FloatingTabBar.web pill).
 * Default neutral glass — no solid green fill disk.
 */
import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
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

const STYLE_ID = 'fyn-glass-fab-web-v3';

const GLASS_TONE_CLASSES = [
  'fyn-glass-fab--green-dark',
  'fyn-glass-fab--green-light',
  'fyn-glass-fab--neutral-dark',
  'fyn-glass-fab--neutral-light',
] as const;

function ensureGlassFabCss() {
  if (typeof document === 'undefined') return;
  document.getElementById('fyn-glass-fab-web-v2')?.remove();
  let el = document.getElementById(STYLE_ID);
  if (!el) {
    el = document.createElement('style');
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = `
    .fyn-glass-fab {
      pointer-events: auto;
      overflow: hidden;
      box-sizing: border-box;
      /* Lock a square disc. Width/height styles were getting dropped (see bindGlassNode). */
      flex: none;
      width: var(--fyn-glass-fab-size);
      height: var(--fyn-glass-fab-size);
      min-width: var(--fyn-glass-fab-size);
      min-height: var(--fyn-glass-fab-size);
      max-width: var(--fyn-glass-fab-size);
      max-height: var(--fyn-glass-fab-size);
      aspect-ratio: 1 / 1;
      border-radius: 9999px;
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
}

function isHtmlElement(node: unknown): node is HTMLElement {
  return (
    node != null &&
    typeof node === 'object' &&
    'classList' in node &&
    'style' in node
  );
}

/**
 * NativeWind cssInterop maps Pressable `className` onto `style`. When `style`
 * is a function (pressed state), that merge replaces the function entirely, so
 * width, height, radius, and the caller's absolute position never reach the DOM.
 * The tab-bar host is a full-width column, so the button then stretches into a
 * short strip. Paint the glass class on the DOM node instead.
 */
function bindGlassNode(node: unknown, toneClass: string, size: number) {
  if (!isHtmlElement(node)) return;
  node.classList.add('fyn-glass-fab', toneClass);
  for (const name of GLASS_TONE_CLASSES) {
    if (name !== toneClass) node.classList.remove(name);
  }
  node.style.setProperty('--fyn-glass-fab-size', `${size}px`);
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
  const nodeRef = useRef<HTMLElement | null>(null);

  const toneClass =
    tone === 'accentGreen'
      ? isLight
        ? 'fyn-glass-fab--green-light'
        : 'fyn-glass-fab--green-dark'
      : isLight
        ? 'fyn-glass-fab--neutral-light'
        : 'fyn-glass-fab--neutral-dark';

  useEffect(() => {
    ensureGlassFabCss();
    if (nodeRef.current) bindGlassNode(nodeRef.current, toneClass, size);
  }, [toneClass, size]);

  return (
    <Pressable
      ref={(node) => {
        const el = isHtmlElement(node) ? node : null;
        nodeRef.current = el;
        if (el) {
          ensureGlassFabCss();
          bindGlassNode(el, toneClass, size);
        }
      }}
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
          flexGrow: 0,
          flexShrink: 0,
        },
        style,
        pressed && floatingGlassButtonPressed,
      ]}
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
