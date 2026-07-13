// ─── Emission Factor Library ─────────────────────────────────────────────────
// Centralized, multi-country, multi-year emission factor database with:
// - Filtering by country + year
// - Currency conversion (USD ↔ AUD ↔ EUR etc.)
// - Inflation adjustment (align EF base year with reporting year)
// - Best-EF selection logic (most specific country, most recent year, best quality)
// - Custom factor support (user-defined, stored in CustomEmissionFactor entity)

// ─── Currency Exchange Rates (per 1 USD, approximate mid-2024) ────────────────
export const CURRENCY_RATES = {
  USD: 1.0,
  AUD: 1.51,
  EUR: 0.92,
  GBP: 0.79,
  SGD: 1.35,
  CAD: 1.37,
  NZD: 1.65,
  INR: 83.5,
  JPY: 157,
  CNY: 7.25,
};

// ─── Inflation Indices (CPI, base 2024 = 100) ──────────────────────────────────
export const INFLATION_INDICES = {
  AU: { 2020: 87.6, 2021: 90.1, 2022: 93.8, 2023: 96.9, 2024: 100.0, 2025: 103.5, 2026: 106.1 },
  US: { 2020: 92.9, 2021: 96.5, 2022: 99.2, 2023: 101.3, 2024: 103.0, 2025: 105.2, 2026: 107.4 },
  UK: { 2020: 92.7, 2021: 95.9, 2022: 100.0, 2023: 102.5, 2024: 104.0, 2025: 106.2, 2026: 108.3 },
  EU: { 2020: 93.5, 2021: 96.2, 2022: 100.5, 2023: 103.2, 2024: 105.0, 2025: 107.1, 2026: 109.0 },
  Global: { 2020: 92.5, 2021: 95.8, 2022: 99.0, 2023: 101.5, 2024: 103.5, 2025: 105.8, 2026: 108.0 },
};

// ─── Country Normalization ────────────────────────────────────────────────────
const COUNTRY_ALIASES = {
  "australia": "AU", "au": "AU", "aus": "AU",
  "united states": "US", "us": "US", "usa": "US", "united states of america": "US",
  "united kingdom": "UK", "uk": "UK", "great britain": "UK", "england": "UK",
  "europe": "EU", "eu": "EU", "european union": "EU",
  "new zealand": "NZ", "nz": "NZ",
  "canada": "CA", "ca": "CA",
  "singapore": "SG", "sg": "SG",
  "india": "IN", "in": "IN",
  "japan": "JP", "jp": "JP",
  "china": "CN", "cn": "CN",
};

export function normalizeCountry(input) {
  if (!input) return "Global";
  const lower = String(input).toLowerCase().trim();
  return COUNTRY_ALIASES[lower] || (lower.length === 2 ? lower.toUpperCase() : "Global");
}

export function getCountryFromLocation(location) {
  if (!location) return "Global";
  return normalizeCountry(location.country || location.city || "Global");
}

