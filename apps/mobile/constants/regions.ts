import { ISO_COUNTRY_ENTRIES } from '@/constants/regionData/countries.generated';
import { SUBDIVISIONS } from '@/constants/regionData/subdivisions';
import type { CountryEntry, RegionEntry } from '@/constants/regionData/types';

export type { CountryEntry, RegionEntry };

export const COUNTRIES: CountryEntry[] = ISO_COUNTRY_ENTRIES.map((country) => {
  const regions = SUBDIVISIONS[country.countryCode];
  return regions?.length ? { ...country, regions } : country;
});

function buildRegionId(countryCode: string, regionCode?: string): string {
  return regionCode ? `${countryCode}-${regionCode}` : countryCode;
}

const countryByCode = new Map(COUNTRIES.map((country) => [country.countryCode, country]));

const regionLookup = new Map<string, { country: CountryEntry; region?: RegionEntry }>();
for (const country of COUNTRIES) {
  regionLookup.set(country.countryCode, { country });
  for (const region of country.regions ?? []) {
    regionLookup.set(buildRegionId(country.countryCode, region.code), { country, region });
  }
}

export const ALL_REGION_IDS: readonly string[] = [...regionLookup.keys()];
export type CountryRegion = string;

export const VALID_REGIONS = new Set<string>(ALL_REGION_IDS);

export function isCountryRegion(value: string): value is CountryRegion {
  return VALID_REGIONS.has(value);
}

export function getCountryByCode(countryCode: string): CountryEntry | undefined {
  return countryByCode.get(countryCode);
}

export function parseRegionId(regionId: string): { countryCode: string; regionCode?: string } {
  const dash = regionId.indexOf('-');
  if (dash === -1) return { countryCode: regionId };
  return {
    countryCode: regionId.slice(0, dash),
    regionCode: regionId.slice(dash + 1),
  };
}

export function formatRegionLabel(regionId: CountryRegion): string {
  const entry = regionLookup.get(regionId);
  if (!entry) return regionId;
  if (entry.region) return entry.region.name;
  return entry.country.countryName;
}

export function formatRegionDisplayValue(regionId: CountryRegion): string {
  const entry = regionLookup.get(regionId);
  if (!entry) return regionId;
  if (entry.region) {
    return `${entry.country.countryCode} · ${entry.region.code}`;
  }
  return entry.country.countryName;
}

export function resolveRegionId(
  countryCode: string | null | undefined,
  subRegionCode?: string | null,
): CountryRegion | null {
  if (!countryCode) return null;

  const normalizedCountry = countryCode.toUpperCase();
  const country = countryByCode.get(normalizedCountry);
  if (!country) return null;

  if (subRegionCode && country.regions?.length) {
    const normalizedSub = subRegionCode.toUpperCase();
    const match = country.regions.find(
      (region) =>
        region.code.toUpperCase() === normalizedSub ||
        region.name.toLowerCase() === subRegionCode.toLowerCase(),
    );
    if (match) {
      return buildRegionId(normalizedCountry, match.code);
    }
  }

  return normalizedCountry;
}

function stripDiacritics(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Lowercase, trim, and strip accents for search matching. */
export function normalizeSearchText(value: string): string {
  return stripDiacritics(value).trim().toLowerCase();
}

export function normalizeSortLetter(name: string): string {
  const normalized = stripDiacritics(name).trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(normalized) ? normalized : '#';
}

export type IndexedListItem = {
  id: string;
  label: string;
  description?: string;
  sortKey: string;
  kind?: 'country' | 'subRegion';
};

type SearchableSubRegion = {
  regionId: string;
  regionName: string;
  regionCode: string;
  countryCode: string;
  countryName: string;
};

const ALL_SEARCHABLE_SUBREGIONS: SearchableSubRegion[] = COUNTRIES.flatMap((country) =>
  (country.regions ?? []).map((region) => ({
    regionId: buildRegionId(country.countryCode, region.code),
    regionName: region.name,
    regionCode: region.code,
    countryCode: country.countryCode,
    countryName: country.countryName,
  })),
);

export type LetterIndex = {
  letters: string[];
  indexByLetter: Record<string, number>;
};

function mapCountryToListItem(country: CountryEntry, kind: IndexedListItem['kind'] = 'country'): IndexedListItem {
  return {
    id: country.countryCode,
    label: country.countryName,
    description: country.regions?.length
      ? `${country.regions.length} région${country.regions.length > 1 ? 's' : ''}`
      : undefined,
    sortKey: country.countryName,
    kind,
  };
}

function mapSubRegionToListItem(entry: SearchableSubRegion): IndexedListItem {
  return {
    id: entry.regionId,
    label: entry.regionName,
    description: entry.countryName,
    sortKey: entry.regionName,
    kind: 'subRegion',
  };
}

function matchesSubRegionQuery(entry: SearchableSubRegion, normalizedQuery: string): boolean {
  return (
    normalizeSearchText(entry.regionName).includes(normalizedQuery) ||
    normalizeSearchText(entry.regionCode).includes(normalizedQuery) ||
    normalizeSearchText(entry.regionId).includes(normalizedQuery) ||
    normalizeSearchText(entry.countryName).includes(normalizedQuery)
  );
}

export function buildCountryList(searchQuery = ''): IndexedListItem[] {
  const query = normalizeSearchText(searchQuery);
  return COUNTRIES.filter((country) => {
    if (!query) return true;
    return (
      normalizeSearchText(country.countryName).includes(query) ||
      normalizeSearchText(country.countryCode).includes(query)
    );
  })
    .map(mapCountryToListItem)
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey, 'fr'));
}

