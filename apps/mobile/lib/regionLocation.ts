import * as Location from 'expo-location';
import { getLocales } from 'expo-localization';
import { resolveRegionId, type CountryRegion } from '@/constants/regions';

export type RegionDetectionSource = 'location' | 'locale' | 'none';

export type RegionDetectionResult = {
  regionId: CountryRegion | null;
  source: RegionDetectionSource;
};

/**
 * Detects the user's country/region via GPS reverse-geocode, falling back to device locale.
 */
export async function detectCountryRegion(): Promise<RegionDetectionResult> {
  const fromLocation = await detectFromLocation();
  if (fromLocation) {
    return { regionId: fromLocation, source: 'location' };
  }

  const fromLocale = detectFromLocale();
  if (fromLocale) {
    return { regionId: fromLocale, source: 'locale' };
  }

  return { regionId: null, source: 'none' };
}

async function detectFromLocation(): Promise<CountryRegion | null> {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') return null;

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Low,
    });

    const [place] = await Location.reverseGeocodeAsync(position.coords);
    if (!place?.isoCountryCode) return null;

    const subRegion =
      place.region ??
      (typeof place.subregion === 'string' ? place.subregion : undefined);

    return resolveRegionId(place.isoCountryCode, subRegion);
  } catch {
    return null;
  }
}

function detectFromLocale(): CountryRegion | null {
  const locale = getLocales()[0];
  if (!locale?.regionCode) return null;
  return resolveRegionId(locale.regionCode);
}
