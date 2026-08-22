/**
 * High-signal stress adjectives in Accueil / alert-center titles
 * (e.g. « marge insuffisante », « Budget Épicerie dépassé », « taux élevé », « solde bas »).
 * Longest-first so « insuffisante » wins over « insuffisant ».
 */
export const ALERT_TITLE_STRESS_WORDS = [
  'insuffisante',
  'insuffisant',
  'dangereusement',
  'dépassée',
  'dépassé',
  'élevée',
  'élevé',
  'basse',
  'bas',
] as const;

export type AlertTitleStressSegment = {
  text: string;
  stress: boolean;
};

const ALERT_TITLE_STRESS_RE = new RegExp(
  `(${ALERT_TITLE_STRESS_WORDS.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
  'gi',
);

function isUnicodeLetter(char: string | undefined): boolean {
  return Boolean(char && /\p{L}/u.test(char));
}

/** Split an alert title into plain + stress segments for orange Nested Text highlighting. */
export function splitAlertTitleStressSegments(title: string): AlertTitleStressSegment[] {
  if (!title) return [];

  const segments: AlertTitleStressSegment[] = [];
  const re = new RegExp(ALERT_TITLE_STRESS_RE.source, ALERT_TITLE_STRESS_RE.flags);
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(title)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    const before = start > 0 ? title[start - 1] : undefined;
    const after = end < title.length ? title[end] : undefined;
    // Skip matches glued inside a longer word (e.g. « dépasse » in « dépassement »).
    if (isUnicodeLetter(before) || isUnicodeLetter(after)) {
      continue;
    }
    if (start > lastIndex) {
      segments.push({ text: title.slice(lastIndex, start), stress: false });
    }
    segments.push({ text: match[0], stress: true });
    lastIndex = end;
  }

  if (lastIndex < title.length) {
    segments.push({ text: title.slice(lastIndex), stress: false });
  }

  return segments.length > 0 ? segments : [{ text: title, stress: false }];
}
