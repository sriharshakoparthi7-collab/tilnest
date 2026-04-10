export const EQUIPMENT_FUEL_FACTORS = {
  Petrol: 2.31,
  Diesel: 2.68,
  "Natural Gas": 1.90,
  LPG: 1.55,
  CNG: 2.31,
  Electric: 0.50,
  Hybrid: 1.80,
  Other: 2.00,
};

const HOURS_FACTORS = {
  Generator: 5.0, Compressor: 3.2, Forklift: 1.8,
  Pump: 2.0, Welder: 1.5, Excavator: 8.0, Loader: 6.0,
  Grinder: 1.2, "Air Handler": 2.5, Boiler: 4.0,
  Chiller: 3.0, Fan: 1.0, Motor: 2.5, Other: 3.0,
};

export function calculateEquipmentEmissions(form) {
  const qty = parseFloat(form.quantity) || 0;
  if (!qty) return { tco2e: 0, method: "—" };

  const { measurement_type, power_source, equipment_type } = form;

  if (measurement_type === "Fuel Consumption (L)") {
    const f = EQUIPMENT_FUEL_FACTORS[power_source] || 2.31;
    return { tco2e: (qty * f) / 1000, method: `Fuel-based · ${power_source} @ ${f} kg/L` };
  }
  if (measurement_type === "Operating Hours") {
    const f = HOURS_FACTORS[equipment_type] || 4.0;
    return { tco2e: (qty * f) / 1000, method: `Hours-based · ${equipment_type} @ ${f} kg/h` };
  }
  if (measurement_type === "Energy Consumption (kWh)") {
    const f = EQUIPMENT_FUEL_FACTORS["Electric"];
    return { tco2e: (qty * f) / 1000, method: `Energy-based · ${qty}kWh @ ${f} kg/kWh` };
  }
  if (measurement_type === "Load Factor (%)") {
    const hours = 30 * 24;
    const kwh = hours * 10 * (qty / 100);
    const tco2e = (kwh * EQUIPMENT_FUEL_FACTORS["Electric"]) / 1000;
    return { tco2e, method: `Load-factor estimate · ${qty}% × ${kwh.toFixed(0)}kWh` };
  }
  return { tco2e: 0, method: "Unknown" };
}

export const UNIT_FOR_MEASUREMENT = {
  "Operating Hours": "hours",
  "Fuel Consumption (L)": "L",
  "Energy Consumption (kWh)": "kWh",
  "Load Factor (%)": "%",
};

export const BULK_TEMPLATE_HEADERS = [
  "equipment_name","equipment_type","equipment_subtype","location_name",
  "power_source","activity_type","measurement_type","quantity","start_date",
  "end_date","reporting_period","manufacturer","model","equipment_age_years",
  "status","notes"
];

export const BULK_EXAMPLE_ROWS = [
  ["Generator-001","Generator","Diesel 50kW","Main Site","Diesel","Continuous","Fuel Consumption (L)","250","2024-01-01","2024-03-31","Monthly","Caterpillar","C9","5","Active","Backup power"],
  ["Compressor-A","Compressor","","Warehouse","Electric","Intermittent","Energy Consumption (kWh)","400","2024-01-01","2024-03-31","Monthly","Atlas Copco","ZR4","8","Active",""],
];