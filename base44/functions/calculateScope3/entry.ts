import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// ─── EMISSION FACTORS ────────────────────────────────────────────────────────
// Transport mode factors (kgCO2e per tonne-km) - IPCC / Ecoinvent 3.9
const TRANSPORT_FACTORS = {
  "Heavy Truck": 0.096,
  "Light Van": 0.24,
  "Rail": 0.028,
  "Sea Freight": 0.011,
  "Air Freight": 0.602,
};

// Australian NGA 2025 sector spend factors (kgCO2e / USD)
const SECTOR_FACTORS = {
  "Manufacturing": 0.00041,
  "Construction": 0.00038,
  "Mining": 0.00072,
  "Agriculture": 0.00089,
  "Transport": 0.00051,
  "Services": 0.00019,
  "Retail": 0.00022,
  "Default": 0.00033,
};

// Australian NGA 2025 end-of-life material factors (kgCO2e / kg to landfill)
const EOL_LANDFILL_FACTORS = {
  "Steel": 0.021,
  "Aluminium": 0.021,
  "Plastic": 0.12,
  "Paper": 0.98,
  "Glass": 0.009,
  "Concrete": 0.0082,
  "Timber": 0.44,
  "Default": 0.05,
};

// Australian average recovery / recycling rates
const AUS_RECOVERY_RATES = {
  "Steel": 0.90, "Aluminium": 0.90, "Copper": 0.85,
  "Plastic": 0.15, "Paper": 0.60, "Glass": 0.45,
  "Concrete": 0.70, "Timber": 0.25, "Default": 0.30,
};

