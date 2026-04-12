/**
 * CBPS / NCC Building Energy Intensity Tables
 * Source: Commercial Building Portfolio Study (CBPS) + NCC Climate Zone Data
 * Units: kWh/m²/year (electrical), MJ/m²/year (gas) — AU National averages
 */

export const CBPS_ELECTRICAL_INTENSITY_TABLE = {
  Offices:           { "Zone 1": 165, "Zone 2": 170, "Zone 3": 180, "Zone 4": 175, "Zone 5": 185, "Zone 6": 200, "Zone 7": 210 },
  Warehouses:        { "Zone 1": 70,  "Zone 2": 75,  "Zone 3": 80,  "Zone 4": 78,  "Zone 5": 85,  "Zone 6": 90,  "Zone 7": 95 },
  "Health Facilities":{ "Zone 1": 340, "Zone 2": 355, "Zone 3": 365, "Zone 4": 370, "Zone 5": 380, "Zone 6": 395, "Zone 7": 410 },
  Educational:       { "Zone 1": 105, "Zone 2": 110, "Zone 3": 115, "Zone 4": 118, "Zone 5": 120, "Zone 6": 130, "Zone 7": 135 },
  Retail:            { "Zone 1": 185, "Zone 2": 195, "Zone 3": 200, "Zone 4": 205, "Zone 5": 210, "Zone 6": 225, "Zone 7": 235 },
  Hospitality:       { "Zone 1": 300, "Zone 2": 315, "Zone 3": 325, "Zone 4": 332, "Zone 5": 340, "Zone 6": 355, "Zone 7": 370 },
  Industrial:        { "Zone 1": 130, "Zone 2": 135, "Zone 3": 140, "Zone 4": 145, "Zone 5": 150, "Zone 6": 158, "Zone 7": 165 },
  Other:             { "Zone 1": 140, "Zone 2": 145, "Zone 3": 148, "Zone 4": 150, "Zone 5": 150, "Zone 6": 158, "Zone 7": 165 },
};

export const CBPS_GAS_INTENSITY_TABLE = {
  Offices:           { "Zone 1": 80,  "Zone 2": 110, "Zone 3": 160, "Zone 4": 200, "Zone 5": 260, "Zone 6": 330, "Zone 7": 420 },
  Warehouses:        { "Zone 1": 40,  "Zone 2": 60,  "Zone 3": 90,  "Zone 4": 120, "Zone 5": 155, "Zone 6": 195, "Zone 7": 250 },
  "Health Facilities":{ "Zone 1": 180, "Zone 2": 240, "Zone 3": 320, "Zone 4": 390, "Zone 5": 460, "Zone 6": 540, "Zone 7": 640 },
  Educational:       { "Zone 1": 60,  "Zone 2": 85,  "Zone 3": 120, "Zone 4": 155, "Zone 5": 200, "Zone 6": 255, "Zone 7": 320 },
  Retail:            { "Zone 1": 90,  "Zone 2": 120, "Zone 3": 170, "Zone 4": 215, "Zone 5": 270, "Zone 6": 340, "Zone 7": 430 },
  Hospitality:       { "Zone 1": 280, "Zone 2": 360, "Zone 3": 460, "Zone 4": 560, "Zone 5": 660, "Zone 6": 780, "Zone 7": 920 },
  Industrial:        { "Zone 1": 110, "Zone 2": 150, "Zone 3": 210, "Zone 4": 265, "Zone 5": 330, "Zone 6": 410, "Zone 7": 510 },
  Other:             { "Zone 1": 100, "Zone 2": 135, "Zone 3": 185, "Zone 4": 235, "Zone 5": 290, "Zone 6": 360, "Zone 7": 450 },
};

// Australian grid emission factor (kg CO2e / kWh)
export const AUS_GRID_FACTOR = 0.79;
// Natural gas combustion factor (kg CO2e / MJ)
export const GAS_COMBUSTION_FACTOR = 0.0514;
// Well-to-Tank (WTT) upstream factors
export const WTT_FACTORS = {
  "Electricity - Grid (AU)": 0.079,
  "Natural Gas": 0.0066,
  "LPG": 0.0059,
  "Diesel": 0.0097,
  "Petrol": 0.0089,
};

/**
 * Estimate electricity kWh/year from building intensity table
 */
export function estimateElecFromBuilding(buildingType, climateZone, areaSqm) {
  const intensity = CBPS_ELECTRICAL_INTENSITY_TABLE[buildingType]?.[climateZone] || 150;
  return intensity * areaSqm;
}

/**
 * Estimate gas MJ/year from building intensity table
 */
export function estimateGasFromBuilding(buildingType, climateZone, areaSqm) {
  const intensity = CBPS_GAS_INTENSITY_TABLE[buildingType]?.[climateZone] || 200;
  return intensity * areaSqm;
}

/**
 * Transport emission factors by mode (kg CO2e / tonne-km)
 */
export const TRANSPORT_FACTORS_TKM = {
  "Road (Truck)": 0.096,
  "Rail": 0.028,
  "Sea (Container)": 0.011,
  "Air": 0.602,
};

/**
 * Calculate Cat 4 transport emissions using tonne-km method
 */
export function calcTransportTco2e(weightKg, distanceKm, mode) {
  const factor = TRANSPORT_FACTORS_TKM[mode] || 0.096;
  const tonneKm = (weightKg / 1000) * distanceKm;
  return tonneKm * factor / 1000; // convert to tCO2e
}