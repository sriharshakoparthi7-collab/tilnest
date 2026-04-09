const FUEL_FACTORS = {
  Petrol: 2.31, Diesel: 2.68, "Natural Gas": 1.90,
  LPG: 1.55, CNG: 2.31, Electric: 0.50, Hybrid: 1.20, Other: 2.0,
};

const HOURS_FACTORS = {
  Generator: 5.0, Compressor: 3.2, Forklift: 1.8, Pump: 2.5,
  Welder: 1.5, Excavator: 8.0, Loader: 6.0, Grinder: 0.8,
  "Air Handler": 2.0, Boiler: 4.5, Chiller: 3.5, Fan: 0.5, Motor: 2.0, Other: 3.0,
};

export function calculateEquipmentEmissions({ measurementType, quantity, powerSource, equipmentType }) {
  const qty = parseFloat(quantity) || 0;
  if (!qty) return { tco2e: 0, method: "No quantity entered" };

  if (measurementType === "Fuel Consumption (L)") {
    const factor = FUEL_FACTORS[powerSource] || 2.31;
    return { tco2e: parseFloat(((qty * factor) / 1000).toFixed(6)), method: `Fuel-based (${powerSource} · ${factor} kg/L)` };
  }
  if (measurementType === "Operating Hours per period") {
    const factor = HOURS_FACTORS[equipmentType] || 3.0;
    return { tco2e: parseFloat(((qty * factor) / 1000).toFixed(6)), method: `Hours-based (${equipmentType} · ${factor} kg/h)` };
  }
  if (measurementType === "Energy Consumption (kWh)") {
    const factor = FUEL_FACTORS["Electric"];
    return { tco2e: parseFloat(((qty * factor) / 1000).toFixed(6)), method: `Energy-based (${factor} kg/kWh)` };
  }
  if (measurementType === "Load Factor (% of capacity)") {
    const estimatedKwh = (qty / 100) * 30 * 24 * 10;
    const factor = FUEL_FACTORS["Electric"];
    return { tco2e: parseFloat(((estimatedKwh * factor) / 1000).toFixed(6)), method: `Load-factor estimate (${qty}% × ~${estimatedKwh.toFixed(0)}kWh)` };
  }
  return { tco2e: 0, method: "Unknown measurement type" };
}

export function unitForMeasurementType(measurementType) {
  if (measurementType === "Operating Hours per period") return "hours";
  if (measurementType === "Fuel Consumption (L)") return "L";
  if (measurementType === "Energy Consumption (kWh)") return "kWh";
  if (measurementType === "Load Factor (% of capacity)") return "%";
  return "";
}

export const EQUIPMENT_TYPES = ["Generator","Compressor","Forklift","Pump","Welder","Excavator","Loader","Grinder","Air Handler","Boiler","Chiller","Fan","Motor","Other"];
export const POWER_SOURCES = ["Petrol","Diesel","Natural Gas","LPG","CNG","Electric","Hybrid","Other"];
export const ACTIVITY_TYPES = ["Continuous (runs 24/7)","Intermittent (scheduled use)","Standby (backup only)","Seasonal (seasonal operation)"];
export const MEASUREMENT_TYPES = ["Operating Hours per period","Fuel Consumption (L)","Energy Consumption (kWh)","Load Factor (% of capacity)"];