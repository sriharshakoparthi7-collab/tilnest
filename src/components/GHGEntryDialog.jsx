import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { X, Info, ChevronDown, ChevronUp, Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// ─── Emission Factors ───────────────────────────────────────────────────────
const SECTOR_FACTORS = {
  "Manufacturing - General": 0.45,
  "Manufacturing - Metal": 1.85,
  "Manufacturing - Plastic": 2.53,
  "Manufacturing - Electronics": 1.20,
  "Professional Services": 0.18,
  "Construction": 0.72,
  "Food & Beverage": 0.55,
  "Chemicals": 1.65,
  "Textiles": 0.98,
  "Other": 0.35,
};

const MATERIAL_FACTORS = {
  "Steel": 1.85, "Aluminum": 8.24, "Copper": 3.80, "Plastic (PET)": 2.73,
  "Plastic (HDPE)": 2.13, "Glass": 0.85, "Cardboard": 0.94, "Wood": 0.46,
  "Concrete": 0.13, "Rubber": 2.85,
};

const AUS_WASTE_FACTORS = {
  "Landfill - General": 1.91, "Landfill - Organic": 2.64, "Recycling - Metal": 0.02,
  "Recycling - Plastic": 0.04, "Recycling - Paper": 0.03, "Recycling - Glass": 0.01,
  "Incineration": 0.56, "Composting": 0.19, "Wastewater Treatment": 0.52,
};

const AUS_RECOVERY_RATES = {
  "Steel": 0.90, "Aluminum": 0.80, "Plastic (PET)": 0.15, "Cardboard": 0.60, "Glass": 0.30, "General": 0.20
};

const TRANSPORT_MODE_FACTORS = {
  "Road (Truck)": 0.096, "Rail": 0.028, "Sea (Container)": 0.011, "Air": 0.602,
};

const ENERGY_FACTORS = {
  "Electricity - Grid (AU)": 0.79,
  "Electricity - Renewable": 0.02,
  "Natural Gas": 2.04,
  "LPG": 1.51, "Diesel": 2.68, "Petrol": 2.31,
};

const TRAVEL_FACTORS = {
  "Domestic Flights": 0.255,
  "International Flights (Economy)": 0.195,
  "International Flights (Business)": 0.429,
  "Car (Petrol)": 0.170, "Car (EV)": 0.064,
  "Train": 0.041, "Bus": 0.089, "Rideshare": 0.182,
};

const COMMUTE_FACTORS = {
  "Car (Petrol)": 0.170, "Car (EV)": 0.064, "Train": 0.041,
  "Bus": 0.089, "Bicycle/Walking": 0.000, "Work from Home": 0.012,
};

const REFRIGERANT_GWP = {
  "R-22 (HCFC)": 1810, "R-134a": 1430, "R-410A": 2088,
  "R-407C": 1774, "R-404A": 3922, "R-32": 675, "CO2 (R-744)": 1,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function calcTier(tier, form) {
  if (tier === "tier1") return { tco2e: parseFloat(form.primary_tco2e) || 0, score: 10, method: "Tier 1 - Primary LCA/EPD" };
  if (tier === "tier2") {
    const assembly = (parseFloat(form.supplier_s1s2) || 0) * (parseFloat(form.alloc_pct) || 100) / 100 / 1000;
    return { tco2e: assembly, score: 8, method: "Tier 2 - Hybrid/Proxy" };
  }
  if (tier === "tier3") {
    const factor = MATERIAL_FACTORS[form.material_type] || 1.0;
    const tco2e = (parseFloat(form.material_mass_kg) || 0) * factor / 1000;
    return { tco2e, score: 6, method: "Tier 3 - BOM + Industry Averages" };
  }
  const sf = SECTOR_FACTORS[form.sector] || 0.35;
  const tco2e = (parseFloat(form.spend) || 0) * sf * 1.1 / 1000;
  return { tco2e, score: 2, method: "Tier 4 - Spend-based" };
}

function calcTransport(form) {
  if (!form.transport_kg || !form.transport_distance || !form.transport_mode) return 0;
  const mf = TRANSPORT_MODE_FACTORS[form.transport_mode] || 0.096;
  return (parseFloat(form.transport_kg) || 0) / 1000 * (parseFloat(form.transport_distance) || 0) * mf / 1000;
}

function calcWaste(form) {
  const wf = AUS_WASTE_FACTORS[form.waste_type] || 1.91;
  const qty = parseFloat(form.waste_quantity_kg) || 0;
  const emitted = qty * wf / 1000;
  const mat = form.material_type || "General";
  const rate = AUS_RECOVERY_RATES[mat] || 0.20;
  const avoided = qty * rate * (MATERIAL_FACTORS[mat] || 1.0) / 1000;
  return { emitted, avoided, net: emitted - avoided };
}

function QualityBadge({ score }) {
  const cfg = score >= 9 ? { label: "Gold", color: "bg-amber-100 text-amber-700 border-amber-300" }
    : score >= 7 ? { label: "Silver", color: "bg-slate-100 text-slate-600 border-slate-300" }
    : score >= 4 ? { label: "Bronze", color: "bg-orange-100 text-orange-700 border-orange-300" }
    : { label: "Estimated", color: "bg-red-50 text-red-600 border-red-200" };
  return <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cfg.color}`}>{cfg.label} · {score}/10</span>;
}

// ─── Main Dialog ──────────────────────────────────────────────────────────────
export default function GHGEntryDialog({ open, onClose, onSaved, scope, category, defaultValues = {} }) {
  const [locations, setLocations] = useState([]);
  const [saving, setSaving] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [goodsSubcat, setGoodsSubcat] = useState(defaultValues.sub_category || "purchased_goods");

  const isGoods = category?.includes("Goods") || category?.includes("Capital");
  const isWaste = category?.includes("Waste") || category?.includes("End-of-Life");
  const isTravel = category?.includes("Travel") || category?.includes("Business");
  const isCommute = category?.includes("Commut") || category?.includes("Employee");
  const isRefrig = category?.includes("Refrig");
  const isHeatSteam = category?.includes("Purchased Heat") || category?.includes("Steam") || category?.includes("Cooling");
  const isProcess = category?.includes("Process Emissions") || category?.includes("Process");
  const isEnergy = !isHeatSteam && !isProcess && (category?.includes("Electr") || category?.includes("Heat") || category?.includes("Stationary") || scope === "Scope 2" || scope === "Scope 1 - Energy");
  const isWater = category?.includes("Water");

  const [form, setForm] = useState({
    location_id: "", supplier: "", start_date: "", end_date: "", notes: "",
    source_name: "", status: "Draft",
    tier: "tier4", spend: "", sector: "Manufacturing - General",
    primary_tco2e: "", supplier_s1s2: "", alloc_driver: "Economic Allocation", alloc_pct: "100",
    material_type: "Steel", material_mass_kg: "",
    transport_incoterm: "DDP", transport_mode: "Road (Truck)",
    transport_kg: "", transport_distance: "",
    waste_quantity_kg: "", waste_type: "Landfill - General",
    energy_type: "Electricity - Grid (AU)", quantity: "", unit: "kWh",
    green_power_pct: "",
    travel_type: "Domestic Flights", travel_distance_km: "",
    commute_mode: "Car (Petrol)", commute_days: "",
    refrigerant_gas: "R-410A", refrigerant_kg: "",
    water_m3: "",
    amount_paid: "", currency: "USD",
    energy_tier: "tier2", is_proxy_bom: false,
    utility_provider: "", building_type: "Offices", floor_area_sqm: "", ncc_climate_zone: "Zone 5",
    // Heat / Steam / Cooling
    heat_steam_tier: "tier1", heat_energy_type: "Steam", heat_quantity: "", heat_unit: "GJ",
    heat_provider_ef: "", heat_floor_area: "", heat_provider_doc_url: "",
    // Process Emissions
    process_mass: "", process_ef: "", process_material: "",
    // Audit URL fields
    eac_certificate_url: "", utility_invoice_url: "",
    origin_address: "", destination_address: "", port_of_loading: "",
    ...defaultValues
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => { base44.entities.Location.list().then(setLocations); }, []);
  useEffect(() => { setForm(f => ({ ...f, ...defaultValues })); }, [open]);

  // ─── Compute preview ────────────────────────────────────────────────────────
  let result = { tco2e: 0, score: 5, method: "Activity-based", audit: [], categorySplit: {}, avoided: 0, allocationDriver: "" };

  if (isGoods) {
    const tier = calcTier(form.tier, form);
    const transport = form.transport_incoterm !== "DDP" ? calcTransport(form) : 0;
    result.tco2e = tier.tco2e + transport;
    result.score = tier.score;
    result.method = tier.method;
    result.categorySplit = { "Cat 1/2": tier.tco2e.toFixed(4), "Cat 4 (Transport)": transport.toFixed(4) };
    result.allocationDriver = form.alloc_driver;
    result.audit = ["GHG Protocol Corporate Standard", "IPCC AR6", tier.score >= 6 ? "ECOINVENT 3.10" : "Exiobase MRIO", "AUS NGA Factors"];
  } else if (isWaste) {
    const w = calcWaste(form);
    result.tco2e = w.net;
    result.score = 7;
    result.method = "AUS NGA + C2C Circularity";
    result.categorySplit = { "Cat 5 (Ops Waste)": w.emitted.toFixed(4), "Avoided (Recycling)": (-w.avoided).toFixed(4) };
    result.avoided = w.avoided;
    result.audit = ["Australian NGA Factors 2024", "GHG Protocol Cat 12", "AUS Recycling Recovery Rates"];
  } else if (isTravel) {
    const tf = TRAVEL_FACTORS[form.travel_type] || 0.195;
    result.tco2e = (parseFloat(form.travel_distance_km) || 0) * tf / 1000;
    result.score = 7;
    result.method = "Distance-based · DEFRA/ICAO";
    result.categorySplit = { "Cat 6 (Business Travel)": result.tco2e.toFixed(4) };
    result.audit = ["DEFRA GHG Factors 2024", "ICAO Carbon Calculator", "GHG Protocol Cat 6"];
  } else if (isCommute) {
    const cf = COMMUTE_FACTORS[form.commute_mode] || 0.17;
    const days = parseFloat(form.commute_days) || 0;
    result.tco2e = days * 2 * 20 * cf / 1000;
    result.score = 5;
    result.method = "Survey-based · DEFRA";
    result.categorySplit = { "Cat 7 (Employee Commuting)": result.tco2e.toFixed(4) };
    result.audit = ["DEFRA GHG Factors 2024", "GHG Protocol Cat 7"];
  } else if (isRefrig) {
    const gwp = REFRIGERANT_GWP[form.refrigerant_gas] || 2088;
    result.tco2e = (parseFloat(form.refrigerant_kg) || 0) * gwp / 1000;
    result.score = 9;
    result.method = "Fugitive · IPCC AR6 GWP";
    result.categorySplit = { "Scope 1 Fugitive": result.tco2e.toFixed(4) };
    result.audit = ["IPCC AR6 GWP100", "GHG Protocol Scope 1", "ISO 14064-1"];
  } else if (isEnergy) {
    const energyTier = form.energy_tier || "tier2";
    if (energyTier === "tier3") {
      const intensityMap = { "Offices": 185, "Warehouses": 85, "Health Facilities": 380, "Educational": 120, "Retail": 210, "Hospitality": 340, "Industrial": 150, "Other": 150 };
      const intensity = intensityMap[form.building_type || "Offices"] || 150;
      const estimatedKwh = (parseFloat(form.floor_area_sqm) || 0) * intensity;
      result.tco2e = estimatedKwh * 0.79 / 1000;
      result.score = 5;
      result.method = "CBPS/NCC Building Intensity · AUS Grid";
      result.categorySplit = { [scope]: result.tco2e.toFixed(4) };
      result.audit = ["CBPS Intensity Tables", "NCC Climate Zone Data", "Australian NGA 2024"];
    } else if (energyTier === "tier4") {
      result.tco2e = (parseFloat(form.amount_paid) || 0) * 0.0025;
      result.score = 2;
      result.method = "Spend-based · EEIO";
      result.categorySplit = { [scope]: result.tco2e.toFixed(4) };
      result.audit = ["EEIO Database", "Spend-based estimation"];
    } else {
      const ef = ENERGY_FACTORS[form.energy_type] || 0.79;
      const greenAdj = 1 - (parseFloat(form.green_power_pct) || 0) / 100;
      result.tco2e = (parseFloat(form.quantity) || 0) * ef * greenAdj / 1000;
      result.score = energyTier === "tier1" ? 9 : 7;
      result.method = `${scope === "Scope 1" ? "Direct combustion" : energyTier === "tier1" ? "Market-based" : "Location-based"} · AUS Grid`;
      result.categorySplit = { [scope]: result.tco2e.toFixed(4) };
      result.audit = ["Australian NGA 2024", "AEMO Grid Emissions", "GHG Protocol Scope 2 Guidance"];
    }
  } else if (isWater) {
    result.tco2e = (parseFloat(form.water_m3) || 0) * 0.344 / 1000;
    result.score = 6;
    result.method = "Water treatment factor · NGA";
    result.categorySplit = { "Scope 3 Water": result.tco2e.toFixed(4) };
    result.audit = ["Australian NGA Factors", "Water Services Association"];
  } else if (isHeatSteam) {
    const HEAT_EF = { "Steam": 0.268, "Heat (District)": 0.210, "Chilled Water": 0.132 };
    if (form.heat_steam_tier === "tier1") {
      const ef = parseFloat(form.heat_provider_ef) || HEAT_EF[form.heat_energy_type] || 0.268;
      result.tco2e = (parseFloat(form.heat_quantity) || 0) * ef / 1000;
      result.score = 9;
      result.method = `Provider-specific · ${form.heat_energy_type} · ${ef} kgCO₂e/GJ`;
    } else {
      const intensityMap = { "Offices": 185, "Warehouses": 85, "Health Facilities": 380, "Educational": 120, "Retail": 210, "Other": 150 };
      const intensity = intensityMap[form.building_type] || 150;
      const estGj = (parseFloat(form.heat_floor_area) || 0) * intensity * 0.0036;
      const ef = HEAT_EF[form.heat_energy_type] || 0.268;
      result.tco2e = estGj * ef / 1000;
      result.score = 5;
      result.method = `Building intensity estimate · ${form.building_type} · ${intensity} kWh/m²`;
    }
    result.categorySplit = { ["Scope 2"]: result.tco2e.toFixed(4) };
    result.audit = ["IEA District Energy Factors", "GHG Protocol Scope 2 Guidance", "CBPS/NCC Intensity Tables"];
  } else if (isProcess) {
    result.tco2e = (parseFloat(form.process_mass) || 0) * (parseFloat(form.process_ef) || 0);
    result.score = 9;
    result.method = `Stoichiometric: ${form.process_mass || 0} t × ${form.process_ef || 0} tCO₂e/t`;
    result.categorySplit = { "Scope 1 Process": result.tco2e.toFixed(4) };
    result.audit = ["IPCC AR6 Stoichiometric Factors", "GHG Protocol Scope 1", "NGER Act 2007"];
  }

  const save = async () => {
    setSaving(true);
    const loc = locations.find(l => l.id === form.location_id);
    const auditNote = `Method: ${result.method} | Quality: ${result.score}/10 | Split: ${JSON.stringify(result.categorySplit)} | Databases: ${result.audit.join(", ")}`;
    const data = {
      scope, category,
      sub_category: isGoods ? (goodsSubcat === "capital_goods" ? "Capital Goods" : "Purchased Goods & Services") : undefined,
      source_name: form.source_name,
      location_id: form.location_id,
      location_name: loc?.name || "",
      supplier: form.supplier,
      start_date: form.start_date,
      end_date: form.end_date,
      quantity: parseFloat(form.quantity || form.travel_distance_km || form.water_m3 || form.refrigerant_kg || form.waste_quantity_kg) || undefined,
      unit: form.unit,
      amount_paid: parseFloat(form.amount_paid) || undefined,
      currency: form.currency,
      tco2e: parseFloat(result.tco2e.toFixed(6)),
      calculation_method: result.method,
      notes: form.notes ? `${form.notes}\n\n${auditNote}` : auditNote,
      status: form.status,
      green_power_pct: parseFloat(form.green_power_pct) || undefined,
      reporting_year: 2024,
    };
    if (isHeatSteam) {
      data.scope = "Scope 2";
      data.category = category || "Purchased Heat & Steam";
      data.energy_type = form.heat_energy_type;
      data.quantity = parseFloat(form.heat_quantity) || undefined;
      data.unit = form.heat_unit;
      data.provider_emission_factor = parseFloat(form.heat_provider_ef) || undefined;
      data.provider_document_url = form.heat_provider_doc_url || undefined;
      data.facility_sqft = form.heat_steam_tier === "tier2" ? parseFloat(form.heat_floor_area) || undefined : undefined;
      data.building_type = form.building_type;
      data.data_quality_tier = form.heat_steam_tier;
    } else if (isProcess) {
      data.scope = "Scope 1";
      data.category = "Process Emissions";
      data.quantity = parseFloat(form.process_mass) || undefined;
      data.unit = "tonnes";
      data.emission_factor = parseFloat(form.process_ef) || undefined;
    }
    // Add audit URL fields to all records
    if (form.eac_certificate_url) data.eac_certificate_url = form.eac_certificate_url;
    if (form.utility_invoice_url) data.utility_invoice_url = form.utility_invoice_url;
    if (form.origin_address) data.origin_address = form.origin_address;
    if (form.port_of_loading) data.port_of_loading = form.port_of_loading;
    if (form.destination_address) data.destination_address = form.destination_address;
    if (defaultValues.id) await base44.entities.EmissionEntry.update(defaultValues.id, data);
    else await base44.entities.EmissionEntry.create(data);
    setSaving(false);
    onSaved();
    onClose();
  };

  if (!open) return null;

  const previewQuantity = parseFloat(
    ((form.energy_tier || "tier2") === "tier3" ? form.floor_area_sqm : null) ||
    ((form.energy_tier || "tier2") === "tier4" && isEnergy ? form.amount_paid : null) ||
    form.quantity || form.travel_distance_km || form.water_m3 || form.refrigerant_kg ||
    form.waste_quantity_kg || form.spend || form.material_mass_kg || form.commute_days ||
    form.heat_quantity || form.heat_floor_area ||
    form.process_mass || 0
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-slate-500">{scope} · {category}</span>
              <QualityBadge score={result.score} />
            </div>
            <h2 className="text-lg font-bold text-slate-900">{defaultValues.id ? "Edit Entry" : "Add Data"}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Data Hierarchy Banner */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
            <div className="text-xs font-semibold text-slate-600 mb-2">📊 Data Quality Hierarchy — select the best tier you have</div>
            <div className="flex items-center gap-1 text-xs">
              {[
                { label: "🥇 Gold", sub: "Verified LCA/EPD", color: "bg-amber-100 text-amber-800 border-amber-300" },
                { label: "🥈 Silver", sub: "Supplier energy + BOM", color: "bg-slate-100 text-slate-700 border-slate-300" },
                { label: "🥉 Bronze", sub: "Industry averages", color: "bg-orange-100 text-orange-700 border-orange-300" },
                { label: "📊 Estimated", sub: "Spend-based only", color: "bg-red-50 text-red-600 border-red-200" },
              ].map((t, i) => (
                <div key={t.label} className="flex items-center gap-1">
                  {i > 0 && <span className="text-slate-300">›</span>}
                  <span className={`px-2 py-0.5 rounded-full border font-medium ${t.color}`}>{t.label}</span>
                </div>
              ))}
              <span className="text-slate-400 ml-1">Higher = more accurate & audit-ready</span>
            </div>
          </div>
          {/* Common fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium">Source / Asset Name</Label>
              <Input className="mt-1" placeholder="e.g. Main supplier" value={form.source_name} onChange={e => set("source_name", e.target.value)} />
            </div>
            <div>
              <Label className="text-sm font-medium">Location</Label>
              <Select value={form.location_id} onValueChange={v => set("location_id", v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>{locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium">Start Date</Label>
              <Input type="date" className="mt-1" value={form.start_date} onChange={e => set("start_date", e.target.value)} />
            </div>
            <div>
              <Label className="text-sm font-medium">End Date</Label>
              <Input type="date" className="mt-1" value={form.end_date} onChange={e => set("end_date", e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium">Supplier / Vendor</Label>
            <Input className="mt-1" placeholder="Supplier name" value={form.supplier} onChange={e => set("supplier", e.target.value)} />
          </div>

          {/* ── GOODS & SERVICES ── */}
          {isGoods && (
            <div className="space-y-4">
              {/* Smart Sub-category */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-600 border-b border-slate-200">What type of goods?</div>
                <div className="p-3 space-y-2">
                  {[
                    { key: "capital_goods", label: "Capital Goods", sub: "Long-term assets: machinery, IT equipment, vehicles, facilities" },
                    { key: "purchased_goods", label: "Purchased Goods & Services", sub: "Consumables, supplies, professional services" },
                  ].map(opt => (
                    <label key={opt.key} className={`flex items-start gap-2.5 p-2.5 rounded-lg cursor-pointer transition-all border ${goodsSubcat === opt.key ? "bg-blue-50 border-blue-300" : "border-transparent hover:bg-slate-50"}`}>
                      <input type="radio" name="goodsSubcat" checked={goodsSubcat === opt.key} onChange={() => setGoodsSubcat(opt.key)} className="mt-0.5 accent-blue-600" />
                      <div>
                        <div className="text-sm font-medium text-slate-800">{opt.label}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{opt.sub}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {goodsSubcat === "capital_goods" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm font-medium">Asset Type</Label>
                      <Select value={form.asset_type || "Machinery/Equipment"} onValueChange={v => set("asset_type", v)}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["Machinery/Equipment","IT Equipment","Furniture","Vehicles","Facility/Building","Tools","Other"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Useful Life (years)</Label>
                      <Input type="number" className="mt-1" placeholder="10" value={form.useful_life || ""} onChange={e => set("useful_life", e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm font-medium">Acquisition Cost (USD)</Label>
                      <Input type="number" className="mt-1" placeholder="0" value={form.spend} onChange={e => set("spend", e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Expected Residual (%)</Label>
                      <Input type="number" className="mt-1" placeholder="10" min="0" max="100" value={form.residual_pct || ""} onChange={e => set("residual_pct", e.target.value)} />
                    </div>
                  </div>
                </div>
              )}

              {goodsSubcat === "purchased_goods" && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm font-medium">Item Category</Label>
                    <Select value={form.goods_category || "Other"} onValueChange={v => set("goods_category", v)}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["Office Supplies","Packaging Materials","Raw Materials","Maintenance & Repair","Professional Services","Software/Subscriptions","Other"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Frequency</Label>
                    <Select value={form.frequency || "One-time"} onValueChange={v => set("frequency", v)}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["One-time","Monthly","Quarterly","Annually"].map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Data Quality Tier */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="text-xs font-semibold text-blue-800 mb-3 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5" /> Data Quality Tier — select best available
                </div>
                <div className="space-y-2">
                  {[
                    { key: "tier1", label: "Tier 1: Exact Verified Footprint", sub: "We have a verified carbon report (PCF or EPD) from the supplier for this exact product.", score: 10 },
                    { key: "tier2", label: "Tier 2: Supplier Energy + Material Recipe", sub: "We know the supplier's actual factory energy bills AND the materials used to make the product.", score: 8 },
                    { key: "tier3", label: "Tier 3: Industry Averages", sub: "We only know the product type or its material recipe. We will estimate using global database averages.", score: 6 },
                    { key: "tier4", label: "Tier 4: Spend-Based Estimate", sub: "We only know the financial cost. Estimate emissions based purely on dollars spent.", score: 2 },
                  ].map(t => (
                    <label key={t.key} className={`flex items-start gap-2.5 p-2.5 rounded-lg cursor-pointer transition-all ${form.tier === t.key ? "bg-white border border-blue-300 shadow-sm" : "hover:bg-blue-100/50"}`}>
                      <input type="radio" name="tier" className="mt-0.5 accent-blue-600" checked={form.tier === t.key} onChange={() => set("tier", t.key)} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-800">{t.label}</span>
                          <QualityBadge score={t.score} />
                        </div>
                        <span className="text-xs text-slate-500">{t.sub}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {form.tier === "tier1" && (
                <div>
                  <Label className="text-sm font-medium">Verified tCO₂e (from LCA/EPD)</Label>
                  <Input type="number" className="mt-1" placeholder="0.000" value={form.primary_tco2e} onChange={e => set("primary_tco2e", e.target.value)} />
                </div>
              )}

              {form.tier === "tier2" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm font-medium">Supplier Scope 1+2 (kg CO₂e)</Label>
                      <Input type="number" className="mt-1" placeholder="0" value={form.supplier_s1s2} onChange={e => set("supplier_s1s2", e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Product allocation %</Label>
                      <Input type="number" className="mt-1" placeholder="100" min="0" max="100" value={form.alloc_pct} onChange={e => set("alloc_pct", e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Allocation Driver</Label>
                    <Select value={form.alloc_driver} onValueChange={v => set("alloc_driver", v)}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Mass-Based">By Weight (Mass-Based) — I know the weight of my order vs. total factory output</SelectItem>
                        <SelectItem value="Top-Down Time">By Production Time (Top-Down) — I know how long my order took vs. total machine hours</SelectItem>
                        <SelectItem value="Bottom-Up Machine Energy">By Direct Machine Energy (Bottom-Up) — I know the hours + machine kW rating</SelectItem>
                        <SelectItem value="Economic Allocation">By Revenue (Economic) — I know what % of factory revenue my order represents</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Proxy BOM Checkbox */}
                  <div className="flex items-start gap-2.5 p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
                    <input type="checkbox" id="proxy_bom" checked={form.is_proxy_bom || false} onChange={e => set("is_proxy_bom", e.target.checked)} className="mt-0.5 w-4 h-4 accent-yellow-600 flex-shrink-0" />
                    <label htmlFor="proxy_bom" className="cursor-pointer flex-1">
                      <div className="text-sm font-medium text-slate-800">I don't have the exact materials (Use a Proxy BOM)</div>
                      <div className="text-xs text-slate-500 mt-0.5">Checking this allows you to estimate materials (e.g., 'Generic Wood', 'Generic Steel') so you can still use your supplier's exact energy data without double-counting industry averages.</div>
                    </label>
                  </div>
                </div>
              )}

              {form.tier === "tier3" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm font-medium">Primary Material</Label>
                    <Select value={form.material_type} onValueChange={v => set("material_type", v)}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.keys(MATERIAL_FACTORS).map(m => <SelectItem key={m} value={m}>{m} ({MATERIAL_FACTORS[m]} kg/kg)</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Mass (kg)</Label>
                    <Input type="number" className="mt-1" placeholder="0" value={form.material_mass_kg} onChange={e => set("material_mass_kg", e.target.value)} />
                  </div>
                </div>
              )}

              {form.tier === "tier4" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm font-medium">Spend (USD)</Label>
                    <Input type="number" className="mt-1" placeholder="0.00" value={form.spend} onChange={e => set("spend", e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Sector</Label>
                    <Select value={form.sector} onValueChange={v => set("sector", v)}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.keys(SECTOR_FACTORS).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Upstream Transport (Cat 4) */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="text-xs font-semibold text-slate-700">Scope 3 Cat 4 — Upstream Transport</div>
                <div>
                  <Label className="text-sm font-medium">Delivery terms (Incoterm)</Label>
                  <Select value={form.transport_incoterm} onValueChange={v => set("transport_incoterm", v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DDP">DDP — Supplier delivers to us (transport already in their footprint)</SelectItem>
                      <SelectItem value="EXW">EXW / Ex-Works — We arrange collection (we own the freight emissions → Cat 4)</SelectItem>
                      <SelectItem value="FOB">FOB — Split at port (we cover port→facility leg only)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.transport_incoterm !== "DDP" && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-xs">Weight (kg)</Label>
                        <Input type="number" className="mt-1 h-8 text-xs" placeholder="0" value={form.transport_kg} onChange={e => set("transport_kg", e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs">Distance (km)</Label>
                        <Input type="number" className="mt-1 h-8 text-xs" placeholder="0" value={form.transport_distance} onChange={e => set("transport_distance", e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs">Mode</Label>
                        <Select value={form.transport_mode} onValueChange={v => set("transport_mode", v)}>
                          <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>{Object.keys(TRANSPORT_MODE_FACTORS).map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Origin Address</Label>
                        <Input className="mt-1 h-8 text-xs" placeholder="Supplier city / address" value={form.origin_address} onChange={e => set("origin_address", e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs">{form.transport_incoterm === "FOB" ? "Port of Loading" : "Destination Address"}</Label>
                        <Input className="mt-1 h-8 text-xs" placeholder={form.transport_incoterm === "FOB" ? "e.g. Port of Sydney" : "Your facility"} value={form.transport_incoterm === "FOB" ? form.port_of_loading : form.destination_address} onChange={e => set(form.transport_incoterm === "FOB" ? "port_of_loading" : "destination_address", e.target.value)} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── WASTE & REUSE (C2C) ── */}
          {isWaste && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="text-xs font-semibold text-amber-800 mb-2 flex items-center gap-1.5">
                  <Leaf className="w-3.5 h-3.5" /> Cradle-to-Cradle (C2C) Waste Logic — Australian NGA Factors
                </div>
                <p className="text-xs text-amber-700">Cat 5 (Waste in Ops) minus avoided emissions from recycled portion (Cat 12).</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium">Waste Quantity (kg)</Label>
                  <Input type="number" className="mt-1" placeholder="0" value={form.waste_quantity_kg} onChange={e => set("waste_quantity_kg", e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm font-medium">Disposal Method (NGA)</Label>
                  <Select value={form.waste_type} onValueChange={v => set("waste_type", v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(AUS_WASTE_FACTORS).map(([k, v]) => <SelectItem key={k} value={k}>{k} ({v} kg/kg)</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium">Primary Material (for C2C avoided emissions)</Label>
                <Select value={form.material_type} onValueChange={v => set("material_type", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.keys(AUS_RECOVERY_RATES).map(m => <SelectItem key={m} value={m}>{m} (AU recovery: {(AUS_RECOVERY_RATES[m] * 100).toFixed(0)}%)</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {parseFloat(form.waste_quantity_kg) > 0 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className="text-xs text-slate-500">Cat 5 Emitted</div>
                    <div className="text-base font-bold text-red-600">{calcWaste(form).emitted.toFixed(4)}</div>
                    <div className="text-xs text-slate-400">tCO₂e</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Avoided (C2C)</div>
                    <div className="text-base font-bold text-emerald-600">-{calcWaste(form).avoided.toFixed(4)}</div>
                    <div className="text-xs text-slate-400">tCO₂e</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Net</div>
                    <div className="text-base font-bold text-slate-800">{calcWaste(form).net.toFixed(4)}</div>
                    <div className="text-xs text-slate-400">tCO₂e</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── ENERGY ── */}
          {isEnergy && !isGoods && !isWaste && (
            <div className="space-y-4">
              {/* Energy Tier Selection */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="text-xs font-semibold text-blue-800 mb-3">Select Data Quality Tier</div>
                <div className="space-y-2">
                  {[
                    { key: "tier1", label: "Tier 1: Supplier Specific / Green Energy", sub: "We have specific rates from our utility or Renewable Energy Certificates (Market-Based).", score: 9 },
                    { key: "tier2", label: "Tier 2: Metered Energy (Utility Bills)", sub: "We know exact kWh/volume from our utility bills (Location-Based).", score: 7 },
                    { key: "tier3", label: "Tier 3: Estimate by Building Size & Location (New)", sub: "Use this if utilities are included in your rent and you do not have meters. We estimate via your building's footprint and local climate zone.", score: 5 },
                    { key: "tier4", label: "Tier 4: Spend-Based Estimate", sub: "We only know our financial spend on energy.", score: 2 },
                  ].map(t => (
                    <label key={t.key} className={`flex items-start gap-2.5 p-2.5 rounded-lg cursor-pointer transition-all ${form.energy_tier === t.key ? "bg-white border border-blue-300 shadow-sm" : "hover:bg-blue-100/50"}`}>
                      <input type="radio" name="energy_tier" className="mt-0.5 accent-blue-600" checked={form.energy_tier === t.key} onChange={() => set("energy_tier", t.key)} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-800">{t.label}</span>
                          <QualityBadge score={t.score} />
                        </div>
                        <span className="text-xs text-slate-500">{t.sub}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Tier 1 & 2: Energy type + quantity */}
              {(form.energy_tier === "tier1" || form.energy_tier === "tier2") && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm font-medium">Energy / Fuel Type</Label>
                    <Select value={form.energy_type} onValueChange={v => set("energy_type", v)}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(ENERGY_FACTORS).map(([k, v]) => <SelectItem key={k} value={k}>{k} — {v} kg/unit</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm font-medium">Quantity</Label>
                      <Input type="number" className="mt-1" placeholder="0" value={form.quantity} onChange={e => set("quantity", e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Unit</Label>
                      <Select value={form.unit} onValueChange={v => set("unit", v)}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>{["kWh", "MWh", "GJ", "L", "m³", "kg"].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  {form.energy_tier === "tier1" && (
                    <div>
                      <Label className="text-sm font-medium">Utility Provider</Label>
                      <Input className="mt-1" placeholder="e.g. AGL, Origin Energy" value={form.utility_provider || ""} onChange={e => set("utility_provider", e.target.value)} />
                    </div>
                  )}
                  {form.energy_tier === "tier1" && form.energy_type?.startsWith("Electricity") && (
                    <div>
                      <Label className="text-sm font-medium">EAC / REC Certificate URL (optional)</Label>
                      <Input className="mt-1" placeholder="https://... (proof of green certificate)" value={form.eac_certificate_url} onChange={e => set("eac_certificate_url", e.target.value)} />
                    </div>
                  )}
                  {(form.energy_tier === "tier1" || form.energy_tier === "tier2") && (
                    <div>
                      <Label className="text-sm font-medium">Utility Invoice URL (optional)</Label>
                      <Input className="mt-1" placeholder="https://... (upload proof for audit)" value={form.utility_invoice_url} onChange={e => set("utility_invoice_url", e.target.value)} />
                    </div>
                  )}
                  {form.energy_type && form.energy_type.startsWith("Electricity") && (
                    <div>
                      <Label className="text-sm font-medium">Green / Renewable Power %</Label>
                      <Input type="number" className="mt-1" placeholder="0" min="0" max="100" value={form.green_power_pct} onChange={e => set("green_power_pct", e.target.value)} />
                    </div>
                  )}
                </div>
              )}

              {/* Tier 3: Building Intensity */}
              {form.energy_tier === "tier3" && (
                <div className="space-y-3 bg-orange-50 border border-orange-200 rounded-xl p-4">
                  <div className="text-xs font-semibold text-orange-800">Estimate by Building Size & Location (CBPS/NCC Data)</div>
                  <div>
                    <Label className="text-sm font-medium">Building Type</Label>
                    <Select value={form.building_type || "Offices"} onValueChange={v => set("building_type", v)}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["Offices", "Warehouses", "Health Facilities", "Educational", "Retail", "Hospitality", "Industrial", "Other"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm font-medium">Total Floor Area (m²)</Label>
                      <Input type="number" className="mt-1" placeholder="0" value={form.floor_area_sqm || ""} onChange={e => set("floor_area_sqm", e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">NCC Climate Zone</Label>
                      <Select value={form.ncc_climate_zone || "Zone 5"} onValueChange={v => set("ncc_climate_zone", v)}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["Zone 1","Zone 2","Zone 3","Zone 4","Zone 5","Zone 6","Zone 7"].map(z => <SelectItem key={z} value={z}>{z}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <p className="text-xs text-orange-600">💡 Emissions estimated using CBPS/NCC building intensity tables × local grid emission factor.</p>
                </div>
              )}

              {/* Tier 4: Spend-Based */}
              {form.energy_tier === "tier4" && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm font-medium">Energy Spend Amount</Label>
                    <Input type="number" className="mt-1" placeholder="0.00" value={form.amount_paid} onChange={e => set("amount_paid", e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Currency</Label>
                    <Select value={form.currency} onValueChange={v => set("currency", v)}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{["USD","AUD","EUR","GBP"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── TRAVEL ── */}
          {isTravel && !isGoods && (
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium">Travel Mode</Label>
                <Select value={form.travel_type} onValueChange={v => set("travel_type", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.keys(TRAVEL_FACTORS).map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium">Distance (km)</Label>
                <Input type="number" className="mt-1" placeholder="0" value={form.travel_distance_km} onChange={e => set("travel_distance_km", e.target.value)} />
              </div>
            </div>
          )}

          {/* ── EMPLOYEES ── */}
          {isCommute && (
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium">Commute Mode</Label>
                <Select value={form.commute_mode} onValueChange={v => set("commute_mode", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.keys(COMMUTE_FACTORS).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium">Employee commute days / year</Label>
                <Input type="number" className="mt-1" placeholder="220" value={form.commute_days} onChange={e => set("commute_days", e.target.value)} />
                <p className="text-xs text-slate-400 mt-1">Assumes 20 km average one-way commute. Override in notes if different.</p>
              </div>
            </div>
          )}

          {/* ── REFRIGERANTS ── */}
          {isRefrig && (
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium">Refrigerant Gas</Label>
                <Select value={form.refrigerant_gas} onValueChange={v => set("refrigerant_gas", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(REFRIGERANT_GWP).map(([k, v]) => <SelectItem key={k} value={k}>{k} (GWP: {v})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium">Quantity leaked / charged (kg)</Label>
                <Input type="number" className="mt-1" placeholder="0" value={form.refrigerant_kg} onChange={e => set("refrigerant_kg", e.target.value)} />
              </div>
            </div>
          )}

          {/* ── PURCHASED HEAT / STEAM / COOLING ── */}
          {isHeatSteam && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="text-xs font-semibold text-blue-800 mb-1">Scope 2 — Purchased Heat, Steam or Cooling</div>
                <p className="text-xs text-blue-700">Emissions from district heating, steam or chilled water networks. No Scope 3.3 is triggered for this sub-activity by default.</p>
              </div>
              <div>
                <Label className="text-sm font-medium">Energy Type</Label>
                <Select value={form.heat_energy_type} onValueChange={v => set("heat_energy_type", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{["Steam", "Heat (District)", "Chilled Water"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
                <div className="text-xs font-semibold text-blue-800 mb-2">Data Quality Tier</div>
                {[
                  { key: "tier1", label: "Tier 1: Specific Provider Data (Gold)", sub: "We have exact metered consumption and a specific emission factor from the district network provider.", score: 9 },
                  { key: "tier2", label: "Tier 2: Estimated via Building Size (Silver)", sub: "We estimate consumption using our floor area and industry intensity averages.", score: 5 },
                ].map(t => (
                  <label key={t.key} className={`flex items-start gap-2.5 p-2.5 rounded-lg cursor-pointer transition-all ${form.heat_steam_tier === t.key ? "bg-white border border-blue-300 shadow-sm" : "hover:bg-blue-100/50"}`}>
                    <input type="radio" name="heat_tier" className="mt-0.5 accent-blue-600" checked={form.heat_steam_tier === t.key} onChange={() => set("heat_steam_tier", t.key)} />
                    <div><div className="text-sm font-medium text-slate-800">{t.label}</div><div className="text-xs text-slate-500">{t.sub}</div></div>
                  </label>
                ))}
              </div>
              {form.heat_steam_tier === "tier1" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm font-medium">Quantity Consumed</Label>
                      <Input type="number" className="mt-1" placeholder="0" value={form.heat_quantity} onChange={e => set("heat_quantity", e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Unit</Label>
                      <Select value={form.heat_unit} onValueChange={v => set("heat_unit", v)}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>{["GJ", "MWh", "kWh", "t (steam)"].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Provider Emission Factor (kgCO₂e/GJ)</Label>
                    <Input type="number" className="mt-1" placeholder="e.g. 268" value={form.heat_provider_ef} onChange={e => set("heat_provider_ef", e.target.value)} />
                    <p className="text-xs text-slate-400 mt-1">Found in your district provider's annual sustainability report. Defaults: Steam 268, Heat 210, Chilled Water 132.</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Provider Report / Document URL (optional)</Label>
                    <Input className="mt-1" placeholder="https://... (audit evidence)" value={form.heat_provider_doc_url} onChange={e => set("heat_provider_doc_url", e.target.value)} />
                  </div>
                </div>
              )}
              {form.heat_steam_tier === "tier2" && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm font-medium">Building Type</Label>
                    <Select value={form.building_type} onValueChange={v => set("building_type", v)}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{["Offices", "Warehouses", "Health Facilities", "Educational", "Retail", "Other"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Total Floor Area (m²)</Label>
                    <Input type="number" className="mt-1" placeholder="0" value={form.heat_floor_area} onChange={e => set("heat_floor_area", e.target.value)} />
                  </div>
                  <p className="text-xs text-slate-400">💡 Estimates energy intensity via CBPS/NCC building type benchmarks × default district heating factor.</p>
                </div>
              )}
            </div>
          )}

          {/* ── PROCESS EMISSIONS ── */}
          {isProcess && (
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="text-xs font-semibold text-red-800 mb-1">Scope 1 — Industrial Process Emissions</div>
                <p className="text-xs text-red-700">Emissions from chemical reactions, not fuel combustion (e.g., cement clinker calcination, lime production). Calculated via stoichiometric mass-balance methodology.</p>
              </div>
              <div>
                <Label className="text-sm font-medium">Material / Process Type</Label>
                <Select value={form.process_material || "Limestone Calcination"} onValueChange={v => set("process_material", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[
                      "Limestone Calcination (CaCO₃ → CaO)",
                      "Cement Clinker Production",
                      "Lime Production (Quicklime)",
                      "Soda Ash Production",
                      "Aluminium Smelting (Anode Effect)",
                      "Iron & Steel Production (Coking Coal)",
                      "Chemical Production (Custom)",
                      "Other Industrial Process",
                    ].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium">Mass of Material Processed (Tonnes)</Label>
                  <Input type="number" className="mt-1" placeholder="0" value={form.process_mass} onChange={e => set("process_mass", e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm font-medium">Stoichiometric Emission Factor (tCO₂e / tonne)</Label>
                  <Input type="number" className="mt-1" placeholder="e.g. 0.44 for limestone" value={form.process_ef} onChange={e => set("process_ef", e.target.value)} />
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600">
                Common factors: Limestone 0.44 | Cement clinker 0.52 | Quicklime 0.75 | Soda ash 0.41
                <div className="text-slate-400 mt-1">Source: IPCC AR6 · NGER Act 2007 Measurement Determination</div>
              </div>
            </div>
          )}

          {/* ── WATER ── */}
          {isWater && (
            <div>
              <Label className="text-sm font-medium">Water Volume (m³)</Label>
              <Input type="number" className="mt-1" placeholder="0" value={form.water_m3} onChange={e => set("water_m3", e.target.value)} />
            </div>
          )}

          {/* Amount paid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium">Amount Paid</Label>
              <Input type="number" className="mt-1" placeholder="0.00" value={form.amount_paid} onChange={e => set("amount_paid", e.target.value)} />
            </div>
            <div>
              <Label className="text-sm font-medium">Currency</Label>
              <Select value={form.currency} onValueChange={v => set("currency", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{["USD", "AUD", "EUR", "GBP", "SGD"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium">Notes (optional)</Label>
            <Input className="mt-1" placeholder="Additional context..." value={form.notes} onChange={e => set("notes", e.target.value)} />
          </div>

          {/* ── Results Preview ── */}
          {previewQuantity > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-emerald-600 font-medium">Calculated Emissions</div>
                  <div className="text-2xl font-bold text-emerald-800">
                    {result.tco2e.toFixed(4)} <span className="text-sm font-normal">tCO₂e</span>
                  </div>
                </div>
                <QualityBadge score={result.score} />
              </div>

              {isGoods && result.categorySplit && (
                <div className="text-xs text-emerald-700 space-y-0.5">
                  {Object.entries(result.categorySplit).map(([k, v]) => (
                    <div key={k} className="flex justify-between"><span>{k}</span><span className="font-semibold">{v} tCO₂e</span></div>
                  ))}
                </div>
              )}

              <button onClick={() => setShowAudit(a => !a)} className="flex items-center gap-1 text-xs text-emerald-600 hover:underline mt-1">
                {showAudit ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {showAudit ? "Hide" : "Show"} audit trail
              </button>
              {showAudit && (
                <div className="bg-white border border-emerald-200 rounded-lg p-3 space-y-1">
                  <div className="text-xs font-semibold text-slate-600 mb-1.5">Audit Trail</div>
                  <div className="text-xs text-slate-600"><span className="font-medium">Methodology:</span> {result.method}</div>
                  {result.allocationDriver && <div className="text-xs text-slate-600"><span className="font-medium">Allocation:</span> {result.allocationDriver}</div>}
                  {result.avoided > 0 && <div className="text-xs text-emerald-600"><span className="font-medium">Avoided (C2C):</span> -{result.avoided.toFixed(4)} tCO₂e</div>}
                  <div className="text-xs text-slate-600"><span className="font-medium">Category split:</span> {JSON.stringify(result.categorySplit)}</div>
                  <div className="text-xs text-slate-500 mt-1"><span className="font-medium">Databases:</span> {result.audit.join(" · ")}</div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-between items-center p-6 border-t border-slate-100">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || previewQuantity === 0}>
            {saving ? "Saving..." : "Save Entry"}
          </Button>
        </div>
      </div>
    </div>
  );
}