// ─── Emission Factor Database ─────────────────────────────────────────────────
// Each factor: { id, category, name, country, year, value, unit, source, qualityTier, scope, currency? }
// qualityTier: 1 = supplier-specific/verified, 2 = regional/metered, 3 = industry average, 4 = spend-based estimate
export const EMISSION_FACTORS = [
  // ── ENERGY: Electricity Grid ──
  { id: "elec-au-2024", category: "energy", name: "Electricity - Grid (AU)", country: "AU", year: 2024, value: 0.79, unit: "kgCO2e/kWh", source: "Australian NGA Factors 2024", qualityTier: 2, scope: "Scope 2" },
  { id: "elec-au-2023", category: "energy", name: "Electricity - Grid (AU)", country: "AU", year: 2023, value: 0.81, unit: "kgCO2e/kWh", source: "Australian NGA Factors 2023", qualityTier: 2, scope: "Scope 2" },
  { id: "elec-au-2022", category: "energy", name: "Electricity - Grid (AU)", country: "AU", year: 2022, value: 0.83, unit: "kgCO2e/kWh", source: "Australian NGA Factors 2022", qualityTier: 2, scope: "Scope 2" },
  { id: "elec-us-2024", category: "energy", name: "Electricity - Grid (US)", country: "US", year: 2024, value: 0.371, unit: "kgCO2e/kWh", source: "EPA eGRID 2024", qualityTier: 2, scope: "Scope 2" },
  { id: "elec-us-2023", category: "energy", name: "Electricity - Grid (US)", country: "US", year: 2023, value: 0.385, unit: "kgCO2e/kWh", source: "EPA eGRID 2023", qualityTier: 2, scope: "Scope 2" },
  { id: "elec-uk-2024", category: "energy", name: "Electricity - Grid (UK)", country: "UK", year: 2024, value: 0.207, unit: "kgCO2e/kWh", source: "DEFRA GHG Factors 2024", qualityTier: 2, scope: "Scope 2" },
  { id: "elec-uk-2023", category: "energy", name: "Electricity - Grid (UK)", country: "UK", year: 2023, value: 0.219, unit: "kgCO2e/kWh", source: "DEFRA GHG Factors 2023", qualityTier: 2, scope: "Scope 2" },
  { id: "elec-eu-2024", category: "energy", name: "Electricity - Grid (EU)", country: "EU", year: 2024, value: 0.231, unit: "kgCO2e/kWh", source: "EEA 2024", qualityTier: 2, scope: "Scope 2" },
  { id: "elec-eu-2023", category: "energy", name: "Electricity - Grid (EU)", country: "EU", year: 2023, value: 0.245, unit: "kgCO2e/kWh", source: "EEA 2023", qualityTier: 2, scope: "Scope 2" },
  { id: "elec-global-2024", category: "energy", name: "Electricity - Grid (Global Avg)", country: "Global", year: 2024, value: 0.475, unit: "kgCO2e/kWh", source: "IEA Global 2024", qualityTier: 3, scope: "Scope 2" },
  { id: "elec-renewable", category: "energy", name: "Electricity - Renewable (100% Green)", country: "Global", year: 2024, value: 0.02, unit: "kgCO2e/kWh", source: "GHG Protocol Scope 2 Guidance", qualityTier: 1, scope: "Scope 2" },

  // ── FUEL: Stationary Combustion ──
  { id: "natgas-au-2024", category: "fuel", name: "Natural Gas", country: "AU", year: 2024, value: 2.04, unit: "kgCO2e/m³", source: "Australian NGA Factors 2024", qualityTier: 2, scope: "Scope 1" },
  { id: "natgas-us-2024", category: "fuel", name: "Natural Gas", country: "US", year: 2024, value: 2.02, unit: "kgCO2e/m³", source: "EPA 2024", qualityTier: 2, scope: "Scope 1" },
  { id: "natgas-uk-2024", category: "fuel", name: "Natural Gas", country: "UK", year: 2024, value: 2.01, unit: "kgCO2e/m³", source: "DEFRA 2024", qualityTier: 2, scope: "Scope 1" },
  { id: "diesel-au-2024", category: "fuel", name: "Diesel", country: "AU", year: 2024, value: 2.68, unit: "kgCO2e/L", source: "Australian NGA Factors 2024", qualityTier: 2, scope: "Scope 1" },
  { id: "diesel-us-2024", category: "fuel", name: "Diesel", country: "US", year: 2024, value: 2.66, unit: "kgCO2e/L", source: "EPA 2024", qualityTier: 2, scope: "Scope 1" },
  { id: "diesel-uk-2024", category: "fuel", name: "Diesel", country: "UK", year: 2024, value: 2.69, unit: "kgCO2e/L", source: "DEFRA 2024", qualityTier: 2, scope: "Scope 1" },
  { id: "petrol-au-2024", category: "fuel", name: "Petrol", country: "AU", year: 2024, value: 2.31, unit: "kgCO2e/L", source: "Australian NGA Factors 2024", qualityTier: 2, scope: "Scope 1" },
  { id: "petrol-us-2024", category: "fuel", name: "Petrol", country: "US", year: 2024, value: 2.29, unit: "kgCO2e/L", source: "EPA 2024", qualityTier: 2, scope: "Scope 1" },
  { id: "lpg-au-2024", category: "fuel", name: "LPG", country: "AU", year: 2024, value: 1.51, unit: "kgCO2e/L", source: "Australian NGA Factors 2024", qualityTier: 2, scope: "Scope 1" },
  { id: "lpg-global-2024", category: "fuel", name: "LPG", country: "Global", year: 2024, value: 1.49, unit: "kgCO2e/L", source: "IPCC AR6", qualityTier: 3, scope: "Scope 1" },

  // ── TRAVEL: Business Travel ──
  { id: "flight-dom-au-2024", category: "travel", name: "Domestic Flights", country: "AU", year: 2024, value: 0.255, unit: "kgCO2e/km", source: "DEFRA 2024 / Airlines AU", qualityTier: 2, scope: "Scope 3" },
  { id: "flight-intl-econ-2024", category: "travel", name: "International Flights (Economy)", country: "Global", year: 2024, value: 0.195, unit: "kgCO2e/km", source: "DEFRA 2024 / ICAO", qualityTier: 2, scope: "Scope 3" },
  { id: "flight-intl-biz-2024", category: "travel", name: "International Flights (Business)", country: "Global", year: 2024, value: 0.429, unit: "kgCO2e/km", source: "DEFRA 2024 / ICAO", qualityTier: 2, scope: "Scope 3" },
  { id: "car-petrol-2024", category: "travel", name: "Car (Petrol)", country: "Global", year: 2024, value: 0.170, unit: "kgCO2e/km", source: "DEFRA 2024", qualityTier: 2, scope: "Scope 3" },
  { id: "car-ev-2024", category: "travel", name: "Car (EV)", country: "Global", year: 2024, value: 0.064, unit: "kgCO2e/km", source: "DEFRA 2024", qualityTier: 2, scope: "Scope 3" },
  { id: "train-2024", category: "travel", name: "Train", country: "Global", year: 2024, value: 0.041, unit: "kgCO2e/km", source: "DEFRA 2024", qualityTier: 2, scope: "Scope 3" },
  { id: "bus-2024", category: "travel", name: "Bus", country: "Global", year: 2024, value: 0.089, unit: "kgCO2e/km", source: "DEFRA 2024", qualityTier: 2, scope: "Scope 3" },
  { id: "rideshare-2024", category: "travel", name: "Rideshare", country: "Global", year: 2024, value: 0.182, unit: "kgCO2e/km", source: "DEFRA 2024", qualityTier: 3, scope: "Scope 3" },

  // ── COMMUTE: Employee Commuting ──
  { id: "commute-car-petrol", category: "commute", name: "Car (Petrol)", country: "Global", year: 2024, value: 0.170, unit: "kgCO2e/km", source: "DEFRA 2024", qualityTier: 2, scope: "Scope 3" },
  { id: "commute-car-ev", category: "commute", name: "Car (EV)", country: "Global", year: 2024, value: 0.064, unit: "kgCO2e/km", source: "DEFRA 2024", qualityTier: 2, scope: "Scope 3" },
  { id: "commute-train", category: "commute", name: "Train", country: "Global", year: 2024, value: 0.041, unit: "kgCO2e/km", source: "DEFRA 2024", qualityTier: 2, scope: "Scope 3" },
  { id: "commute-bus", category: "commute", name: "Bus", country: "Global", year: 2024, value: 0.089, unit: "kgCO2e/km", source: "DEFRA 2024", qualityTier: 2, scope: "Scope 3" },
  { id: "commute-bike", category: "commute", name: "Bicycle/Walking", country: "Global", year: 2024, value: 0.0, unit: "kgCO2e/km", source: "N/A", qualityTier: 1, scope: "Scope 3" },
  { id: "commute-wfh", category: "commute", name: "Work from Home", country: "Global", year: 2024, value: 0.012, unit: "kgCO2e/hr", source: "Ecoact WFH 2024", qualityTier: 3, scope: "Scope 3" },

  // ── TRANSPORT: Freight (tonne-km) ──
  { id: "freight-road-2024", category: "transport", name: "Road (Truck)", country: "Global", year: 2024, value: 0.096, unit: "kgCO2e/tkm", source: "DEFRA 2024", qualityTier: 2, scope: "Scope 3" },
  { id: "freight-rail-2024", category: "transport", name: "Rail", country: "Global", year: 2024, value: 0.028, unit: "kgCO2e/tkm", source: "DEFRA 2024", qualityTier: 2, scope: "Scope 3" },
  { id: "freight-sea-2024", category: "transport", name: "Sea (Container)", country: "Global", year: 2024, value: 0.011, unit: "kgCO2e/tkm", source: "DEFRA 2024", qualityTier: 2, scope: "Scope 3" },
  { id: "freight-air-2024", category: "transport", name: "Air", country: "Global", year: 2024, value: 0.602, unit: "kgCO2e/tkm", source: "DEFRA 2024", qualityTier: 2, scope: "Scope 3" },

  // ── WASTE ──
  { id: "waste-landfill-gen-au", category: "waste", name: "Landfill - General", country: "AU", year: 2024, value: 1.91, unit: "kgCO2e/kg", source: "Australian NGA Factors 2024", qualityTier: 2, scope: "Scope 3" },
  { id: "waste-landfill-org-au", category: "waste", name: "Landfill - Organic", country: "AU", year: 2024, value: 2.64, unit: "kgCO2e/kg", source: "Australian NGA Factors 2024", qualityTier: 2, scope: "Scope 3" },
  { id: "waste-recycle-metal", category: "waste", name: "Recycling - Metal", country: "Global", year: 2024, value: 0.02, unit: "kgCO2e/kg", source: "DEFRA 2024", qualityTier: 2, scope: "Scope 3" },
  { id: "waste-recycle-plastic", category: "waste", name: "Recycling - Plastic", country: "Global", year: 2024, value: 0.04, unit: "kgCO2e/kg", source: "DEFRA 2024", qualityTier: 2, scope: "Scope 3" },
  { id: "waste-recycle-paper", category: "waste", name: "Recycling - Paper", country: "Global", year: 2024, value: 0.03, unit: "kgCO2e/kg", source: "DEFRA 2024", qualityTier: 2, scope: "Scope 3" },
  { id: "waste-incineration", category: "waste", name: "Incineration", country: "Global", year: 2024, value: 0.56, unit: "kgCO2e/kg", source: "DEFRA 2024", qualityTier: 2, scope: "Scope 3" },
  { id: "waste-composting", category: "waste", name: "Composting", country: "Global", year: 2024, value: 0.19, unit: "kgCO2e/kg", source: "DEFRA 2024", qualityTier: 2, scope: "Scope 3" },

  // ── MATERIALS ──
  { id: "mat-steel", category: "material", name: "Steel", country: "Global", year: 2024, value: 1.85, unit: "kgCO2e/kg", source: "ECOINVENT 3.10", qualityTier: 3, scope: "Scope 3" },
  { id: "mat-aluminum", category: "material", name: "Aluminum", country: "Global", year: 2024, value: 8.24, unit: "kgCO2e/kg", source: "ECOINVENT 3.10", qualityTier: 3, scope: "Scope 3" },
  { id: "mat-copper", category: "material", name: "Copper", country: "Global", year: 2024, value: 3.80, unit: "kgCO2e/kg", source: "ECOINVENT 3.10", qualityTier: 3, scope: "Scope 3" },
  { id: "mat-pet", category: "material", name: "Plastic (PET)", country: "Global", year: 2024, value: 2.73, unit: "kgCO2e/kg", source: "ECOINVENT 3.10", qualityTier: 3, scope: "Scope 3" },
  { id: "mat-hdpe", category: "material", name: "Plastic (HDPE)", country: "Global", year: 2024, value: 2.13, unit: "kgCO2e/kg", source: "ECOINVENT 3.10", qualityTier: 3, scope: "Scope 3" },
  { id: "mat-glass", category: "material", name: "Glass", country: "Global", year: 2024, value: 0.85, unit: "kgCO2e/kg", source: "ECOINVENT 3.10", qualityTier: 3, scope: "Scope 3" },
  { id: "mat-cardboard", category: "material", name: "Cardboard", country: "Global", year: 2024, value: 0.94, unit: "kgCO2e/kg", source: "ECOINVENT 3.10", qualityTier: 3, scope: "Scope 3" },
  { id: "mat-wood", category: "material", name: "Wood", country: "Global", year: 2024, value: 0.46, unit: "kgCO2e/kg", source: "ECOINVENT 3.10", qualityTier: 3, scope: "Scope 3" },
  { id: "mat-concrete", category: "material", name: "Concrete", country: "Global", year: 2024, value: 0.13, unit: "kgCO2e/kg", source: "ECOINVENT 3.10", qualityTier: 3, scope: "Scope 3" },

  // ── REFRIGERANTS (GWP values, IPCC AR6) ──
  { id: "ref-r22", category: "refrigerant", name: "R-22 (HCFC)", country: "Global", year: 2024, value: 1810, unit: "kgCO2e/kg", source: "IPCC AR6 GWP100", qualityTier: 1, scope: "Scope 1" },
  { id: "ref-r134a", category: "refrigerant", name: "R-134a", country: "Global", year: 2024, value: 1430, unit: "kgCO2e/kg", source: "IPCC AR6 GWP100", qualityTier: 1, scope: "Scope 1" },
  { id: "ref-r410a", category: "refrigerant", name: "R-410A", country: "Global", year: 2024, value: 2088, unit: "kgCO2e/kg", source: "IPCC AR6 GWP100", qualityTier: 1, scope: "Scope 1" },
  { id: "ref-r407c", category: "refrigerant", name: "R-407C", country: "Global", year: 2024, value: 1774, unit: "kgCO2e/kg", source: "IPCC AR6 GWP100", qualityTier: 1, scope: "Scope 1" },
  { id: "ref-r404a", category: "refrigerant", name: "R-404A", country: "Global", year: 2024, value: 3922, unit: "kgCO2e/kg", source: "IPCC AR6 GWP100", qualityTier: 1, scope: "Scope 1" },
  { id: "ref-r32", category: "refrigerant", name: "R-32", country: "Global", year: 2024, value: 675, unit: "kgCO2e/kg", source: "IPCC AR6 GWP100", qualityTier: 1, scope: "Scope 1" },
  { id: "ref-co2", category: "refrigerant", name: "CO2 (R-744)", country: "Global", year: 2024, value: 1, unit: "kgCO2e/kg", source: "IPCC AR6 GWP100", qualityTier: 1, scope: "Scope 1" },

  // ── HEAT / STEAM / COOLING ──
  { id: "heat-steam-2024", category: "heat_steam", name: "Steam", country: "Global", year: 2024, value: 0.268, unit: "kgCO2e/GJ", source: "IEA District Energy 2024", qualityTier: 2, scope: "Scope 2" },
  { id: "heat-district-2024", category: "heat_steam", name: "Heat (District)", country: "Global", year: 2024, value: 0.210, unit: "kgCO2e/GJ", source: "IEA District Energy 2024", qualityTier: 2, scope: "Scope 2" },
  { id: "heat-chilled-2024", category: "heat_steam", name: "Chilled Water", country: "Global", year: 2024, value: 0.132, unit: "kgCO2e/GJ", source: "IEA District Energy 2024", qualityTier: 2, scope: "Scope 2" },

  // ── PROCESS EMISSIONS (stoichiometric) ──
  { id: "proc-limestone", category: "process", name: "Limestone Calcination", country: "Global", year: 2024, value: 0.44, unit: "tCO2e/t", source: "IPCC AR6 / NGER 2007", qualityTier: 1, scope: "Scope 1" },
  { id: "proc-clinker", category: "process", name: "Cement Clinker", country: "Global", year: 2024, value: 0.52, unit: "tCO2e/t", source: "IPCC AR6 / NGER 2007", qualityTier: 1, scope: "Scope 1" },
  { id: "proc-quicklime", category: "process", name: "Quicklime", country: "Global", year: 2024, value: 0.75, unit: "tCO2e/t", source: "IPCC AR6 / NGER 2007", qualityTier: 1, scope: "Scope 1" },
  { id: "proc-sodaash", category: "process", name: "Soda Ash", country: "Global", year: 2024, value: 0.41, unit: "tCO2e/t", source: "IPCC AR6 / NGER 2007", qualityTier: 1, scope: "Scope 1" },

  // ── WATER ──
  { id: "water-au-2024", category: "water", name: "Water Treatment (AU)", country: "AU", year: 2024, value: 0.344, unit: "kgCO2e/m³", source: "Australian NGA / Water Services Assoc", qualityTier: 2, scope: "Scope 3" },
  { id: "water-uk-2024", category: "water", name: "Water Treatment (UK)", country: "UK", year: 2024, value: 0.149, unit: "kgCO2e/m³", source: "DEFRA 2024", qualityTier: 2, scope: "Scope 3" },
  { id: "water-global-2024", category: "water", name: "Water Treatment (Global)", country: "Global", year: 2024, value: 0.30, unit: "kgCO2e/m³", source: "IEA / IWA", qualityTier: 3, scope: "Scope 3" },

  // ── SPEND-BASED (EEIO) ──
  { id: "spend-manufacturing-usd", category: "spend_based", name: "Manufacturing - General", country: "Global", year: 2024, value: 0.35, unit: "kgCO2e/USD", source: "EEIO Database 2024", qualityTier: 4, scope: "Scope 3", currency: "USD" },
  { id: "spend-services-usd", category: "spend_based", name: "Professional Services", country: "Global", year: 2024, value: 0.15, unit: "kgCO2e/USD", source: "EEIO Database 2024", qualityTier: 4, scope: "Scope 3", currency: "USD" },
  { id: "spend-energy-usd", category: "spend_based", name: "Energy Spend", country: "Global", year: 2024, value: 0.0025, unit: "kgCO2e/USD", source: "EEIO Database 2024", qualityTier: 4, scope: "Scope 3", currency: "USD" },
];