/** Pre-built country list (no search) — avoids rebuilding 231 rows on every picker render. */
let cachedEmptyCountryList: IndexedListItem[] | null = null;
let cachedEmptyCountryLetterIndex: LetterIndex | null = null;

export function getCachedCountryList(): readonly IndexedListItem[] {
  if (!cachedEmptyCountryList) {
    cachedEmptyCountryList = buildCountryList('');
  }
  return cachedEmptyCountryList;
}

export function getCachedCountryLetterIndex(): LetterIndex {
  if (!cachedEmptyCountryLetterIndex) {
    cachedEmptyCountryLetterIndex = buildLetterIndex([...getCachedCountryList()]);
  }
  return cachedEmptyCountryLetterIndex;
}

export function isCountryOnlyRegionId(regionId: string): boolean {
  const { countryCode, regionCode } = parseRegionId(regionId);
  if (regionCode) return false;
  const country = countryByCode.get(countryCode);
  return Boolean(country?.regions?.length);
}

export function buildSubRegionList(countryCode: string, searchQuery = ''): IndexedListItem[] {
  const country = countryByCode.get(countryCode);
  if (!country?.regions?.length) return [];

  const query = normalizeSearchText(searchQuery);

  return country.regions
    .filter((region) => {
      if (!query) return true;
      return (
        normalizeSearchText(region.name).includes(query) ||
        normalizeSearchText(region.code).includes(query)
      );
    })
    .map((region) => ({
      id: buildRegionId(country.countryCode, region.code),
      label: region.name,
      description: region.code,
      sortKey: region.name,
    }))
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey, 'fr'));
}

/** Combined country + sub-region matches for root-level search. */
export function buildGlobalSearchList(searchQuery: string): IndexedListItem[] {
  const query = normalizeSearchText(searchQuery);
  if (!query) return [];

  const countryItems = COUNTRIES.filter(
    (country) =>
      normalizeSearchText(country.countryName).includes(query) ||
      normalizeSearchText(country.countryCode).includes(query),
  ).map((country) => mapCountryToListItem(country, 'country'));

  const subRegionItems = ALL_SEARCHABLE_SUBREGIONS.filter((entry) =>
    matchesSubRegionQuery(entry, query),
  ).map(mapSubRegionToListItem);

  return [...countryItems, ...subRegionItems].sort((a, b) =>
    a.sortKey.localeCompare(b.sortKey, 'fr'),
  );
}

function compareIndexLetters(a: string, b: string): number {
  if (a === '#') return b === '#' ? 0 : 1;
  if (b === '#') return -1;
  return a.localeCompare(b);
}

export function buildLetterIndex(items: IndexedListItem[]): LetterIndex {
  const indexByLetter: Record<string, number> = {};
  const letterSet = new Set<string>();

  for (let index = 0; index < items.length; index += 1) {
    const letter = normalizeSortLetter(items[index].sortKey);
    if (indexByLetter[letter] != null) continue;
    indexByLetter[letter] = index;
    letterSet.add(letter);
  }

  const letters = [...letterSet].sort(compareIndexLetters);
  return { letters, indexByLetter };
}

/** Map a vertical offset on the A–Z rail to the nearest indexed letter. */
export function resolveLetterAtRailOffset(
  offsetY: number,
  railHeight: number,
  letters: readonly string[],
): string | null {
  if (!letters.length || railHeight <= 0) return null;

  const clamped = Math.max(0, Math.min(offsetY, railHeight - 0.001));
  const segmentHeight = railHeight / letters.length;
  const index = Math.min(letters.length - 1, Math.floor(clamped / segmentHeight));
  return letters[index] ?? null;
}

/** Vertical center of a letter slot on the rail (for preview badge alignment). */
export function railOffsetForLetter(
  letter: string,
  railHeight: number,
  letters: readonly string[],
): number {
  const index = letters.indexOf(letter);
  if (index < 0 || railHeight <= 0 || !letters.length) return railHeight / 2;

  const segmentHeight = railHeight / letters.length;
  return (index + 0.5) * segmentHeight;
}

export const COUNTRY_COUNT = COUNTRIES.length;