// Avoided-emission credit for recycling (kgCO2e per kg recycled)
const RECYCLING_CREDIT_FACTORS = {
  "Steel": 1.46, "Aluminium": 9.20, "Copper": 2.80,
  "Plastic": 1.50, "Paper": 0.80, "Glass": 0.31,
  "Default": 0.60,
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function getRecoveryRate(material) {
  for (const [k, v] of Object.entries(AUS_RECOVERY_RATES)) {
    if (material.toLowerCase().includes(k.toLowerCase())) return v;
  }
  return AUS_RECOVERY_RATES.Default;
}
function getEolFactor(material) {
  for (const [k, v] of Object.entries(EOL_LANDFILL_FACTORS)) {
    if (material.toLowerCase().includes(k.toLowerCase())) return v;
  }
  return EOL_LANDFILL_FACTORS.Default;
}
function getCreditFactor(material) {
  for (const [k, v] of Object.entries(RECYCLING_CREDIT_FACTORS)) {
    if (material.toLowerCase().includes(k.toLowerCase())) return v;
  }
  return RECYCLING_CREDIT_FACTORS.Default;
}
function getSectorFactor(sectorCode) {
  if (!sectorCode) return SECTOR_FACTORS.Default;
  for (const [k, v] of Object.entries(SECTOR_FACTORS)) {
    if (sectorCode.toLowerCase().includes(k.toLowerCase())) return v;
  }
  return SECTOR_FACTORS.Default;
}

// ─── MAIN CALCULATION ────────────────────────────────────────────────────────
function calculate(entry) {
  const {
    ui_category, quantity = 1, unit_mass_kg = 0, spend_usd = 0,
    sector_code, data_tier,
    supplier_tco2e, supplier_scope1_2_tco2e,
    supplier_total_output_kg, supplier_revenue_usd,
    bom_materials = [],
    delivery_terms, transport_distance_km = 0, transport_mode = "Heavy Truck",
    is_c2c = false,
  } = entry;

  const totalMassKg = quantity * unit_mass_kg;
  const results = [];
  const auditTrail = ["NGA Factors 2025", "Ecoinvent 3.9", "GHG Protocol Technical Guidance v1.0"];

  // ── TIER LOGIC for Goods & Services ──────────────────────────────────────
  if (ui_category === "Goods & Services") {
    let cat1_tco2e = 0;
    let qualityScore = 2;
    let allocationMethod = "Spend-based";

    if (data_tier === "Tier 1 - EPD/LCA") {
      cat1_tco2e = (supplier_tco2e || 0) * quantity;
      qualityScore = 10;
      allocationMethod = "EPD/LCA (Supplier-provided)";
      auditTrail.push("Supplier EPD");
    } else if (data_tier === "Tier 2 - Scope1+2 + BOM") {
      const s1s2 = supplier_scope1_2_tco2e || 0;
      // Mass-based allocation (Priority 2)
      if (supplier_total_output_kg > 0 && totalMassKg > 0) {
        cat1_tco2e = (s1s2 / supplier_total_output_kg) * totalMassKg;
        allocationMethod = "Mass-based";
        auditTrail.push("Supplier S1+S2 data");
      } else if (supplier_revenue_usd > 0 && spend_usd > 0) {
        cat1_tco2e = (s1s2 / supplier_revenue_usd) * spend_usd;
        allocationMethod = "Economic-based";
      } else if (bom_materials.length > 0) {
        cat1_tco2e = bom_materials.reduce((s, m) => s + (m.mass_kg || 0) * (m.emission_factor_kgco2e_per_kg || 0), 0) * quantity / 1000;
        allocationMethod = "BOM Activity-based";
      }
      qualityScore = 8;
    } else if (data_tier === "Tier 3 - BOM Only") {
      if (bom_materials.length > 0) {
        cat1_tco2e = bom_materials.reduce((s, m) => s + (m.mass_kg || 0) * (m.emission_factor_kgco2e_per_kg || 0), 0) * quantity / 1000;
        allocationMethod = "BOM Industry Average";
        auditTrail.push("Ecoinvent 3.9 material factors");
      }
      qualityScore = 6;
    } else {
      // Tier 4 Spend-based
      const factor = getSectorFactor(sector_code);
      cat1_tco2e = spend_usd * factor * 1.1 / 1000; // safety factor 1.1, convert kg to t
      allocationMethod = "Spend-based (x1.1 safety factor)";
      qualityScore = 2;
    }

    results.push({
      GHG_Category: "Cat 1 - Purchased Goods & Services",
      UI_Section: "Goods & Services",
      Total_tCO2e: parseFloat(cat1_tco2e.toFixed(6)),
      Data_Quality_Rating: qualityScore,
      Allocation_Method: allocationMethod,
      Audit_Trail: auditTrail,
    });

    // ── Cat 4: Upstream Transport ────────────────────────────────────────
    if (delivery_terms === "Ex-Works / Client Pick-up" && transport_distance_km > 0 && totalMassKg > 0) {
      const modeFactor = TRANSPORT_FACTORS[transport_mode] || TRANSPORT_FACTORS["Heavy Truck"];
      const cat4_tco2e = (totalMassKg / 1000) * transport_distance_km * modeFactor / 1000;
      results.push({
        GHG_Category: "Cat 4 - Upstream Transportation",
        UI_Section: "Goods & Services",
        Total_tCO2e: parseFloat(cat4_tco2e.toFixed(6)),
        Data_Quality_Rating: 7,
        Allocation_Method: `Weight × Distance × Mode Factor (${transport_mode})`,
        Audit_Trail: ["IPCC AR6 Transport Factors", "Ecoinvent 3.9"],
      });
    }

    // ── Cat 5: Waste in Operations (scrap from BOM) ─────────────────────
    if (bom_materials.length > 0 && totalMassKg > 0) {
      const bomTotalKg = bom_materials.reduce((s, m) => s + (m.mass_kg || 0), 0) * quantity;
      const scrapKg = Math.max(0, bomTotalKg - totalMassKg);
      if (scrapKg > 0) {
        const cat5_tco2e = bom_materials.reduce((s, m) => {
          const ratio = (m.mass_kg || 0) / (bom_materials.reduce((a, b) => a + b.mass_kg, 0) || 1);
          return s + ratio * scrapKg * getEolFactor(m.material) / 1000;
        }, 0) * quantity;
        results.push({
          GHG_Category: "Cat 5 - Waste in Operations",
          UI_Section: "Waste & Reuse",
          Total_tCO2e: parseFloat(cat5_tco2e.toFixed(6)),
          Data_Quality_Rating: 6,
          Allocation_Method: "BOM scrap rate × NGA landfill factors",
          Audit_Trail: ["NGA Factors 2025"],
        });
      }
    }

    // ── C2C: Cat 12 + Circularity Credits ───────────────────────────────
    if (is_c2c && bom_materials.length > 0) {
      let cat12_tco2e = 0;
      let avoided_tco2e = 0;
      const c2cBreakdown = [];

      bom_materials.forEach(m => {
        const massPerUnit = m.mass_kg || 0;
        const totalMass = massPerUnit * quantity;
        const recovery = getRecoveryRate(m.material);
        const eolFactor = getEolFactor(m.material);
        const creditFactor = getCreditFactor(m.material);
        const landfillMass = totalMass * (1 - recovery);
        const recycledMass = totalMass * recovery;
        const eolEmissions = landfillMass * eolFactor / 1000;
        const avoidedCredit = recycledMass * creditFactor / 1000;
        cat12_tco2e += eolEmissions;
        avoided_tco2e += avoidedCredit;
        c2cBreakdown.push({ material: m.material, total_mass_kg: totalMass, recovery_rate_pct: (recovery * 100).toFixed(0), eol_tco2e: eolEmissions.toFixed(6), avoided_tco2e: avoidedCredit.toFixed(6) });
      });

      results.push({
        GHG_Category: "Cat 12 - End-of-Life Treatment (C2C)",
        UI_Section: "Waste & Reuse",
        Total_tCO2e: parseFloat(cat12_tco2e.toFixed(6)),
        Avoided_tCO2e_Credit: parseFloat(avoided_tco2e.toFixed(6)),
        Net_tCO2e: parseFloat((cat12_tco2e - avoided_tco2e).toFixed(6)),
        C2C_Material_Breakdown: c2cBreakdown,
        Data_Quality_Rating: 7,
        Allocation_Method: "Australian NGA recovery rates + circularity credit",
        Audit_Trail: ["NGA Factors 2025 (Australia)", "C2C Protocol v3.1"],
      });
    }

  } else if (ui_category === "Energy") {
    const kWh = entry.quantity || 0;
    const electricityFactor = 0.000679; // Australian avg grid (NGA 2025, tCO2e/kWh)
    const gasFactor = 0.002040; // Natural gas (tCO2e/m3)
    results.push({
      GHG_Category: entry.fuel_type === "Gas" ? "Scope 1 - Stationary Combustion" : "Scope 2 - Purchased Electricity",
      UI_Section: "Energy",
      Total_tCO2e: parseFloat((kWh * (entry.fuel_type === "Gas" ? gasFactor : electricityFactor)).toFixed(6)),
      Data_Quality_Rating: 8,
      Allocation_Method: "Activity-based (NGA grid factors)",
      Audit_Trail: ["NGA Factors 2025 (Australia)"],
    });
  } else if (ui_category === "Travel") {
    const distKm = entry.quantity || 0;
    const flightFactor = 0.000255; // economy class, tCO2e/km/pax (DEFRA 2024)
    results.push({
      GHG_Category: "Scope 3 - Cat 6 - Business Travel",
      UI_Section: "Travel",
      Total_tCO2e: parseFloat((distKm * flightFactor).toFixed(6)),
      Data_Quality_Rating: 7,
      Allocation_Method: "Distance-based (DEFRA 2024)",
      Audit_Trail: ["DEFRA 2024 Travel Factors"],
    });
  } else if (ui_category === "Employees") {
    const distKm = entry.quantity || 0;
    results.push({
      GHG_Category: "Scope 3 - Cat 7 - Employee Commuting",
      UI_Section: "Employees",
      Total_tCO2e: parseFloat((distKm * 0.00017).toFixed(6)),
      Data_Quality_Rating: 5,
      Allocation_Method: "Distance-based average commute",
      Audit_Trail: ["NGA Factors 2025 (Australia)", "DEFRA 2024"],
    });
  } else if (ui_category === "Refrigerants") {
    const kgLeaked = entry.quantity || 0;
    const r410aGWP = 2088;
    results.push({
      GHG_Category: "Scope 1 - Fugitive Emissions (Refrigerants)",
      UI_Section: "Refrigerants",
      Total_tCO2e: parseFloat((kgLeaked * r410aGWP / 1000).toFixed(6)),
      Data_Quality_Rating: 8,
      Allocation_Method: "GWP-based (AR5)",
      Audit_Trail: ["IPCC AR5 GWP Factors", "NGA Factors 2025"],
    });
  } else if (ui_category === "Waste & Reuse") {
    const massKg = entry.quantity || 0;
    results.push({
      GHG_Category: "Scope 3 - Cat 5 - Waste in Operations",
      UI_Section: "Waste & Reuse",
      Total_tCO2e: parseFloat((massKg * 0.05 / 1000).toFixed(6)),
      Data_Quality_Rating: 5,
      Allocation_Method: "Weight-based (NGA average landfill factor)",
      Audit_Trail: ["NGA Factors 2025 (Australia)"],
    });
  } else if (ui_category === "Water") {
    const m3 = entry.quantity || 0;
    results.push({
      GHG_Category: "Scope 3 - Purchased Water",
      UI_Section: "Water",
      Total_tCO2e: parseFloat((m3 * 0.000344).toFixed(6)),
      Data_Quality_Rating: 6,
      Allocation_Method: "Volume-based (NGA water treatment factor)",
      Audit_Trail: ["NGA Factors 2025 (Australia)"],
    });
  }

  const totalTco2e = results.reduce((s, r) => s + r.Total_tCO2e, 0);
  return { results, totalTco2e: parseFloat(totalTco2e.toFixed(6)) };
}

// ─── HANDLER ─────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { entry_id, entry } = body;

  let data = entry;
  if (entry_id && !entry) {
    const records = await base44.entities.PurchaseEntry.filter({ id: entry_id });
    data = records[0];
  }
  if (!data) return Response.json({ error: "No entry data provided" }, { status: 400 });

  const { results, totalTco2e } = calculate(data);
  const output = {
    entry_id: data.id || entry_id,
    description: data.description,
    ui_category: data.ui_category,
    data_tier: data.data_tier,
    total_tco2e: totalTco2e,
    line_items: results,
    calculated_at: new Date().toISOString(),
  };

  // Persist result back to entity if we have an ID
  if (data.id) {
    await base44.entities.PurchaseEntry.update(data.id, {
      result_json: JSON.stringify(output),
      status: "Calculated",
    });
  }

  return Response.json({ success: true, output });
});