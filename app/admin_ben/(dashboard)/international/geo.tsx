"use client";

import countries from "world-countries";

export type CountryInfo = { code: string; name: string; region: string; prefix: string };

/** Every country with its ISO code and French name. */
export const COUNTRIES: CountryInfo[] = countries
  .map((country) => ({
    code: country.cca2,
    name: country.translations.fra?.common ?? country.name.common,
    region: country.region,
    // Single-suffix countries get the full prefix (+33); shared ones (+1 …) keep the root.
    prefix: country.idd?.root ? country.idd.root + (country.idd.suffixes?.length === 1 ? country.idd.suffixes[0] : "") : "",
  }))
  .filter((country) => country.code && country.name)
  .sort((a, b) => a.name.localeCompare(b.name, "fr"));

const NAMES = new Map(COUNTRIES.map((country) => [country.code, country.name]));
export const countryName = (code: string) => NAMES.get(code) ?? code;

export const COUNTRY_OPTIONS = COUNTRIES.map((country) => ({ label: country.name, value: country.code }));
