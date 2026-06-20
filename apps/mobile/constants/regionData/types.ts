export type RegionEntry = {
  code: string;
  name: string;
};

export type CountryEntry = {
  countryCode: string;
  countryName: string;
  regions?: RegionEntry[];
};