// ─── Helper: Get all unique countries for a category ──────────────────────────
export function getCountriesForCategory(category) {
  const countries = new Set(["Global"]);
  EMISSION_FACTORS.forEach(f => { if (f.category === category) countries.add(f.country); });
  return Array.from(countries).sort();
}

// ─── Helper: Get all unique years for a category + country ─────────────────────
export function getYearsForCategory(category, country) {
  const years = new Set();
  EMISSION_FACTORS.forEach(f => {
    if (f.category === category && (!country || f.country === country || f.country === "Global")) {
      years.add(f.year);
    }
  });
  return Array.from(years).sort((a, b) => b - a);
}

// ─── Filter factors by category, country, and year ───────────────────────────
export function getFactors({ category, country, year }) {
  return EMISSION_FACTORS.filter(f => {
    if (f.category !== category) return false;
    if (country && f.country !== country && f.country !== "Global") return false;
    if (year && f.year !== year) return false;
    return true;
  });
}

// ─── Get all factors for a category, filtered by country (all years) ──────────
export function getFactorsByCountry(category, country) {
  const normalized = normalizeCountry(country);
  return EMISSION_FACTORS.filter(f => {
    if (f.category !== category) return false;
    return f.country === normalized || f.country === "Global";
  });
}

// ─── Best EF Selection Logic ──────────────────────────────────────────────────
// Priority: 1) Country-specific > Global, 2) Closest year to reporting year, 3) Best quality tier
export function getBestFactor({ category, country, reportingYear }) {
  const normalized = normalizeCountry(country);
  const all = EMISSION_FACTORS.filter(f => f.category === category && (f.country === normalized || f.country === "Global"));
  if (all.length === 0) return null;

  // Sort by: country specificity (country-specific first), then year proximity, then quality tier
  const scored = all.map(f => {
    const countryScore = f.country === normalized ? 0 : 1; // 0 = exact match, 1 = global fallback
    const yearDiff = Math.abs(f.year - (reportingYear || new Date().getFullYear()));
    return { factor: f, countryScore, yearDiff, qualityTier: f.qualityTier };
  });

  scored.sort((a, b) => {
    if (a.countryScore !== b.countryScore) return a.countryScore - b.countryScore;
    if (a.yearDiff !== b.yearDiff) return a.yearDiff - b.yearDiff;
    return a.qualityTier - b.qualityTier;
  });

  return scored[0].factor;
}

