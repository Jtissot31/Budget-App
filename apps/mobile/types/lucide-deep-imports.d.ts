/**
 * Deep Lucide imports (`dist/cjs/icons/*.js`) — app pattern to avoid bundling
 * the full catalog. Runtime still goes through `resolveLucideIcon` where needed.
 */
declare module 'lucide-react-native/dist/cjs/icons/*' {
  import type { LucideIcon } from 'lucide-react-native';
  const icon: LucideIcon;
  export default icon;
}

declare module 'lucide-react-native/dist/cjs/icons/*.js' {
  import type { LucideIcon } from 'lucide-react-native';
  const icon: LucideIcon;
  export default icon;
}
