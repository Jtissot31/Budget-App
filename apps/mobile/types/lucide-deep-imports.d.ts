/**
 * Imports profonds lucide (`dist/cjs/icons/*.js`) — pattern app pour éviter
 * d'embarquer tout le catalogue. Résolus au runtime via `resolveLucideIcon`.
 */
declare module 'lucide-react-native/dist/cjs/icons/*' {
  const mod: unknown;
  export default mod;
}
