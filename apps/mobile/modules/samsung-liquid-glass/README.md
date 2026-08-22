# samsung-liquid-glass

Native **One UI SemBlur** (`SemBlurInfo` / `semSetBlurInfo`) for Samsung devices.

## Runtime

| Runtime | Behavior |
|--------|----------|
| **Dev Client / `expo run:android` / EAS APK** on Samsung (API 31+) | Real SemBlur liquid glass |
| **Expo Go** | Module absent → `isSamsungLiquidGlassSupported()` is `false` → tint fallback |
| **Non-Samsung Android** (any binary) | SemBlur APIs missing → tint fallback |
| **Web / iOS** | Not used (iOS nav uses `expo-blur`) |

Wired in `package.json` as `"samsung-liquid-glass": "file:./modules/samsung-liquid-glass"`.
Autolinked via `expo-module.config.json` when you prebuild / build a custom native app.

## Why Expo Go cannot blur like Medusa Ox

Medusa Ox ships a **custom native binary** (Expo Dev Client) with blur modules compiled in.
Budget Tracker in Expo Go uses the **stock Expo Go APK** — custom native modules are not present, and Android `BlurView` / dimezis paths are unsafe there, so the floating tab bar stays on a dense translucent tint.

Parity path: `npx expo prebuild` → install Dev Client on the S25 → Metro against that client (not Expo Go).

## Build / install (from `apps/mobile`)

```bash
# Generate android/ + ios/ (includes this module via autolinking)
npm run prebuild:clean

# Local debug APK on a connected device (S25)
npm run run:android

# Or EAS Dev Client APK
eas build --profile development --platform android
```

Nav (`TabBarDynamicBlur.android.tsx`) mounts `SamsungLiquidGlassView` when SemBlur is supported; Expo Go keeps the tint-only path.
