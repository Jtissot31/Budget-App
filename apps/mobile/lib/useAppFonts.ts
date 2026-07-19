import { useFonts as useExpoFonts } from 'expo-font';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import type { FontSource } from 'expo-font';

async function fontsAppearReady(fontNames: string[]): Promise<boolean> {
  if (typeof document === 'undefined' || !document.fonts) return false;
  await document.fonts.ready;
  const loaded = new Set<string>();
  document.fonts.forEach((face) => loaded.add(face.family));
  return fontNames.every((name) => loaded.has(name));
}

/**
 * Web-safe font hook — recovers from FontFaceObserver timeouts when fonts did load.
 */
export function useAppFonts(map: Record<string, FontSource>): [boolean, Error | null] {
  const [loaded, error] = useExpoFonts(map);
  const [webRecovered, setWebRecovered] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || loaded || webRecovered) return;

    const fontNames = Object.keys(map);
    let cancelled = false;

    void fontsAppearReady(fontNames).then((ready) => {
      if (!cancelled && ready) setWebRecovered(true);
    });

    return () => {
      cancelled = true;
    };
  }, [loaded, map, webRecovered]);

  if (Platform.OS !== 'web') {
    return [loaded, error];
  }

  return [loaded || webRecovered, webRecovered ? null : error];
}