// ─── Currency Conversion ──────────────────────────────────────────────────────
export function convertCurrency(amount, fromCurrency, toCurrency) {
  if (fromCurrency === toCurrency) return amount;
  const fromRate = CURRENCY_RATES[fromCurrency] || 1;
  const toRate = CURRENCY_RATES[toCurrency] || 1;
  // amount is in 'from' currency. Convert to USD first, then to target.
  const usd = amount / fromRate;
  return usd * toRate;
}

// ─── Inflation Adjustment ─────────────────────────────────────────────────────
// Adjusts a monetary value from baseYear to targetYear using CPI indices.
export function applyInflation(value, baseYear, targetYear, country) {
  const normalized = normalizeCountry(country);
  const indices = INFLATION_INDICES[normalized] || INFLATION_INDICES.Global;
  const baseIndex = indices[baseYear] || indices[Math.min(...Object.keys(indices).map(Number))] || 100;
  const targetIndex = indices[targetYear] || indices[Math.max(...Object.keys(indices).map(Number))] || 100;
  return value * (targetIndex / baseIndex);
}

// ─── Full Adjustment: Currency + Inflation for a spend-based EF ───────────────
// If the EF is in USD but the user's spend is in AUD, convert the spend to EF currency,
// then adjust the spend backward from the reporting year to the EF's base year
// so the spend and EF are aligned in the same year's purchasing power.
export function adjustSpendForFactor(spendAmount, spendCurrency, factor, reportingYear) {
  if (!factor || !factor.currency) return { adjustedSpend: spendAmount, note: "No currency adjustment needed" };

  const ry = reportingYear || new Date().getFullYear();

  // Step 1: Convert spend to the factor's currency (e.g., AUD → USD)
  const spendInFactorCurrency = convertCurrency(spendAmount, spendCurrency, factor.currency);

  // Step 2: Adjust spend backward from reporting year to EF's base year
  // This aligns the spend with the EF's base year purchasing power.
  // $100 in 2024 → ~$96 in 2022 (because 2024 dollars are worth less than 2022 dollars)
  const inflationAdjusted = applyInflation(spendInFactorCurrency, ry, factor.year, factor.country);

  const inflationRate = ((inflationAdjusted / spendInFactorCurrency) - 1) * 100;
  const note = `Spend ${spendAmount} ${spendCurrency} → ${spendInFactorCurrency.toFixed(2)} ${factor.currency} (FX) → ${inflationAdjusted.toFixed(2)} ${factor.currency} (inflation-adjusted ${ry}→${factor.year}, ${inflationRate >= 0 ? "+" : ""}${inflationRate.toFixed(1)}%)`;

  return { adjustedSpend: inflationAdjusted, note };
}

// ─── Merge standard + custom factors ──────────────────────────────────────────
export function mergeFactors(standardFactors, customFactors) {
  const custom = (customFactors || []).filter(c => c.is_active !== false).map(c => ({
    ...c,
    id: `custom-${c.id}`,
    isCustom: true,
    source: c.source || "User-defined",
    qualityTier: c.quality_tier || 3,
  }));
  return [...standardFactors, ...custom];
}

// ─── Quality Tier Labels ──────────────────────────────────────────────────────
export const QUALITY_TIER_LABELS = {
  1: { label: "Gold", desc: "Supplier-specific / Verified", color: "bg-amber-100 text-amber-700 border-amber-300" },
  2: { label: "Silver", desc: "Regional / Metered", color: "bg-slate-100 text-slate-700 border-slate-300" },
  3: { label: "Bronze", desc: "Industry Average", color: "bg-orange-100 text-orange-700 border-orange-300" },
  4: { label: "Estimated", desc: "Spend-based proxy", color: "bg-red-50 text-red-600 border-red-200" },
};

export function getQualityTierLabel(tier) {
  return QUALITY_TIER_LABELS[tier] || QUALITY_TIER_LABELS[4];
}