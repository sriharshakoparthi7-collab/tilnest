import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { X, Plus, Trash2, Info, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// ── Emission factors ──────────────────────────────────────────────────────────
const TRANSPORT_FACTORS = { "Heavy Truck": 0.096, "Light Van": 0.24, "Rail": 0.028, "Sea Freight": 0.011, "Air Freight": 0.602 };
const SECTOR_FACTORS = { "Manufacturing": 0.00041, "Construction": 0.00038, "Mining": 0.00072, "Agriculture": 0.00089, "Transport": 0.00051, "Services": 0.00019, "Retail": 0.00022, "Default": 0.00033 };
const AUS_RECOVERY_RATES = { "steel": 0.90, "aluminium": 0.90, "copper": 0.85, "plastic": 0.15, "paper": 0.60, "glass": 0.45, "concrete": 0.70, "timber": 0.25 };
const RECYCLING_CREDITS = { "steel": 1.46, "aluminium": 9.20, "copper": 2.80, "plastic": 1.50, "paper": 0.80, "glass": 0.31 };
const EOL_FACTORS = { "steel": 0.021, "aluminium": 0.021, "plastic": 0.12, "paper": 0.98, "glass": 0.009, "concrete": 0.0082, "timber": 0.44 };

const getMatFactor = (map, mat) => {
  const key = Object.keys(map).find(k => mat.toLowerCase().includes(k)) || "default";
  return map[key] ?? map["steel"] ?? 0.05;
};

const DATA_TIERS = [
  { value: "Tier 1 - EPD/LCA", label: "Tier 1 — EPD/LCA", score: 10, color: "border-emerald-400 bg-emerald-50 text-emerald-800", desc: "Supplier-provided EPD or LCA" },
  { value: "Tier 2 - Scope1+2 + BOM", label: "Tier 2 — S1+S2 + BOM", score: 8, color: "border-blue-400 bg-blue-50 text-blue-800", desc: "Supplier Scope 1+2 + Bill of Materials" },
  { value: "Tier 3 - BOM Only", label: "Tier 3 — BOM Only", score: 6, color: "border-amber-400 bg-amber-50 text-amber-800", desc: "Bill of Materials with industry factors" },
  { value: "Tier 4 - Spend-based", label: "Tier 4 — Spend-based", score: 2, color: "border-orange-400 bg-orange-50 text-orange-800", desc: "Financial spend × sector factor × 1.1" },
];

const SIMPLE_EF = { "Electricity (kWh)": 0.000679, "Natural Gas (m³)": 0.00204, "Diesel (L)": 0.00268, "Petrol (L)": 0.00231 };

function calcSimpleEmissions(form) {
  const factor = SIMPLE_EF[`${form.fuel_type || "Electricity"} (${form.unit})`] || 0.000679;
  return ((parseFloat(form.quantity) || 0) * factor);
}

function calcGoodsEmissions(form) {
  const qty = parseFloat(form.quantity) || 1;
  const unitMass = parseFloat(form.unit_mass_kg) || 0;
  const totalMass = qty * unitMass;
  const spend = parseFloat(form.spend_usd) || 0;
  let tco2e = 0, method = "", score = 2;

  if (form.data_tier === "Tier 1 - EPD/LCA") {
    tco2e = (parseFloat(form.supplier_tco2e) || 0) * qty;
    method = "EPD/LCA"; score = 10;
  } else if (form.data_tier === "Tier 2 - Scope1+2 + BOM") {
    const s1s2 = parseFloat(form.supplier_scope1_2_tco2e) || 0;
    const factoryKg = parseFloat(form.supplier_total_output_kg) || 0;
    const revenue = parseFloat(form.supplier_revenue_usd) || 0;
    if (factoryKg > 0 && totalMass > 0) { tco2e = (s1s2 / factoryKg) * totalMass; method = "Mass-based"; }
    else if (revenue > 0 && spend > 0) { tco2e = (s1s2 / revenue) * spend; method = "Economic-based"; }
    else if (form.bom_materials?.length > 0) { tco2e = form.bom_materials.reduce((s, m) => s + (m.mass_kg || 0) * (m.emission_factor_kgco2e_per_kg || 0), 0) * qty / 1000; method = "BOM Activity-based"; }
    score = 8;
  } else if (form.data_tier === "Tier 3 - BOM Only") {
    if (form.bom_materials?.length > 0) { tco2e = form.bom_materials.reduce((s, m) => s + (m.mass_kg || 0) * (m.emission_factor_kgco2e_per_kg || 0), 0) * qty / 1000; method = "BOM Industry Average"; }
    score = 6;
  } else {
    const sf = SECTOR_FACTORS[form.sector_code] || SECTOR_FACTORS.Default;
    tco2e = spend * sf * 1.1 / 1000;
    method = "Spend-based (×1.1)"; score = 2;
  }

  // Cat 4 transport
  let transportTco2e = 0;
  if (form.delivery_terms === "Ex-Works / Client Pick-up" && totalMass > 0 && parseFloat(form.transport_distance_km) > 0) {
    const mf = TRANSPORT_FACTORS[form.transport_mode] || TRANSPORT_FACTORS["Heavy Truck"];
    transportTco2e = (totalMass / 1000) * parseFloat(form.transport_distance_km) * mf / 1000;
  }

  // C2C
  let c2cNet = 0;
  if (form.is_c2c && form.bom_materials?.length > 0) {
    form.bom_materials.forEach(m => {
      const tm = (m.mass_kg || 0) * qty;
      const recovery = getMatFactor(AUS_RECOVERY_RATES, m.material);
      const eolF = getMatFactor(EOL_FACTORS, m.material);
      const creditF = getMatFactor(RECYCLING_CREDITS, m.material);
      c2cNet += (tm * (1 - recovery) * eolF / 1000) - (tm * recovery * creditF / 1000);
    });
  }

  return { tco2e, transportTco2e, c2cNet, method, score, total: tco2e + transportTco2e + c2cNet };
}

export default function AddEntryDialog({ open, onClose, onSaved, scope, category, subCategory, defaultValues = {} }) {
  const [locations, setLocations] = useState([]);
  const isGoods = category === "Purchased Goods and Services" || scope === "Scope 3";
  const [form, setForm] = useState({
    source_name: "", location_id: "", location_name: "", supplier: "",
    start_date: "", end_date: "", quantity: "", unit: isGoods ? "units" : "kWh",
    amount_paid: "", currency: "USD", green_power_pct: "",
    calculation_method: "Actual", notes: "", status: "Draft",
    fuel_type: "", vehicle_type: "",
    // PRAMAE tier fields
    data_tier: "Tier 4 - Spend-based",
    unit_mass_kg: "", spend_usd: "", sector_code: "Manufacturing",
    supplier_tco2e: "", supplier_scope1_2_tco2e: "",
    supplier_total_output_kg: "", supplier_revenue_usd: "",
    bom_materials: [],
    delivery_terms: "Supplier Delivered (DDP)",
    transport_distance_km: "", transport_mode: "Heavy Truck",
    is_c2c: false,
    ...defaultValues
  });
  const [bomRow, setBomRow] = useState({ material: "", mass_kg: "", emission_factor_kgco2e_per_kg: "" });
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => { base44.entities.Location.list().then(setLocations); }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const addBomRow = () => {
    if (!bomRow.material) return;
    set("bom_materials", [...(form.bom_materials || []), { material: bomRow.material, mass_kg: parseFloat(bomRow.mass_kg) || 0, emission_factor_kgco2e_per_kg: parseFloat(bomRow.emission_factor_kgco2e_per_kg) || 0 }]);
    setBomRow({ material: "", mass_kg: "", emission_factor_kgco2e_per_kg: "" });
  };

  // Calculate estimated emissions
  const goodsCalc = isGoods ? calcGoodsEmissions(form) : null;
  const simpleTco2e = !isGoods ? calcSimpleEmissions(form) : 0;
  const estimatedTco2e = isGoods ? goodsCalc.total : simpleTco2e;

  const save = async () => {
    setSaving(true);
    const loc = locations.find(l => l.id === form.location_id);
    const data = {
      ...form,
      scope, category,
      sub_category: subCategory,
      location_name: loc?.name || form.location_name,
      reporting_year: 2024,
      quantity: parseFloat(form.quantity) || undefined,
      amount_paid: parseFloat(form.amount_paid) || undefined,
      green_power_pct: parseFloat(form.green_power_pct) || undefined,
      tco2e: parseFloat(estimatedTco2e.toFixed(6)),
      // Store tier metadata
      notes: [form.notes, isGoods ? `[${goodsCalc?.method || ""} Q:${goodsCalc?.score}/10]` : ""].filter(Boolean).join(" "),
    };
    if (defaultValues.id) await base44.entities.EmissionEntry.update(defaultValues.id, data);
    else await base44.entities.EmissionEntry.create(data);
    setSaving(false);
    onSaved();
    onClose();
  };

  if (!open) return null;
  const tierInfo = DATA_TIERS.find(t => t.value === form.data_tier);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-base font-bold text-slate-900">{defaultValues.id ? "Edit Entry" : "Add Data"}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{scope} · {category}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Basic fields */}
          <div>
            <Label className="text-sm font-medium">Source / Asset Name</Label>
            <Input className="mt-1" placeholder="e.g. Main Office Electricity" value={form.source_name} onChange={e => set("source_name", e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium">Location</Label>
              <Select value={form.location_id} onValueChange={v => set("location_id", v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>{locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium">Supplier</Label>
              <Input className="mt-1" placeholder="Supplier name" value={form.supplier} onChange={e => set("supplier", e.target.value)} />
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium">Quantity</Label>
              <Input type="number" className="mt-1" placeholder="0" value={form.quantity} onChange={e => set("quantity", e.target.value)} />
            </div>
            <div>
              <Label className="text-sm font-medium">Unit</Label>
              <Select value={form.unit} onValueChange={v => set("unit", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["kWh", "MWh", "GJ", "L", "m³", "t", "kg", "km", "miles", "units", "USD", "EUR"].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium">Amount Paid</Label>
              <Input type="number" className="mt-1" placeholder="0.00" value={form.amount_paid} onChange={e => set("amount_paid", e.target.value)} />
            </div>
            <div>
              <Label className="text-sm font-medium">Currency</Label>
              <Select value={form.currency} onValueChange={v => set("currency", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{["USD", "EUR", "GBP", "AUD", "SGD", "INR"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          {scope === "Scope 2" && (
            <div>
              <Label className="text-sm font-medium">Green Power %</Label>
              <Input type="number" className="mt-1" placeholder="0" min="0" max="100" value={form.green_power_pct} onChange={e => set("green_power_pct", e.target.value)} />
            </div>
          )}

          {/* ── PRAMAE GHG Logic (Goods & Services / Scope 3) ── */}
          {isGoods && (
            <>
              <div className="border-t border-slate-100 pt-4">
                <button
                  className="flex items-center justify-between w-full text-left"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                >
                  <div>
                    <div className="text-sm font-semibold text-slate-800">GHG Calculation Method</div>
                    {!showAdvanced && tierInfo && (
                      <div className={`inline-flex items-center gap-1.5 mt-1 text-xs font-medium px-2 py-0.5 rounded-full border ${tierInfo.color}`}>
                        {tierInfo.label} · Score {tierInfo.score}/10
                      </div>
                    )}
                  </div>
                  {showAdvanced ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </button>
              </div>

              {showAdvanced && (
                <div className="space-y-4 bg-slate-50 rounded-xl p-4 border border-slate-200">
                  {/* Tier selection */}
                  <div className="space-y-2">
                    {DATA_TIERS.map(t => (
                      <label key={t.value} className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${form.data_tier === t.value ? t.color + " border-current" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
                        <input type="radio" name="tier" checked={form.data_tier === t.value} onChange={() => set("data_tier", t.value)} className="mt-0.5" />
                        <div>
                          <span className="text-xs font-semibold">{t.label}</span>
                          <span className="ml-1.5 text-xs opacity-70">· Score {t.score}/10</span>
                          <div className="text-xs opacity-60">{t.desc}</div>
                        </div>
                      </label>
                    ))}
                  </div>

                  {/* Tier 1 */}
                  {form.data_tier === "Tier 1 - EPD/LCA" && (
                    <div>
                      <Label className="text-xs font-medium">Supplier tCO₂e per unit</Label>
                      <Input type="number" className="mt-1 text-sm" placeholder="0.000" value={form.supplier_tco2e} onChange={e => set("supplier_tco2e", e.target.value)} />
                    </div>
                  )}

                  {/* Tier 2 */}
                  {form.data_tier === "Tier 2 - Scope1+2 + BOM" && (
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs font-medium">Supplier total S1+S2 (tCO₂e/yr)</Label>
                        <Input type="number" className="mt-1 text-sm" placeholder="0.000" value={form.supplier_scope1_2_tco2e} onChange={e => set("supplier_scope1_2_tco2e", e.target.value)} />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs font-medium">Factory output (kg/yr)</Label>
                          <Input type="number" className="mt-1 text-sm" placeholder="e.g. 500000" value={form.supplier_total_output_kg} onChange={e => set("supplier_total_output_kg", e.target.value)} />
                        </div>
                        <div>
                          <Label className="text-xs font-medium">Revenue (USD/yr)</Label>
                          <Input type="number" className="mt-1 text-sm" placeholder="fallback" value={form.supplier_revenue_usd} onChange={e => set("supplier_revenue_usd", e.target.value)} />
                        </div>
                      </div>
                      <p className="text-xs text-blue-600 flex items-center gap-1"><Info className="w-3 h-3" /> Mass-based allocation applied (economic fallback if no mass)</p>
                    </div>
                  )}

                  {/* Tier 4 */}
                  {form.data_tier === "Tier 4 - Spend-based" && (
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs font-medium">Spend (USD)</Label>
                        <Input type="number" className="mt-1 text-sm" placeholder="0.00" value={form.spend_usd} onChange={e => set("spend_usd", e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs font-medium">Sector</Label>
                        <Select value={form.sector_code} onValueChange={v => set("sector_code", v)}>
                          <SelectTrigger className="mt-1 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>{Object.keys(SECTOR_FACTORS).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <p className="text-xs text-amber-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Safety factor 1.1× applied (GHG Protocol)</p>
                    </div>
                  )}

                  {/* BOM (Tier 2/3 or C2C) */}
                  {(form.data_tier === "Tier 2 - Scope1+2 + BOM" || form.data_tier === "Tier 3 - BOM Only" || form.is_c2c) && (
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-slate-700">Bill of Materials</Label>
                      {(form.bom_materials || []).map((m, i) => (
                        <div key={i} className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs">
                          <span className="flex-1 font-medium">{m.material}</span>
                          <span className="text-slate-500">{m.mass_kg}kg</span>
                          <span className="text-slate-500">{m.emission_factor_kgco2e_per_kg} EF</span>
                          <button onClick={() => set("bom_materials", form.bom_materials.filter((_, j) => j !== i))}><Trash2 className="w-3 h-3 text-red-400" /></button>
                        </div>
                      ))}
                      <div className="grid grid-cols-3 gap-1.5">
                        <Input className="text-xs" placeholder="Material" value={bomRow.material} onChange={e => setBomRow(b => ({ ...b, material: e.target.value }))} />
                        <Input type="number" className="text-xs" placeholder="kg/unit" value={bomRow.mass_kg} onChange={e => setBomRow(b => ({ ...b, mass_kg: e.target.value }))} />
                        <Input type="number" className="text-xs" placeholder="kgCO₂e/kg" value={bomRow.emission_factor_kgco2e_per_kg} onChange={e => setBomRow(b => ({ ...b, emission_factor_kgco2e_per_kg: e.target.value }))} />
                      </div>
                      <Button variant="outline" size="sm" className="gap-1 w-full text-xs h-7" onClick={addBomRow}><Plus className="w-3 h-3" /> Add Material</Button>
                    </div>
                  )}

                  {/* Unit mass */}
                  <div>
                    <Label className="text-xs font-medium">Unit Mass (kg per item)</Label>
                    <Input type="number" className="mt-1 text-sm" placeholder="0" value={form.unit_mass_kg} onChange={e => set("unit_mass_kg", e.target.value)} />
                  </div>

                  {/* Transport */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-slate-700">Upstream Transport (Cat 4)</Label>
                    <Select value={form.delivery_terms} onValueChange={v => set("delivery_terms", v)}>
                      <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Supplier Delivered (DDP)">Supplier Delivered — bundled</SelectItem>
                        <SelectItem value="Ex-Works / Client Pick-up">Ex-Works — separate Cat 4</SelectItem>
                      </SelectContent>
                    </Select>
                    {form.delivery_terms === "Ex-Works / Client Pick-up" && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs font-medium">Distance (km)</Label>
                          <Input type="number" className="mt-1 text-sm" placeholder="500" value={form.transport_distance_km} onChange={e => set("transport_distance_km", e.target.value)} />
                        </div>
                        <div>
                          <Label className="text-xs font-medium">Mode</Label>
                          <Select value={form.transport_mode} onValueChange={v => set("transport_mode", v)}>
                            <SelectTrigger className="mt-1 text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>{Object.keys(TRANSPORT_FACTORS).map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* C2C toggle */}
                  <label className="flex items-center gap-2.5 cursor-pointer bg-white border border-slate-200 rounded-lg p-3">
                    <input type="checkbox" checked={form.is_c2c} onChange={e => set("is_c2c", e.target.checked)} className="accent-emerald-600 w-4 h-4" />
                    <div>
                      <div className="text-xs font-semibold text-slate-800">Cradle-to-Cradle (C2C) Analysis</div>
                      <div className="text-xs text-slate-500">Cat 12 End-of-Life · Australian NGA recovery rates + circularity credits</div>
                    </div>
                  </label>

                  {/* Breakdown preview */}
                  {goodsCalc && parseFloat(form.quantity) > 0 && (
                    <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-1.5 text-xs">
                      <div className="font-semibold text-slate-700">Calculation Breakdown</div>
                      <div className="flex justify-between"><span className="text-slate-500">Cat 1 (Product)</span><span className="font-medium">{goodsCalc.tco2e.toFixed(4)} tCO₂e</span></div>
                      {goodsCalc.transportTco2e > 0 && <div className="flex justify-between"><span className="text-slate-500">Cat 4 (Transport)</span><span className="font-medium">{goodsCalc.transportTco2e.toFixed(4)} tCO₂e</span></div>}
                      {form.is_c2c && <div className="flex justify-between"><span className="text-slate-500">Cat 12 C2C (net)</span><span className={goodsCalc.c2cNet < 0 ? "text-emerald-600 font-medium" : "font-medium"}>{goodsCalc.c2cNet.toFixed(4)} tCO₂e</span></div>}
                      <div className="flex justify-between border-t border-slate-100 pt-1.5 text-sm font-bold"><span>Total</span><span>{goodsCalc.total.toFixed(4)} tCO₂e</span></div>
                      <div className="text-slate-400">Method: {goodsCalc.method} · Quality {goodsCalc.score}/10</div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Notes */}
          <div>
            <Label className="text-sm font-medium">Notes (optional)</Label>
            <Input className="mt-1" placeholder="Any additional context..." value={form.notes} onChange={e => set("notes", e.target.value)} />
          </div>

          {/* Simple emissions preview for non-goods */}
          {!isGoods && parseFloat(form.quantity) > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <div className="text-xs text-emerald-600 font-medium mb-0.5">Estimated Emissions</div>
              <div className="text-2xl font-bold text-emerald-800">{estimatedTco2e.toFixed(4)} <span className="text-sm font-normal">tCO₂e</span></div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-5 border-t border-slate-100">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Entry"}</Button>
        </div>
      </div>
    </div>
  );
}